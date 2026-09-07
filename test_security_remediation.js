/**
 * ============================================================================
 * らくらくクチコミ返信（らくコミくん）
 * セキュリティ脆弱性＆不具合修正 完全検証テストスイート
 * ============================================================================
 */

import assert from 'assert';
import fs from 'fs';
import worker, {
  extractSessionToken,
  generateRepliesWithGemini,
  getFallbackReplies,
  createStripeCheckoutSession,
  handleStripeWebhook,
  handleLineEvent,
  verifyStripeSignature,
  getLocationReviews
} from './src/index.js';

console.log("================================================================");
console.log("🔒 ReviewPilot (らくコミくん) セキュリティ修正 完全検証テスト 🔒");
console.log("================================================================\n");

function createMockD1() {
  const users = [
    {
      id: 'usr_shibuya',
      email: 'owner@trattoria-shibuya.com',
      password_hash: 'd3de1d8eb1756105a9cbfd0ebeac9b790a7b817f1e684d01cb330ac9b36eabc5', // password123
      password_salt: 'a1b2c3d4e5f6789012345678abcdef01',
      name: 'TRATTORIA SHIBUYA オーナー',
      plan: 'pro',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: 'trialing',
      notification_email: 'owner@trattoria-shibuya.com',
      line_user_id: 'U_ORIGINAL_LINE_ID'
    },
    {
      id: 'usr_no_hash',
      email: 'nohash@example.com',
      password_hash: null,
      password_salt: null,
      name: 'No Hash User',
      plan: 'standard',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: 'trialing',
      notification_email: 'nohash@example.com',
      line_user_id: null
    }
  ];

  const sessions = [
    {
      id: 'sess_valid_shibuya',
      user_id: 'usr_shibuya',
      expires_at: '2099-01-01T00:00:00Z'
    }
  ];

  const locations = [
    {
      id: 'locations/184920481920',
      user_id: 'usr_shibuya',
      account_id: 'accounts/1098273645',
      location_name: 'TRATTORIA SHIBUYA (渋谷店)',
      category: 'イタリアンレストラン',
      address: '東京都渋谷区宇田川町12-3'
    }
  ];

  const reviews = [
    {
      id: 'reviews/101',
      location_id: 'locations/184920481920',
      reviewer_name: '田中 太郎 様',
      star_rating: 5,
      comment: '料理も接客も素晴らしかったです！',
      translated_comment: 'Translated text',
      review_created_at: '2026-09-01T12:00:00Z',
      reply_status: 'pending',
      generated_reply_a: '返信案A',
      generated_reply_b: '返信案B',
      generated_reply_c: '返信案C',
      final_reply_text: null,
      replied_at: null,
      created_at: '2026-09-01T12:00:00Z'
    }
  ];

  return {
    _users: users,
    _sessions: sessions,
    _locations: locations,
    _reviews: reviews,

    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM users') && sql.includes('WHERE email = ?')) {
                const email = args[0];
                return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
              }
              if (sql.includes('FROM users') && sql.includes('WHERE id = ?')) {
                const id = args[0];
                return users.find(u => u.id === id) || null;
              }
              if (sql.includes('FROM sessions s') && sql.includes('JOIN users u')) {
                const sessionId = args[0];
                const s = sessions.find(x => x.id === sessionId);
                if (!s) return null;
                const u = users.find(x => x.id === s.user_id);
                return u ? { ...u, session_id: s.id } : null;
              }
              if (sql.includes('FROM locations') && sql.includes('WHERE id = ?')) {
                const id = args[0];
                return locations.find(l => l.id === id) || null;
              }
              if (sql.includes('FROM locations') && sql.includes('WHERE location_name LIKE ?')) {
                const pattern = args[0].replace(/%/g, '');
                return locations.find(l => l.location_name.includes(pattern)) || null;
              }
              return null;
            },
            async all() {
              if (sql.includes('FROM locations') && sql.includes('WHERE user_id = ?')) {
                const userId = args[0];
                return { results: locations.filter(l => l.user_id === userId) };
              }
              if (sql.includes('FROM reviews') && (sql.includes('location_id = ?') || sql.includes('r.location_id = ?'))) {
                const locId = args[0];
                return { results: reviews.filter(r => r.location_id === locId) };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('UPDATE users') && sql.includes('SET line_user_id = ?')) {
                const lineUserId = args[0];
                const userId = args[1];
                const u = users.find(x => x.id === userId);
                if (u) {
                  u.line_user_id = lineUserId;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (sql.includes('UPDATE users') && sql.includes('WHERE id = ?')) {
                const customerId = args[0];
                const subscriptionId = args[1];
                const userId = args[2];
                const u = users.find(x => x.id === userId);
                if (u) {
                  u.stripe_customer_id = customerId;
                  u.stripe_subscription_id = subscriptionId;
                  u.subscription_status = 'trialing';
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (sql.includes('UPDATE users') && sql.includes('WHERE email = ?')) {
                const customerId = args[0];
                const subscriptionId = args[1];
                const email = args[2];
                const u = users.find(x => x.email === email);
                if (u) {
                  u.stripe_customer_id = customerId;
                  u.stripe_subscription_id = subscriptionId;
                  u.subscription_status = 'trialing';
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}

async function runTests() {
  let passed = 0;
  let total = 0;

  async function test(title, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${title}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  // ==========================================================================
  console.log("SECTION 1: AI連携・セキュリティ強化 (src/index.js)");
  // ==========================================================================

  await test("1.1 モデル名「gemini-3.5-flash-lite」および「x-goog-api-key」ヘッダー送信の検証", async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = {};

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('generativelanguage.googleapis.com')) {
        capturedUrl = url;
        capturedHeaders = opts?.headers || {};
        capturedBody = JSON.parse(opts?.body || '{}');
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  detected_language: "ja",
                  translated_comment: null,
                  reply_a: "AI返信A",
                  reply_a_ja: "AI返信A",
                  reply_b: "AI返信B",
                  reply_b_ja: "AI返信B",
                  reply_c: "AI返信C",
                  reply_c_ja: "AI返信C"
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url, opts);
    };

    try {
      const res = await generateRepliesWithGemini({ GEMINI_API_KEY: 'test-secure-api-key-999' }, {
        rating: 5,
        comment: '美味しいパスタでした！',
        category: 'イタリアン',
        locationName: '渋谷店'
      });

      assert.strictEqual(res.reply_a, "AI返信A");
      // モデル名検証
      assert.ok(capturedUrl.includes('models/gemini-3.5-flash-lite:generateContent'),
        `URL should contain gemini-3.5-flash-lite, was: ${capturedUrl}`);
      // URLクエリにキーが含まれていないこと
      assert.ok(!capturedUrl.includes('key='), "URL query should not contain api key");
      // HTTPヘッダー x-goog-api-key の検証
      assert.strictEqual(capturedHeaders['x-goog-api-key'], 'test-secure-api-key-999');

      // プロンプトインジェクション対策: system_instruction 分離検証
      assert.ok(capturedBody.system_instruction, "Request should contain system_instruction");
      const sysText = capturedBody.system_instruction.parts[0].text;
      assert.ok(sysText.includes('<customer_review>'), "system_instruction should reference customer_review tag");
      assert.ok(sysText.includes('一切無視'), "system_instruction should include ignore instructions guardrail");

      // クチコミ本文の <customer_review> タグ囲み検証
      const userText = capturedBody.contents[0].parts[0].text;
      assert.ok(userText.includes('<customer_review>'), "Prompt should wrap review in <customer_review>");
      assert.ok(userText.includes('美味しいパスタでした！'), "Prompt should include review comment");
      assert.ok(userText.includes('</customer_review>'), "Prompt should close </customer_review>");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test("1.2 /api/generate - 未ログイン (認証なし) 時の 401 遮断", async () => {
    const db = createMockD1();
    const req = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, comment: '最高でした' })
    });
    const res = await worker.fetch(req, { DB: db, GEMINI_API_KEY: 'mock_key' });
    assert.strictEqual(res.status, 401, "未認証リクエストは401で拒絶されること");
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  await test("1.3 /api/generate - 2,000文字超過コメントの 400 Bad Request 遮断", async () => {
    const db = createMockD1();
    const longComment = 'あ'.repeat(2001);
    const req = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sess_valid_shibuya'
      },
      body: JSON.stringify({ rating: 5, comment: longComment })
    });
    const res = await worker.fetch(req, { DB: db, GEMINI_API_KEY: 'mock_key' });
    assert.strictEqual(res.status, 400, "2000文字超は400で拒絶されること");
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /2,000文字/);
  });

  await test("1.4 /api/generate - Gemini API障害時の自動フォールバック (クラッシュ防止フェイルセーフ)", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('generativelanguage.googleapis.com')) {
        return new Response("Internal Gemini Error", { status: 500 });
      }
      return originalFetch(url, opts);
    };

    try {
      const db = createMockD1();
      const req = new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sess_valid_shibuya'
        },
        body: JSON.stringify({ rating: 5, comment: '美味しい料理でした' })
      });
      const res = await worker.fetch(req, { DB: db, GEMINI_API_KEY: 'mock_key' });
      assert.strictEqual(res.status, 200, "Geminiエラー時もクラッシュせず200でフォールバック返信");
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.replies.reply_a, "フォールバック返信案Aが取得できること");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test("1.5 低評価 (★1〜3) フォールバック時の全キー網羅 (reply_a_ja 等)", () => {
    const fallbackLow = getFallbackReplies(2, '店員の態度が悪かったです', 'カフェ');
    assert.strictEqual(fallbackLow.detected_language, 'ja');
    assert.strictEqual(fallbackLow.translated_comment, null);
    assert.ok(fallbackLow.reply_a, "reply_a が存在すること");
    assert.ok(fallbackLow.reply_a_ja, "reply_a_ja が存在すること");
    assert.ok(fallbackLow.reply_b, "reply_b が存在すること");
    assert.ok(fallbackLow.reply_b_ja, "reply_b_ja が存在すること");
    assert.ok(fallbackLow.reply_c, "reply_c が存在すること");
    assert.ok(fallbackLow.reply_c_ja, "reply_c_ja が存在すること");
  });

  // ==========================================================================
  console.log("\nSECTION 2: Stripe決済＆Webhook強化 (src/index.js)");
  // ==========================================================================

  await test("2.1 createStripeCheckoutSession: client_reference_id = user.id & metadata.userId = user.id の付与", async () => {
    let capturedStripeParams = {};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('api.stripe.com/v1/checkout/sessions')) {
        const bodyStr = opts.body;
        const search = new URLSearchParams(bodyStr);
        for (const [k, v] of search.entries()) {
          capturedStripeParams[k] = v;
        }
        return new Response(JSON.stringify({
          id: 'cs_test_123456',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123456'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url, opts);
    };

    try {
      const res = await createStripeCheckoutSession(
        { STRIPE_SECRET_KEY: 'sk_test_123', STRIPE_PRICE_ID: 'price_123' },
        'http://localhost',
        { customerEmail: 'test@example.com', user: { id: 'usr_shibuya' } }
      );
      assert.strictEqual(res.success, true);
      assert.strictEqual(capturedStripeParams['client_reference_id'], 'usr_shibuya');
      assert.strictEqual(capturedStripeParams['metadata[userId]'], 'usr_shibuya');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test("2.2 handleStripeWebhook: client_reference_id によるユーザー特定＆更新", async () => {
    const db = createMockD1();
    const eventPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'usr_shibuya',
          customer: 'cus_stripe_new_999',
          subscription: 'sub_stripe_new_999',
          customer_email: 'different_email_at_stripe@example.com' // メールアドレス相違ケース
        }
      }
    };

    await handleStripeWebhook({ DB: db }, JSON.stringify(eventPayload), 'sig_dummy');

    const updatedUser = db._users.find(u => u.id === 'usr_shibuya');
    assert.strictEqual(updatedUser.stripe_customer_id, 'cus_stripe_new_999');
    assert.strictEqual(updatedUser.stripe_subscription_id, 'sub_stripe_new_999');
  });

  await test("2.3 Stripe Webhook 署名検証のフェイルクローズ化 (STRIPE_WEBHOOK_SECRET 未設定時は 500 遮断)", async () => {
    const req = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=123456,v1=abc'
      },
      body: JSON.stringify({ type: 'checkout.session.completed' })
    });
    // STRIPE_WEBHOOK_SECRET が存在しない env
    const res = await worker.fetch(req, {});
    assert.strictEqual(res.status, 500, "STRIPE_WEBHOOK_SECRET未設定時は500で安全に遮断されること");
    const text = await res.text();
    assert.ok(text.includes('STRIPE_WEBHOOK_SECRET is not configured'));
  });

  // ==========================================================================
  console.log("\nSECTION 3: 認証・認可・セッション強化 (src/index.js)");
  // ==========================================================================

  await test("3.1 extractSessionToken: URLクエリ (?session_id=...) の取得完全削除 (Cookie / Bearer のみ)", () => {
    const reqQueryOnly = new Request('http://localhost/api/reviews?session_id=sess_leaked_in_url', {
      method: 'GET'
    });
    const token = extractSessionToken(reqQueryOnly);
    assert.strictEqual(token, null, "URLクエリパラメータからのセッショントークン抽出は null となること");

    const reqHeader = new Request('http://localhost/api/reviews', {
      headers: { 'Authorization': 'Bearer sess_in_header' }
    });
    assert.strictEqual(extractSessionToken(reqHeader), 'sess_in_header');

    const reqCookie = new Request('http://localhost/api/reviews', {
      headers: { 'Cookie': 'session_id=sess_in_cookie' }
    });
    assert.strictEqual(extractSessionToken(reqCookie), 'sess_in_cookie');
  });

  await test("3.2 バックドアパスワード (password123 / demo1234) の完全撤廃", async () => {
    const db = createMockD1();
    // パスワードハッシュ未設定ユーザーで password123 ログイン試行
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nohash@example.com',
        password: 'password123'
      })
    });
    const res = await worker.fetch(req, { DB: db });
    assert.strictEqual(res.status, 401, "バックドアによるログインは拒絶され401になること");
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  await test("3.3 /api/line/test-push: 任意 body.userId を拒否し、ログイン自店舗の line_user_id のみ使用", async () => {
    let capturedPushTarget = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('api.line.me/v2/bot/message/push')) {
        const body = JSON.parse(opts.body);
        capturedPushTarget = body.to;
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return originalFetch(url, opts);
    };

    try {
      const db = createMockD1();
      // 攻撃者が他人の userId (U_ATTACK_TARGET) を body に指定
      const req = new Request('http://localhost/api/line/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sess_valid_shibuya'
        },
        body: JSON.stringify({ userId: 'U_ATTACK_TARGET_SPAM' })
      });
      const res = await worker.fetch(req, {
        DB: db,
        LINE_CHANNEL_ACCESS_TOKEN: 'mock_line_token'
      });
      assert.strictEqual(res.status, 200);
      // 送信先が攻撃者のリクエストした U_ATTACK_TARGET_SPAM ではなく自店舗の U_ORIGINAL_LINE_ID であること
      assert.strictEqual(capturedPushTarget, 'U_ORIGINAL_LINE_ID',
        "Push target must strictly be login user's own line_user_id");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ==========================================================================
  console.log("\nSECTION 4: LINE連携＆翻訳DBスキーマ (src/index.js, schema.sql)");
  // ==========================================================================

  await test("4.1 LINE Webhook: 店舗ID受信時に users.line_user_id が UPDATE 保存されること", async () => {
    const db = createMockD1();
    const event = {
      type: 'message',
      replyToken: 'reply_token_123',
      source: {
        userId: 'U_NEW_LINKED_LINE_USER_777'
      },
      message: {
        type: 'text',
        text: 'locations/184920481920'
      }
    };

    let replySent = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('api.line.me/v2/bot/message/reply')) {
        replySent = true;
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return originalFetch(url, opts);
    };

    try {
      await handleLineEvent({ DB: db, LINE_CHANNEL_ACCESS_TOKEN: 'mock_token' }, event, 'http://localhost');
      const updatedUser = db._users.find(u => u.id === 'usr_shibuya');
      assert.strictEqual(updatedUser.line_user_id, 'U_NEW_LINKED_LINE_USER_777',
        "users.line_user_id should be updated with event.source.userId");
      assert.strictEqual(replySent, true, "LINE reply message should be sent");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test("4.2 schema.sql: reviews テーブルに translated_comment TEXT が存在すること", () => {
    const schemaContent = fs.readFileSync('schema.sql', 'utf8');
    assert.ok(schemaContent.includes('translated_comment TEXT'), "schema.sql must contain translated_comment TEXT in reviews table");
  });

  await test("4.3 getLocationReviews: SELECT クエリに r.translated_comment が含まれ返却されること", async () => {
    const db = createMockD1();
    const reviews = await getLocationReviews(db, 'locations/184920481920', 'usr_shibuya');
    assert.strictEqual(reviews.length, 1);
    assert.strictEqual(reviews[0].translated_comment, 'Translated text',
      "getLocationReviews should retrieve translated_comment");
  });

  console.log("\n================================================================");
  console.log(`🎉 全セキュリティ検証成功: ${passed}/${total} TESTS PASSED! 🎉`);
  console.log("================================================================");
}

runTests().catch(err => {
  console.error("Security Test Suite Error:", err);
  process.exit(1);
});
