import assert from 'assert';
import worker, {
  getGoogleAccessToken,
  postReplyToGoogleBusinessProfile,
  fetchGbpReview,
  fetchGbpReviewsList,
  processIncomingReview,
  handlePubSubNotification,
  pollNewReviews,
  updateReviewReply,
  handleMagicLinkReply,
  cleanGbpId,
  parseStarRating,
  safeBase64Decode
} from './src/index.js';

console.log("================================================================");
console.log("🚀 Google Business Profile (GBP) API 統合 完全検証テスト 🚀");
console.log("================================================================\n");

// グローバル fetch のモック管理
const originalFetch = globalThis.fetch;

function mockFetch(handlers) {
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = init.method || 'GET';

    for (const h of handlers) {
      if (h.match(url, method, init)) {
        return h.respond(url, method, init);
      }
    }
    // 未定義のURL呼び出しは元の fetch
    return originalFetch(input, init);
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// D1 Mock Client
function createMockDB() {
  const users = [
    {
      id: 'usr_owner_1',
      email: 'owner1@example.com',
      name: '渋谷太郎',
      line_user_id: 'U_shibuya_line_user_123',
      notification_email: 'owner1@example.com'
    }
  ];

  const sessions = [
    {
      id: 'sess_valid',
      user_id: 'usr_owner_1',
      expires_at: '2099-01-01 00:00:00'
    }
  ];

  const locations = [
    {
      id: 'locations/loc_shibuya_100',
      user_id: 'usr_owner_1',
      account_id: 'accounts/acc_gbp_999',
      location_name: 'TRATTORIA SHIBUYA (渋谷店)',
      category: 'イタリアン',
      address: '東京都渋谷区神南1-1-1',
      auto_reply: 0,
      ai_tone: 'polite',
      google_access_token: null,
      google_refresh_token: 'loc_custom_refresh_token_xyz',
      line_user_id: 'U_shibuya_line_user_123'
    }
  ];

  const reviews = [];
  const replyTokens = [];

  return {
    _data: { users, sessions, locations, reviews, replyTokens },
    prepare(sql) {
      function createExec(args = []) {
        return {
          bind(...newArgs) {
            return createExec(newArgs);
          },
          async first() {
            if (sql.includes('FROM sessions s') && sql.includes('JOIN users u')) {
              const s = sessions.find(x => x.id === args[0]);
              if (!s) return null;
              const u = users.find(x => x.id === s.user_id);
              return u ? { ...u, session_id: s.id } : null;
            }

            if (sql.includes('FROM locations') && sql.includes('WHERE id = ? AND user_id = ?')) {
              return locations.find(l => (l.id === args[0] || l.id === `locations/${args[0]}`) && l.user_id === args[1]) || null;
            }

            if (sql.includes('FROM locations') && (sql.includes('WHERE l.id = ?') || sql.includes('WHERE id = ?'))) {
              const idArg = args[0];
              return locations.find(l => l.id === idArg || l.id === `locations/${idArg}` || l.id.includes(idArg)) || null;
            }

            if (sql.includes('FROM locations l') && sql.includes('JOIN users u')) {
              const l = locations[0];
              if (!l) return null;
              const u = users.find(x => x.id === l.user_id);
              return { ...l, user_line_id: u?.line_user_id, user_email: u?.notification_email };
            }

            if (sql.includes('FROM reply_tokens t') && sql.includes('JOIN reviews r')) {
              const token = args[0];
              const tok = replyTokens.find(t => t.token === token && !t.is_used);
              if (!tok) return null;
              const rev = reviews.find(r => r.id === tok.review_id);
              return rev ? {
                token: tok.token,
                review_id: tok.review_id,
                location_id: tok.location_id,
                action_type: tok.action_type,
                is_used: tok.is_used,
                expires_at: tok.expires_at,
                generated_reply_a: rev.generated_reply_a,
                generated_reply_b: rev.generated_reply_b,
                generated_reply_c: rev.generated_reply_c
              } : null;
            }

            if (sql.includes('FROM reviews') && sql.includes('WHERE id = ?')) {
              const rId = args[0];
              return reviews.find(r => r.id === rId) || null;
            }

            if (sql.includes('FROM users WHERE id = ?')) {
              return users.find(u => u.id === args[0]) || null;
            }

            return null;
          },

          async all() {
            if (sql.includes('FROM locations l') && sql.includes('JOIN users u')) {
              return {
                results: locations.map(l => {
                  const u = users.find(x => x.id === l.user_id);
                  return { ...l, user_line_id: u?.line_user_id, user_email: u?.notification_email };
                })
              };
            }
            if (sql.includes('FROM locations WHERE user_id = ?')) {
              return { results: locations.filter(l => l.user_id === args[0]) };
            }
            if (sql.includes('FROM reviews')) {
              return { results: reviews };
            }
            return { results: [] };
          },

          async run() {
            // INSERT INTO reviews
            if (sql.includes('INSERT INTO reviews') || sql.includes('INSERT OR IGNORE INTO reviews')) {
              const [id, location_id, reviewer_name, star_rating, comment] = args;
              const existing = reviews.find(r => r.id === id);
              if (existing) {
                existing.reviewer_name = reviewer_name;
                existing.star_rating = star_rating;
                existing.comment = comment;
              } else {
                reviews.push({
                  id,
                  location_id,
                  reviewer_name,
                  star_rating,
                  comment,
                  reply_status: 'pending'
                });
              }
              return { meta: { changes: 1 } };
            }

            // UPDATE reviews
            if (sql.includes('UPDATE reviews') && sql.includes('SET generated_reply_a = ?')) {
              const [repA, repB, repC, trans, revId, locId] = args;
              const r = reviews.find(x => x.id === revId);
              if (r) {
                r.generated_reply_a = repA;
                r.generated_reply_b = repB;
                r.generated_reply_c = repC;
                r.translated_comment = trans;
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }

            // UPDATE reviews SET final_reply_text
            if (sql.includes('UPDATE reviews') && sql.includes('SET final_reply_text = ?')) {
              const [finalReply, status, revId, locId] = args;
              const r = reviews.find(x => x.id === revId);
              if (r) {
                r.final_reply_text = finalReply;
                r.reply_status = status;
                r.replied_at = new Date().toISOString();
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }

            // INSERT INTO reply_tokens
            if (sql.includes('INSERT INTO reply_tokens')) {
              const [token, review_id, location_id, action_type] = args;
              replyTokens.push({
                token,
                review_id,
                location_id,
                action_type,
                is_used: 0,
                expires_at: '2099-01-01'
              });
              return { meta: { changes: 1 } };
            }

            // UPDATE reply_tokens SET is_used = 1
            if (sql.includes('UPDATE reply_tokens SET is_used = 1')) {
              const tok = replyTokens.find(t => t.token === args[0]);
              if (tok) tok.is_used = 1;
              return { meta: { changes: tok ? 1 : 0 } };
            }

            return { meta: { changes: 1 } };
          }
        };
      }

      return createExec([]);
    },

    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    }
  };
}

async function runGbpTests() {
  const db = createMockDB();

  // ============================================================================
  console.log("SECTION 1: ヘルパー関数 (正規化・デコード・星評価)");
  // ============================================================================

  // 1.1 cleanGbpId
  assert.strictEqual(cleanGbpId('accounts/12345', 'accounts'), '12345');
  assert.strictEqual(cleanGbpId('locations/67890', 'locations'), '67890');
  assert.strictEqual(cleanGbpId('reviews/rev999', 'reviews'), 'rev999');
  assert.strictEqual(cleanGbpId('999', 'reviews'), '999');
  console.log("  ✅ [PASS] 1.1 cleanGbpId: プレフィックス安全除去正規化");

  // 1.2 parseStarRating
  assert.strictEqual(parseStarRating('FIVE'), 5);
  assert.strictEqual(parseStarRating('ONE'), 1);
  assert.strictEqual(parseStarRating('STAR_RATING_FOUR'), 4);
  assert.strictEqual(parseStarRating(3), 3);
  assert.strictEqual(parseStarRating('invalid'), 5);
  console.log("  ✅ [PASS] 1.2 parseStarRating: 各種星評価フォーマットを1〜5に正規化");

  // 1.3 safeBase64Decode
  const testJapanese = "こんにちは！美味しい料理でした！";
  const b64 = Buffer.from(testJapanese, 'utf-8').toString('base64');
  assert.strictEqual(safeBase64Decode(b64), testJapanese);
  console.log("  ✅ [PASS] 1.3 safeBase64Decode: 日本語UTF-8文字列の文字化けなしデコード");

  // ============================================================================
  console.log("\nSECTION 2: Google OAuth 2.0 トークン自動取得・リフレッシュ (getGoogleAccessToken)");
  // ============================================================================

  // 2.1 環境変数未設定時 (Google審査待ち・認可前)
  const envUnset = {};
  const tokenUnset = await getGoogleAccessToken(envUnset);
  assert.strictEqual(tokenUnset, null, "未設定時は例外なくnullを返却すること");
  console.log("  ✅ [PASS] 2.1 getGoogleAccessToken: 環境変数未設定時に例外なく null を返却 (シミュレーション移行)");

  // 2.2 環境変数設定時: POST https://oauth2.googleapis.com/token
  let oauthCalled = false;
  mockFetch([
    {
      match: (url, method) => url.includes('oauth2.googleapis.com/token') && method === 'POST',
      respond: (url, method, init) => {
        oauthCalled = true;
        assert(init.body.includes('client_id=test_client_id'));
        assert(init.body.includes('client_secret=test_secret'));
        assert(init.body.includes('grant_type=refresh_token'));
        return new Response(JSON.stringify({
          access_token: 'ya29.mock_valid_access_token_123',
          expires_in: 3600,
          token_type: 'Bearer'
        }), { status: 200 });
      }
    }
  ]);

  const envConfigured = {
    GOOGLE_CLIENT_ID: 'test_client_id',
    GOOGLE_CLIENT_SECRET: 'test_secret',
    GOOGLE_REFRESH_TOKEN: 'test_refresh_token'
  };

  const accessToken = await getGoogleAccessToken(envConfigured);
  assert.strictEqual(oauthCalled, true);
  assert.strictEqual(accessToken, 'ya29.mock_valid_access_token_123');
  console.log("  ✅ [PASS] 2.2 getGoogleAccessToken: 有効な access_token の自動取得成功");

  // 2.3 店舗ごとの customRefreshToken の優先
  let customRefreshCalled = false;
  mockFetch([
    {
      match: (url) => url.includes('oauth2.googleapis.com/token'),
      respond: (url, method, init) => {
        if (init.body.includes('custom_token_abc')) {
          customRefreshCalled = true;
          return new Response(JSON.stringify({ access_token: 'ya29.custom_token_res' }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 });
      }
    }
  ]);
  const customRes = await getGoogleAccessToken(envConfigured, 'custom_token_abc');
  assert.strictEqual(customRefreshCalled, true);
  assert.strictEqual(customRes, 'ya29.custom_token_res');
  console.log("  ✅ [PASS] 2.3 getGoogleAccessToken: 店舗個別 customRefreshToken の優先取得成功");

  // ============================================================================
  console.log("\nSECTION 3: Googleマップ クチコミ実返信 API送信 (postReplyToGoogleBusinessProfile)");
  // ============================================================================

  // 3.1 認可待ちシミュレーションモード (access_token未設定時)
  const simResult = await postReplyToGoogleBusinessProfile(envUnset, {
    accountId: 'accounts/111',
    locationId: 'locations/222',
    reviewId: 'reviews/333',
    comment: 'シミュレーション返信テスト'
  });
  assert.strictEqual(simResult.success, true);
  assert.strictEqual(simResult.simulated, true);
  assert.strictEqual(simResult.accountId, '111');
  assert.strictEqual(simResult.locationId, '222');
  assert.strictEqual(simResult.reviewId, '333');
  console.log("  ✅ [PASS] 3.1 postReplyToGoogleBusinessProfile: 審査待ちシミュレーション動作 (例外なく安全稼働)");

  // 3.2 本番稼働モード: PUT https://mybusiness.googleapis.com/v4/accounts/.../reviews/.../reply
  let gbpPutCalled = false;
  mockFetch([
    {
      match: (url) => url.includes('oauth2.googleapis.com/token'),
      respond: () => new Response(JSON.stringify({ access_token: 'ya29.live_token' }), { status: 200 })
    },
    {
      match: (url, method) => url.includes('mybusiness.googleapis.com/v4/accounts/999/locations/100/reviews/rev1/reply') && method === 'PUT',
      respond: (url, method, init) => {
        gbpPutCalled = true;
        assert.strictEqual(init.headers['Authorization'], 'Bearer ya29.live_token');
        const body = JSON.parse(init.body);
        assert.strictEqual(body.comment, '本番返信テキスト');
        return new Response(JSON.stringify({
          comment: body.comment,
          updateTime: new Date().toISOString()
        }), { status: 200 });
      }
    }
  ]);

  const liveResult = await postReplyToGoogleBusinessProfile(envConfigured, {
    accountId: 'accounts/999',
    locationId: 'locations/100',
    reviewId: 'reviews/rev1',
    comment: '本番返信テキスト'
  });
  assert.strictEqual(gbpPutCalled, true);
  assert.strictEqual(liveResult.success, true);
  assert.strictEqual(liveResult.simulated, false);
  console.log("  ✅ [PASS] 3.2 postReplyToGoogleBusinessProfile: GBP本番APIへのPUT実返信リクエスト成功");

  // ============================================================================
  console.log("\nSECTION 4: 返信反映API & 1タップ返信 (Magic Link) との統合");
  // ============================================================================

  // 事前データ準備
  db._data.reviews.push({
    id: 'rev_test_magic',
    location_id: 'locations/loc_shibuya_100',
    reviewer_name: 'テスト顧客',
    star_rating: 5,
    comment: '素晴らしいサービスでした',
    generated_reply_a: '案A: ご来店ありがとうございました！',
    generated_reply_b: '案B: いつもご利用ありがとうございます！',
    generated_reply_c: '案C: またのお越しを心よりお待ちしております。',
    reply_status: 'pending'
  });

  db._data.replyTokens.push({
    token: 'tok_magic_sample_123',
    review_id: 'rev_test_magic',
    location_id: 'locations/loc_shibuya_100',
    action_type: 'reply_a',
    is_used: 0,
    expires_at: '2099-01-01'
  });

  // 4.1 handleMagicLinkReply (メール/LINE内の1タップ返信URLをクリック)
  const envWithDb = {
    ...envConfigured,
    DB: db
  };

  let magicGbpCalled = false;
  mockFetch([
    {
      match: (url) => url.includes('oauth2.googleapis.com/token'),
      respond: () => new Response(JSON.stringify({ access_token: 'ya29.live_token' }), { status: 200 })
    },
    {
      match: (url, method) => url.includes('reviews/rev_test_magic/reply') && method === 'PUT',
      respond: (url, method, init) => {
        magicGbpCalled = true;
        const body = JSON.parse(init.body);
        assert.strictEqual(body.comment, '案A: ご来店ありがとうございました！');
        return new Response(JSON.stringify({ comment: body.comment }), { status: 200 });
      }
    }
  ]);

  const magicRes = await handleMagicLinkReply(envWithDb, 'tok_magic_sample_123');
  assert.strictEqual(magicRes.success, true);
  assert.strictEqual(magicGbpCalled, true, "1タップ返信実行時にGBP APIへの実返信が行われること");

  const updatedRev = db._data.reviews.find(r => r.id === 'rev_test_magic');
  assert.strictEqual(updatedRev.reply_status, 'replied_a');
  assert.strictEqual(updatedRev.final_reply_text, '案A: ご来店ありがとうございました！');

  const usedToken = db._data.replyTokens.find(t => t.token === 'tok_magic_sample_123');
  assert.strictEqual(usedToken.is_used, 1, "トークンが使用済みに更新されること");
  console.log("  ✅ [PASS] 4.1 handleMagicLinkReply: 1タップ返信によるGoogle実返信 & D1ステータス更新");

  // 4.2 API: POST /api/reviews/reply (管理画面からの手動返信)
  const replyReq = new Request('http://localhost/api/reviews/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'session_id=sess_valid'
    },
    body: JSON.stringify({
      reviewId: 'rev_test_magic',
      locationId: 'locations/loc_shibuya_100',
      replyText: '管理画面からのカスタム返信メッセージ',
      replyStatus: 'replied_manual'
    })
  });

  let apiGbpCalled = false;
  mockFetch([
    {
      match: (url) => url.includes('oauth2.googleapis.com/token'),
      respond: () => new Response(JSON.stringify({ access_token: 'ya29.live_token' }), { status: 200 })
    },
    {
      match: (url, method) => url.includes('reviews/rev_test_magic/reply') && method === 'PUT',
      respond: (url, method, init) => {
        apiGbpCalled = true;
        const body = JSON.parse(init.body);
        assert.strictEqual(body.comment, '管理画面からのカスタム返信メッセージ');
        return new Response(JSON.stringify({ comment: body.comment }), { status: 200 });
      }
    }
  ]);

  const apiRes = await worker.fetch(replyReq, envWithDb);
  assert.strictEqual(apiRes.status, 200);
  const apiData = await apiRes.json();
  assert.strictEqual(apiData.success, true);
  assert.strictEqual(apiGbpCalled, true);
  console.log("  ✅ [PASS] 4.2 POST /api/reviews/reply: 管理画面返信時のGBP送信 & D1記録");

  // ============================================================================
  console.log("\nSECTION 5: Google Pub/Sub リアルタイム新着クチコミ受信 (handlePubSubNotification)");
  // ============================================================================

  // 5.1 Pub/Sub メッセージの受信、Base64デコード、Gemini返信生成、D1保存、LINEプッシュ通知
  const pubSubPayload = {
    review: "accounts/acc_gbp_999/locations/loc_shibuya_100/reviews/rev_pubsub_new_1",
    reviewer: { displayName: "山田花子" },
    starRating: "FIVE",
    comment: "パスタが絶品でした！また来ます！"
  };

  const rawBase64 = Buffer.from(JSON.stringify(pubSubPayload), 'utf-8').toString('base64');
  const pubSubMessage = {
    message: {
      data: rawBase64,
      messageId: 'msg_987654321',
      publishTime: new Date().toISOString()
    }
  };

  let linePushCalled = false;
  let linePushPayload = null;

  mockFetch([
    // Gemini API mock
    {
      match: (url) => url.includes('generativelanguage.googleapis.com'),
      respond: () => new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                detected_language: "ja",
                reply_a: "【丁寧】山田花子様、ご来店誠にありがとうございました。パスタをお気に召していただけて大変光栄です！",
                reply_b: "【親しみ】花子様、パスタの感想ありがとうございます！またいつでもいらしてくださいね！",
                reply_c: "【王道】この度はご来店いただき誠にありがとうございました。"
              })
            }]
          }
        }]
      }), { status: 200 })
    },
    // LINE Push API mock
    {
      match: (url) => url.includes('api.line.me/v2/bot/message/push'),
      respond: (url, method, init) => {
        linePushCalled = true;
        linePushPayload = JSON.parse(init.body);
        return new Response(JSON.stringify({}), { status: 200 });
      }
    }
  ]);

  const pubSubEnv = {
    ...envWithDb,
    GEMINI_API_KEY: 'test_gemini_key',
    LINE_CHANNEL_ACCESS_TOKEN: 'test_line_access_token',
    APP_URL: 'https://review-pilot.pages.dev'
  };

  const pubSubResult = await handlePubSubNotification(pubSubEnv, pubSubMessage, 'https://review-pilot.pages.dev');
  assert.strictEqual(pubSubResult.success, true);

  // D1 にレビューが正しく保存されたか検証
  const insertedRev = db._data.reviews.find(r => r.id === 'rev_pubsub_new_1');
  assert(insertedRev, "Pub/Subで受信したレビューがD1にINSERTされていること");
  assert.strictEqual(insertedRev.reviewer_name, '山田花子');
  assert.strictEqual(insertedRev.star_rating, 5);
  assert.strictEqual(insertedRev.comment, 'パスタが絶品でした！また来ます！');
  assert(insertedRev.generated_reply_a.includes('山田花子様'), "Geminiで生成された返信案Aが保存されていること");

  // reply_tokens が4種生成されているか検証
  const tokens = db._data.replyTokens.filter(t => t.review_id === 'rev_pubsub_new_1');
  assert.strictEqual(tokens.length, 4, "reply_a, reply_b, reply_c, manual_edit の4トークンが生成されていること");

  // LINE Push 通知がオーナーの line_user_id に送信されたか検証
  assert.strictEqual(linePushCalled, true);
  assert.strictEqual(linePushPayload.to, 'U_shibuya_line_user_123');
  const flexContents = JSON.stringify(linePushPayload.messages[0]);
  assert(flexContents.includes('山田花子'), "Flex Messageにレビュアー名が含まれていること");
  assert(flexContents.includes('/api/action/reply?token='), "1タップ返信用URIが含まれていること");
  console.log("  ✅ [PASS] 5.1 handlePubSubNotification: Pub/Subデコード〜Gemini3案生成〜D1保存〜LINEプッシュ通知");

  // ============================================================================
  console.log("\nSECTION 6: 定期巡回 Cron (pollNewReviews)");
  // ============================================================================

  // 6.1 GBP API からレビュー一覧を取得し、未保存の差分クチコミのみを検出・処理
  let pollGbpListCalled = false;
  let pollLinePushCalled = false;

  mockFetch([
    {
      match: (url) => url.includes('oauth2.googleapis.com/token'),
      respond: () => new Response(JSON.stringify({ access_token: 'ya29.live_token' }), { status: 200 })
    },
    // Gemini API mock
    {
      match: (url) => url.includes('generativelanguage.googleapis.com'),
      respond: () => new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                detected_language: "ja",
                reply_a: "【丁寧】佐藤次郎様、ピザをお褒めいただき誠にありがとうございます！",
                reply_b: "【親しみ】次郎様、濃厚チーズピザ気に入っていただけて嬉しいです！",
                reply_c: "【王道】この度はご来店いただき誠にありがとうございました。"
              })
            }]
          }
        }]
      }), { status: 200 })
    },
    // GBP Reviews List API mock
    {
      match: (url) => url.includes('mybusiness.googleapis.com/v4/accounts/acc_gbp_999/locations/loc_shibuya_100/reviews'),
      respond: () => {
        pollGbpListCalled = true;
        return new Response(JSON.stringify({
          reviews: [
            // 既存 (すでにD1にある)
            {
              name: 'accounts/acc_gbp_999/locations/loc_shibuya_100/reviews/rev_pubsub_new_1',
              reviewer: { displayName: '山田花子' },
              starRating: 'FIVE',
              comment: 'パスタが絶品でした！また来ます！'
            },
            // 新規 (D1に未保存のクチコミ)
            {
              name: 'accounts/acc_gbp_999/locations/loc_shibuya_100/reviews/rev_cron_new_2',
              reviewer: { displayName: '佐藤次郎' },
              starRating: 'FOUR',
              comment: 'ピザのチーズが濃厚で美味しかったです。'
            }
          ]
        }), { status: 200 });
      }
    },
    // LINE Push mock
    {
      match: (url) => url.includes('api.line.me/v2/bot/message/push'),
      respond: () => {
        pollLinePushCalled = true;
        return new Response(JSON.stringify({}), { status: 200 });
      }
    }
  ]);

  const pollResult = await pollNewReviews(pubSubEnv, 'https://review-pilot.pages.dev');
  assert.strictEqual(pollGbpListCalled, true);
  assert.strictEqual(pollResult.success, true);
  assert.strictEqual(pollResult.processedCount, 1, "未保存の1件のみが処理され、既存レビューは重複処理されないこと");

  const cronRev = db._data.reviews.find(r => r.id === 'rev_cron_new_2');
  assert(cronRev, "新着レビューがD1にINSERTされていること");
  assert.strictEqual(cronRev.reviewer_name, '佐藤次郎');
  assert.strictEqual(cronRev.star_rating, 4);
  assert.strictEqual(pollLinePushCalled, true, "Cron検知時も店舗オーナーへLINEプッシュ通知されること");
  console.log("  ✅ [PASS] 6.1 pollNewReviews: 差分新着クチコミ検知〜自動処理〜LINE通知");

  restoreFetch();

  console.log("\n================================================================");
  console.log("🎉 GBP連携 全テスト完全クリア: ALL 13 TEST CASES PASSED! 🎉");
  console.log("================================================================\n");
}

runGbpTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
