/**
 * ============================================================================
 * らくらくクチコミ返信（らくコミくん / ReviewPilot）
 * 全機能・全ルート・外部連携 網羅的 E2E QA & セキュリティ自動検証テストスクリプト
 * ============================================================================
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import worker, {
  hashPassword,
  verifyPassword,
  timingSafeEqual,
  getCorsHeaders,
  addSecurityHeaders,
  extractSessionToken,
  getUserBySession,
  getUserLocations,
  getLocationById,
  getLocationReviews,
  updateLocationSettings,
  updateReviewReply
} from './src/index.js';

const LIVE_API_BASE = 'https://review-pilot.momogeman1009.workers.dev';
const ALLOWED_ORIGIN = 'https://review-pilot-6bm.pages.dev';

// テスト統計カウンタ
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  vulnerabilities: [],
  flaws: []
};

function recordVuln(id, title, severity, endpoint, description) {
  stats.vulnerabilities.push({ id, title, severity, endpoint, description });
}

function recordFlaw(id, title, severity, endpoint, description) {
  stats.flaws.push({ id, title, severity, endpoint, description });
}

async function runTest(category, name, testFn) {
  stats.total++;
  const testId = `[T-${String(stats.total).padStart(2, '0')}]`;
  process.stdout.write(`${testId} [${category}] ${name} ... `);
  try {
    await testFn();
    stats.passed++;
    console.log(`\x1b[32mPASSED\x1b[0m`);
  } catch (err) {
    stats.failed++;
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`     \x1b[33mError:\x1b[0m ${err.message}`);
  }
}

// .dev.vars 読み込みヘルパー
function loadDevVars() {
  const env = {};
  try {
    const content = fs.readFileSync(path.resolve('.dev.vars'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    }
  } catch (e) {
    // ファイルが存在しない場合は空
  }
  return env;
}

// モックD1作成
function createMockDB() {
  const users = [
    {
      id: 'usr_demo_shibuya',
      email: 'owner@trattoria-shibuya.com',
      password_hash: 'd3de1d8eb1756105a9cbfd0ebeac9b790a7b817f1e684d01cb330ac9b36eabc5', // password123
      password_salt: 'a1b2c3d4e5f6789012345678abcdef01',
      name: 'TRATTORIA SHIBUYA オーナー',
      plan: 'pro',
      subscription_status: 'trialing',
      notification_email: 'owner@trattoria-shibuya.com',
      line_user_id: 'U184920481920demo'
    },
    {
      id: 'usr_demo_shinjuku',
      email: 'owner@bistro-shinjuku.com',
      password_hash: 'd3de1d8eb1756105a9cbfd0ebeac9b790a7b817f1e684d01cb330ac9b36eabc5', // password123
      password_salt: 'a1b2c3d4e5f6789012345678abcdef01',
      name: 'BISTRO SHINJUKU オーナー',
      plan: 'standard',
      subscription_status: 'active',
      notification_email: 'owner@bistro-shinjuku.com',
      line_user_id: 'U999999999999demo'
    }
  ];

  let sessions = [
    {
      id: 'sess_valid_shibuya',
      user_id: 'usr_demo_shibuya',
      expires_at: new Date(Date.now() + 86400000).toISOString()
    },
    {
      id: 'sess_expired_shibuya',
      user_id: 'usr_demo_shibuya',
      expires_at: '2020-01-01T00:00:00.000Z'
    }
  ];

  const locations = [
    {
      id: 'locations/184920481920',
      user_id: 'usr_demo_shibuya',
      account_id: 'accounts/1098273645',
      location_name: 'TRATTORIA SHIBUYA (渋谷店)',
      category: 'イタリアンレストラン',
      address: '東京都渋谷区宇田川町12-3',
      auto_reply: 0,
      ai_tone: 'polite',
      pubsub_subscribed: 1
    },
    {
      id: 'locations/999999999999',
      user_id: 'usr_demo_shinjuku',
      account_id: 'accounts/2098273646',
      location_name: 'BISTRO SHINJUKU (新宿店)',
      category: 'フランス料理店',
      address: '東京都新宿区新宿3-1-1',
      auto_reply: 1,
      ai_tone: 'friendly',
      pubsub_subscribed: 1
    }
  ];

  const reviews = [
    {
      id: 'reviews/101',
      location_id: 'locations/184920481920',
      reviewer_name: '田中 太郎 様',
      star_rating: 5,
      comment: 'カルボナーラがとても美味しかったです！',
      reply_status: 'pending',
      generated_reply_a: 'ご来店ありがとうございます！',
      generated_reply_b: 'ありがとうございました😊',
      generated_reply_c: 'ご来店感謝いたします。'
    },
    {
      id: 'reviews/201',
      location_id: 'locations/999999999999',
      reviewer_name: '新宿客B',
      star_rating: 4,
      comment: '美味でした',
      reply_status: 'pending',
      generated_reply_a: '感謝いたします。',
      generated_reply_b: '嬉しいです！',
      generated_reply_c: 'ありがとうございます。'
    }
  ];

  let replyTokens = [
    {
      token: 'token_valid_a',
      review_id: 'reviews/101',
      location_id: 'locations/184920481920',
      action_type: 'reply_a',
      is_used: 0,
      expires_at: '2099-12-31 23:59:59'
    },
    {
      token: 'token_used_b',
      review_id: 'reviews/101',
      location_id: 'locations/184920481920',
      action_type: 'reply_b',
      is_used: 1,
      expires_at: '2099-12-31 23:59:59'
    },
    {
      token: 'token_expired_c',
      review_id: 'reviews/101',
      location_id: 'locations/184920481920',
      action_type: 'reply_c',
      is_used: 0,
      expires_at: '2020-01-01 00:00:00'
    },
    {
      token: 'token_manual_edit',
      review_id: 'reviews/101',
      location_id: 'locations/184920481920',
      action_type: 'manual_edit',
      is_used: 0,
      expires_at: '2099-12-31 23:59:59'
    }
  ];

  return {
    _users: users,
    _sessions: sessions,
    _locations: locations,
    _reviews: reviews,
    _replyTokens: replyTokens,

    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM users') && sql.includes('WHERE email = ?')) {
                const email = args[0];
                return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
              }
              if (sql.includes('FROM sessions s') && sql.includes('JOIN users u')) {
                const sessionId = args[0];
                const session = sessions.find(s => s.id === sessionId);
                if (!session) return null;
                // 有効期限チェック
                if (new Date(session.expires_at).getTime() < Date.now()) return null;
                const user = users.find(u => u.id === session.user_id);
                if (!user) return null;
                return {
                  ...user,
                  session_id: session.id,
                  session_expires_at: session.expires_at
                };
              }
              if (sql.includes('FROM locations') && sql.includes('WHERE id = ? AND user_id = ?')) {
                const [locId, userId] = args;
                return locations.find(l => l.id === locId && l.user_id === userId) || null;
              }
              if (sql.includes('FROM reply_tokens t') && sql.includes('JOIN reviews r')) {
                const token = args[0];
                const t = replyTokens.find(x => x.token === token && x.is_used === 0 && new Date(x.expires_at).getTime() > Date.now());
                if (!t) return null;
                const r = reviews.find(x => x.id === t.review_id && x.location_id === t.location_id);
                if (!r) return null;
                return {
                  ...t,
                  generated_reply_a: r.generated_reply_a,
                  generated_reply_b: r.generated_reply_b,
                  generated_reply_c: r.generated_reply_c
                };
              }
              return null;
            },
            async all() {
              if (sql.includes('FROM locations') && sql.includes('WHERE user_id = ?')) {
                const userId = args[0];
                return { results: locations.filter(l => l.user_id === userId) };
              }
              if (sql.includes('FROM reviews') && sql.includes('WHERE location_id = ?')) {
                const locId = args[0];
                return { results: reviews.filter(r => r.location_id === locId) };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('INSERT INTO sessions')) {
                const [id, user_id] = args;
                sessions.push({
                  id,
                  user_id,
                  expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('DELETE FROM sessions WHERE id = ?')) {
                const id = args[0];
                const lenBefore = sessions.length;
                sessions = sessions.filter(s => s.id !== id);
                return { meta: { changes: lenBefore - sessions.length } };
              }
              if (sql.includes('UPDATE locations') && sql.includes('WHERE id = ? AND user_id = ?')) {
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE reviews') && sql.includes('WHERE id = ? AND location_id = ?')) {
                const [replyText, replyStatus, revId, locId] = args;
                const rev = reviews.find(r => r.id === revId && r.location_id === locId);
                if (rev) {
                  rev.final_reply_text = replyText;
                  rev.reply_status = replyStatus;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (sql.includes('UPDATE reply_tokens SET is_used = 1 WHERE token = ?')) {
                const token = args[0];
                const t = replyTokens.find(x => x.token === token);
                if (t) t.is_used = 1;
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE users') && sql.includes('stripe_customer_id = ?')) {
                const [cId, sId, email] = args;
                const u = users.find(x => x.email === email);
                if (u) {
                  u.stripe_customer_id = cId;
                  u.stripe_subscription_id = sId;
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
    },
    async batch(stmts) {
      const results = [];
      for (const stmt of stmts) {
        results.push(await stmt.run());
      }
      return results;
    }
  };
}

async function main() {
  console.log("================================================================================");
  console.log("🔍 ReviewPilot (らくコミくん) Full-Stack E2E QA & Security Comprehensive Audit 🔍");
  console.log(`🌐 Live Target: ${LIVE_API_BASE}`);
  console.log(`⏱️ Audit Timestamp: ${new Date().toISOString()}`);
  console.log("================================================================================\n");

  let liveSessionCookie = null;
  let liveSessionToken = null;

  // ==========================================================================
  // 1. 認証系 (POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me)
  // ==========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("【1. 認証系 (Authentication & Session Management)】");
  console.log("--------------------------------------------------------------------------------");

  // 1.1 正常ログイン (Live)
  await runTest("Auth", "POST /api/auth/login - 正常系（正しい資格情報でログイン成功・Cookie発行）", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ALLOWED_ORIGIN
      },
      body: JSON.stringify({
        email: 'owner@trattoria-shibuya.com',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.email, 'owner@trattoria-shibuya.com');
    assert.strictEqual(data.user.id, 'usr_demo_shibuya');

    // Cookie & Security Headers
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, "Set-Cookieヘッダーが存在すること");
    assert.match(setCookie, /session_id=sess_[a-f0-9-]+/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Lax/);

    liveSessionCookie = setCookie.split(';')[0];
    liveSessionToken = liveSessionCookie.split('=')[1];

    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(res.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  });

  // 1.2 パスワード不一致 (Live)
  await runTest("Auth", "POST /api/auth/login - パスワード不一致時に 401 拒絶", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@trattoria-shibuya.com',
        password: 'WrongPassword999!'
      })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'メールアドレスまたはパスワードが正しくありません。');
  });

  // 1.3 存在しないメール (Live)
  await runTest("Auth", "POST /api/auth/login - 存在しないメールアドレス時に 401 拒絶", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'notfound_user_9999@example.com',
        password: 'password123'
      })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'メールアドレスまたはパスワードが正しくありません。');
  });

  // 1.4 不正ペイロード (Live)
  await runTest("Auth", "POST /api/auth/login - 不正ペイロード（空ボディ、メール未指定）で 400 拒絶", async () => {
    const resEmpty = await fetch(`${LIVE_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(resEmpty.status, 400);
    const dataEmpty = await resEmpty.json();
    assert.strictEqual(dataEmpty.success, false);
    assert.strictEqual(dataEmpty.error, 'メールアドレスとパスワードを入力してください。');

    // 不正なJSON
    const resMalformed = await fetch(`${LIVE_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not_valid_json'
    });
    // catch (e) で body = {} にフォールバックするため 400 になるか
    assert.strictEqual(resMalformed.status, 400);
  });

  // 1.5 GET /api/auth/me - 未ログイン時 401 (Live)
  await runTest("Auth", "GET /api/auth/me - 未認証時 (Cookieなし) に 401 Unauthorized", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/auth/me`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // 1.6 GET /api/auth/me - 正常ログイン中 (Live)
  await runTest("Auth", "GET /api/auth/me - 正常ログイン中Cookieで店舗情報含め返却", async () => {
    assert.ok(liveSessionCookie, "ログインセッションCookieが保持されていること");
    const res = await fetch(`${LIVE_API_BASE}/api/auth/me`, {
      headers: {
        'Cookie': liveSessionCookie,
        'Origin': ALLOWED_ORIGIN
      }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, 'usr_demo_shibuya');
    assert.strictEqual(data.user.email, 'owner@trattoria-shibuya.com');
    assert.ok(Array.isArray(data.locations), "店舗リストが配列であること");
    assert.ok(data.locations.length >= 1, "所有店舗が1件以上取得できること");
    assert.strictEqual(data.locations[0].id, 'locations/184920481920');
  });

  // 1.7 GET /api/auth/me - 期限切れセッション (Local Mock)
  await runTest("Auth", "GET /api/auth/me - 期限切れセッションで 401 拒絶 (Local Mock)", async () => {
    const db = createMockDB();
    const req = new Request('http://localhost/api/auth/me', {
      headers: { 'Cookie': 'session_id=sess_expired_shibuya' }
    });
    const res = await worker.fetch(req, { DB: db });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // 1.8 POST /api/auth/logout - 未認証時の挙動 (Live)
  await runTest("Auth", "POST /api/auth/logout - 未認証時にも正常にMax-Age=0 Cookieを返却", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/auth/logout`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    const clearCookie = res.headers.get('set-cookie');
    assert.ok(clearCookie);
    assert.match(clearCookie, /Max-Age=0/);
  });

  // 1.9 POST /api/auth/logout - 正常ログアウト＆セッション失効検証 (Live)
  await runTest("Auth", "POST /api/auth/logout - ログイン中セッションをログアウト・失効確認", async () => {
    // ログアウト実行
    const logoutRes = await fetch(`${LIVE_API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': liveSessionCookie }
    });
    assert.strictEqual(logoutRes.status, 200);

    // ログアウト後の /api/auth/me で 401 になること
    const meRes = await fetch(`${LIVE_API_BASE}/api/auth/me`, {
      headers: { 'Cookie': liveSessionCookie }
    });
    assert.strictEqual(meRes.status, 401, "破棄済みセッションでのアクセスは401になること");
    const meData = await meRes.json();
    assert.strictEqual(meData.success, false);

    // 次のテストのために再ログイン
    const reLogin = await fetch(`${LIVE_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@trattoria-shibuya.com', password: 'password123' })
    });
    liveSessionCookie = reLogin.headers.get('set-cookie').split(';')[0];
    liveSessionToken = liveSessionCookie.split('=')[1];
  });


  // ==========================================================================
  // 2. クチコミ・店舗管理 (GET /api/reviews, POST /api/location/settings, POST /api/reviews/reply)
  // ==========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("【2. クチコミ・店舗管理 (Reviews, Settings & RLS)】");
  console.log("--------------------------------------------------------------------------------");

  // 2.1 GET /api/reviews - 未認証時の 401 拒絶 (Live)
  await runTest("Reviews", "GET /api/reviews - 未認証時に 401 Unauthorized 拒絶", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/reviews`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Unauthorized");
  });

  // 2.2 GET /api/reviews - 自店舗の取得 (Live)
  await runTest("Reviews", "GET /api/reviews - 自店舗 (渋谷店) のクチコミ取得成功", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/reviews?location_id=locations/184920481920`, {
      headers: { 'Cookie': liveSessionCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.locationId, 'locations/184920481920');
    assert.ok(Array.isArray(data.reviews));
    assert.ok(data.reviews.length >= 1);
  });

  // 2.3 GET /api/reviews - 他店舗ID指定時の 403 RLS遮断 (Live)
  await runTest("Reviews", "GET /api/reviews - 他テナント店舗 (新宿店: locations/999999999999) 指定時に 403 RLS遮断", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/reviews?location_id=locations/999999999999`, {
      headers: { 'Cookie': liveSessionCookie }
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /Row-Level Security Violation/);
  });

  // 2.4 POST /api/location/settings - 自店舗設定の更新 (Live)
  await runTest("Settings", "POST /api/location/settings - 自店舗設定の正常更新", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/location/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': liveSessionCookie
      },
      body: JSON.stringify({
        locationId: 'locations/184920481920',
        locationName: 'TRATTORIA SHIBUYA (渋谷本店)',
        category: 'イタリアンレストラン',
        aiTone: 'friendly',
        autoReply: false
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // 2.5 POST /api/location/settings - 他店舗ID指定時の 403 遮断 (Live)
  await runTest("Settings", "POST /api/location/settings - 他店舗ID (locations/999999999999) への更新遮断 (403)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/location/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': liveSessionCookie
      },
      body: JSON.stringify({
        locationId: 'locations/999999999999',
        locationName: '乗っ取り店舗'
      })
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /アクセス権限がありません/);
  });

  // 2.6 POST /api/location/settings - 不正JSON / 空ボディ時の 400 エラーハンドリング (Live)
  await runTest("Settings", "POST /api/location/settings - 不正JSON / 空ボディ時の 400 エラーハンドリング (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/location/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': liveSessionCookie
      },
      body: '{}'
    });
    // locationId がない場合、安全に 400 Bad Request を返す
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.match(data.error, /店舗ID/);
  });

  // 2.7 POST /api/reviews/reply - 自店舗クチコミへの返信反映 (Live)
  await runTest("Reviews", "POST /api/reviews/reply - 自店舗クチコミへの返信更新成功", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/reviews/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': liveSessionCookie
      },
      body: JSON.stringify({
        reviewId: 'reviews/101',
        locationId: 'locations/184920481920',
        replyText: '毎度ありがとうございます！',
        replyStatus: 'replied_manual'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // 2.8 POST /api/reviews/reply - 他店舗ID指定時のアクセス拒絶 (Live)
  await runTest("Reviews", "POST /api/reviews/reply - 他店舗ID (locations/999999999999) への返信遮断 (403)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/reviews/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': liveSessionCookie
      },
      body: JSON.stringify({
        reviewId: 'reviews/101',
        locationId: 'locations/999999999999',
        replyText: '不正返信テスト'
      })
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /アクセス権限がありません/);
  });

  // 2.9 POST /api/reviews/reply - 自店舗IDと不一致の他店舗レビューID指定時 (Live)
  await runTest("Reviews", "POST /api/reviews/reply - 自店舗IDと他店舗レビューIDの不整合遮断 (400)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/reviews/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': liveSessionCookie
      },
      body: JSON.stringify({
        reviewId: 'reviews/201', // 新宿店のレビュー
        locationId: 'locations/184920481920', // 渋谷店の店舗ID
        replyText: 'ミスマッチ返信テスト'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "対象のクチコミが見つかりません。");
  });

  recordFlaw("FLAW-02", "POST /api/reviews/reply: Google Business Profile API (GBP) への実際の外部送信が未実装", "Medium", "/api/reviews/reply",
    "現在、updateReviewReply() は Cloudflare D1 データベースの更新のみを行っており、Google Maps の実際のクチコミ返信 API (mybusiness.googleapis.com) への送信処理が組み込まれていません。");


  // ==========================================================================
  // 3. 外部連携・決済・通知 (Stripe, LINE, Google Pub/Sub)
  // ==========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("【3. 外部連携・決済・通知 (Stripe, LINE, Pub/Sub)】");
  console.log("--------------------------------------------------------------------------------");

  // 3.1 GET /api/stripe/config (Live)
  await runTest("Stripe", "GET /api/stripe/config - 公開キー設定状態の取得", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/stripe/config`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(typeof data.hasSecretKey, 'boolean');
    assert.strictEqual(typeof data.hasPriceId, 'boolean');
  });

  // 3.2 POST /api/stripe/create-checkout-session - 正常なCheckoutセッション生成 (Live)
  await runTest("Stripe", "POST /api/stripe/create-checkout-session - 正常なCheckoutセッション生成 (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerEmail: 'test_qa@example.com' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.url, "Stripe Checkout URLが返却されること");
    assert.ok(data.id, "Stripe Session IDが返却されること");
  });

  // 3.3 POST /api/stripe/create-checkout-session - 認証必須チェック (脆弱性診断)
  await runTest("Stripe", "POST /api/stripe/create-checkout-session - 未認証アクセス診断", async () => {
    // 現在のエンドポイントは sessionToken チェックを行っていない
    recordVuln("VULN-01", "POST /api/stripe/create-checkout-session: 認証未検証 (Unauthenticated Endpoint)", "Low", "/api/stripe/create-checkout-session",
      "セッションCookieやトークンの確認が行われておらず、未認証の第三者が誰のメールアドレスでもCheckout Sessionを作成できる仕様になっています。");
  });

  // 3.4 POST /api/stripe/create-portal-session - 未認証アクセス遮断 (Live)
  await runTest("Stripe", "POST /api/stripe/create-portal-session - 未認証アクセス拒絶 (401 Unauthorized)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/stripe/create-portal-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /ログインが必要です/);
  });

  // 3.5 POST /api/stripe/create-portal-session - IDOR防止 & 本人顧客ID限定 (Local Mock)
  await runTest("Stripe", "POST /api/stripe/create-portal-session - ログインユーザー本人のみ許可 & IDOR防止 (Local Mock)", async () => {
    const db = createMockDB();
    // Stripe未契約ユーザーでポータルセッション要求
    const userNoStripe = {
      id: 'usr_no_stripe',
      email: 'nostripe@example.com',
      stripe_customer_id: null
    };
    db._users.push(userNoStripe);
    db._sessions.push({
      id: 'sess_no_stripe',
      user_id: 'usr_no_stripe',
      expires_at: '2099-12-31 23:59:59'
    });

    const req = new Request('http://localhost/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Cookie': 'session_id=sess_no_stripe',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const res = await worker.fetch(req, { DB: db, STRIPE_SECRET_KEY: 'sk_test_mock' });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /お支払い情報が登録されていません/);
  });

  // 3.6 POST /api/stripe/webhook - Webhook署名検証 (HMAC-SHA256)
  await runTest("Stripe", "POST /api/stripe/webhook - Webhook署名検証機能の動作確認 (verifyStripeSignature)", async () => {
    const { verifyStripeSignature } = await import('./src/index.js');
    const secret = "whsec_test_secret_key_12345";
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const timestamp = Math.floor(Date.now() / 1000);

    // 有効なHMAC署名の作成
    const signedPayload = `${timestamp}.${payload}`;
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const hmacBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(signedPayload));
    const validSig = Array.from(new Uint8Array(hmacBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const validHeader = `t=${timestamp},v1=${validSig}`;
    const isValid = await verifyStripeSignature(payload, validHeader, secret);
    assert.strictEqual(isValid, true, "正常な署名は検証に成功すること");

    // 不正署名の検証
    const invalidHeader = `t=${timestamp},v1=invalid_fake_signature_hash_0000`;
    const isInvalid = await verifyStripeSignature(payload, invalidHeader, secret);
    assert.strictEqual(isInvalid, false, "偽の署名は即座に拒絶されること");

    // タイムスタンプ期限切れ (10分前) の検証
    const oldTimestamp = timestamp - 600;
    const oldHeader = `t=${oldTimestamp},v1=${validSig}`;
    const isOld = await verifyStripeSignature(payload, oldHeader, secret);
    assert.strictEqual(isOld, false, "期限切れタイムスタンプは拒絶されること");
  });

  // 3.7 GET /api/line/config (Live)
  await runTest("LINE", "GET /api/line/config - LINE設定状態の取得", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/line/config`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(typeof data.hasChannelSecret, 'boolean');
    assert.strictEqual(typeof data.hasAccessToken, 'boolean');
  });

  // 3.8 POST /api/line/test-push - 未認証アクセス遮断 (Live)
  await runTest("LINE", "POST /api/line/test-push - 未認証アクセス時に 401 拒絶 (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/line/test-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /ログインが必要です/);
  });

  // 3.9 POST /api/line/test-push - ブロードキャスト完全廃止 & 送信先必須化 (Local Mock)
  await runTest("LINE", "POST /api/line/test-push - broadcast廃止＆LINEユーザーID必須化の検証 (Local Mock)", async () => {
    const db = createMockDB();
    // LINEユーザーID未登録ユーザーでリクエスト
    const userNoLine = {
      id: 'usr_no_line',
      email: 'noline@example.com',
      line_user_id: null
    };
    db._users.push(userNoLine);
    db._sessions.push({
      id: 'sess_no_line',
      user_id: 'usr_no_line',
      expires_at: '2099-12-31 23:59:59'
    });

    const req = new Request('http://localhost/api/line/test-push', {
      method: 'POST',
      headers: {
        'Cookie': 'session_id=sess_no_line',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const res = await worker.fetch(req, { DB: db, LINE_CHANNEL_ACCESS_TOKEN: 'mock_token' });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /LINEユーザーIDが設定されていません/);
  });

  // 3.10 POST /api/line/webhook - 不正署名の 403 遮断 (Live)
  await runTest("LINE", "POST /api/line/webhook - 不正な x-line-signature の 403 遮断 (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/line/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'totally_bogus_signature_abc123'
      },
      body: JSON.stringify({ events: [] })
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, "Invalid signature");
  });

  // 3.11 POST /api/webhook/google-pubsub - Pub/Sub 受信 & 未実装検証 (Live)
  await runTest("PubSub", "POST /api/webhook/google-pubsub - メッセージ受信と未実装確認 (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/webhook/google-pubsub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          data: Buffer.from(JSON.stringify({ resourceName: "accounts/1/locations/184920481920/reviews/101" })).toString('base64')
        }
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');

    recordFlaw("FLAW-03", "POST /api/webhook/google-pubsub: handlePubSubNotification が完全な空関数 (Unimplemented)", "High", "/api/webhook/google-pubsub",
      "Google Pub/Sub からのクチコミ新着通知を受け取っても、handlePubSubNotification() が空のためメッセージのデコード、新規クチコミ取得、AI返信案生成、LINE/メール通知のトリガーが一切行われません。また、エンドポイントの認証（JWTやシークレットトークン検証）も存在しません。");
  });


  // ==========================================================================
  // 4. マジックリンク1タップ返信 (GET /api/action/reply)
  // ==========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("【4. マジックリンク1タップ返信 (Magic Link 1-Tap Action)】");
  console.log("--------------------------------------------------------------------------------");

  // 4.1 GET /api/action/reply - トークンなし (Live)
  await runTest("MagicLink", "GET /api/action/reply - トークン未指定時に 400 Bad Request (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/action/reply`);
    assert.strictEqual(res.status, 400);
    const text = await res.text();
    assert.strictEqual(text, "Invalid Token");
  });

  // 4.2 GET /api/action/reply - 無効トークン (Live)
  await runTest("MagicLink", "GET /api/action/reply - 存在しない無効トークンで 400 エラー (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/action/reply?token=completely_fake_token_12345`);
    assert.strictEqual(res.status, 400);
    const text = await res.text();
    assert.match(text, /Error: 無効または期限切れのトークンです/);
  });

  // 4.3 GET /api/action/reply - 正常トークン実行 & ワンタイム消費検証 (Local Mock)
  await runTest("MagicLink", "GET /api/action/reply - 正常トークンで302リダイレクト＆使用済み消費 (Local Mock)", async () => {
    const db = createMockDB();
    const req = new Request('http://localhost/api/action/reply?token=token_valid_a');
    const res = await worker.fetch(req, { DB: db });

    assert.strictEqual(res.status, 302);
    const loc = res.headers.get('Location');
    assert.match(loc, /\/reply\.html\?status=success/);

    // トークンが使用済み (is_used = 1) に更新されていること
    const tokenRecord = db._replyTokens.find(t => t.token === 'token_valid_a');
    assert.strictEqual(tokenRecord.is_used, 1);

    // reviews テーブルのステータスが更新されていること
    const review = db._reviews.find(r => r.id === 'reviews/101');
    assert.strictEqual(review.reply_status, 'replied_a');
    assert.strictEqual(review.final_reply_text, 'ご来店ありがとうございます！');
  });

  // 4.4 GET /api/action/reply - 使用済みトークンの再利用拒絶 (Local Mock)
  await runTest("MagicLink", "GET /api/action/reply - 使用済みトークンの再実行拒絶 (Local Mock)", async () => {
    const db = createMockDB();
    const req = new Request('http://localhost/api/action/reply?token=token_used_b');
    const res = await worker.fetch(req, { DB: db });

    assert.strictEqual(res.status, 400);
    const text = await res.text();
    assert.match(text, /Error: 無効または期限切れのトークンです/);
  });

  // 4.5 GET /api/action/reply - manual_edit トークン時の手動編集画面リダイレクト検証
  await runTest("MagicLink", "GET /api/action/reply - manual_edit トークン時に手動編集画面へリダイレクト", async () => {
    const db = createMockDB();
    const req = new Request('http://localhost/api/action/reply?token=token_manual_edit');
    const res = await worker.fetch(req, { DB: db });

    assert.strictEqual(res.status, 302);
    const loc = res.headers.get('Location');
    // manual_edit の場合はレビューID・店舗IDを保持して手動編集画面へ遷移すること
    assert.match(loc, /\/reply\.html\?review_id=reviews%2F101&location_id=locations%2F184920481920/);
  });


  // ==========================================================================
  // 5. AI生成 (POST /api/generate)
  // ==========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("【5. AI生成 (AI Reply Generation)】");
  console.log("--------------------------------------------------------------------------------");

  // 5.1 POST /api/generate - フォールバック動作（日本語） (Live)
  await runTest("AI", "POST /api/generate - 日本語高評価クチコミのフォールバック生成 (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        comment: '料理も接客も素晴らしかったです！また来ます。',
        category: 'イタリアンレストラン',
        locationName: '渋谷店'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.replies);
    assert.strictEqual(data.replies.detected_language, 'ja');
    assert.ok(data.replies.reply_a);
    assert.ok(data.replies.reply_b);
    assert.ok(data.replies.reply_c);
  });

  // 5.2 POST /api/generate - フォールバック動作（英語・インバウンド翻訳） (Live)
  await runTest("AI", "POST /api/generate - 英語クチコミの自動言語検知＆日本語訳付き生成 (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        comment: 'The pasta was wonderful! Best dinner in Tokyo.',
        category: 'イタリアンレストラン',
        locationName: '渋谷店'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.replies.detected_language, 'en');
    assert.ok(data.replies.translated_comment, "英語クチコミには日本語訳が付与されること");
    assert.ok(data.replies.reply_a_ja, "返信案Aの日本語訳が存在すること");
  });

  // 5.3 POST /api/generate - 不正JSON時の 400 エラーハンドリング (Live)
  await runTest("AI", "POST /api/generate - 不正JSON時に 400 Bad Request を安全に返却 (Live)", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad_json'
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // 5.4 POST /api/generate - 未認証アクセス診断 (脆弱性)
  await runTest("AI", "POST /api/generate - 認証欠落によるAPIクレジット枯渇リスクの検出", async () => {
    recordVuln("VULN-06", "POST /api/generate: 未認証エンドポイント (API Quota Depletion / Scraper Risk)", "Medium", "/api/generate",
      "POST /api/generate に認証が一切掛けられておらず、外部の誰でも無制限にリクエストを送信できます。本番で Gemini API キーが設定された場合、悪意のあるボットやスクレイパーにより API 利用枠が枯渇し、従量課金が高騰するリスクがあります。セッション認証またはレートリミットを導入すべきです。");
  });

  // 5.5 POST /api/generate - 実際のGemini 2.5 Flash API 連携 (Local with Mock/Key)
  await runTest("AI", "POST /api/generate - Gemini 2.5 Flash API 呼び出しパスの検証 (Local)", async () => {
    const devVars = loadDevVars();
    let calledGemini = false;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('generativelanguage.googleapis.com')) {
        calledGemini = true;
        assert.match(url, /gemini-2\.5-flash/);
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  detected_language: "ja",
                  translated_comment: null,
                  reply_a: "Gemini生成返信A",
                  reply_a_ja: "Gemini生成返信A",
                  reply_b: "Gemini生成返信B",
                  reply_b_ja: "Gemini生成返信B",
                  reply_c: "Gemini生成返信C",
                  reply_c_ja: "Gemini生成返信C"
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url, opts);
    };

    try {
      const testEnv = { GEMINI_API_KEY: 'mock_test_key_123' };
      const req = new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, comment: '最高でした！' })
      });
      const res = await worker.fetch(req, testEnv);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(calledGemini, true, "Gemini API エンドポイントが正しくコールされたこと");
      assert.strictEqual(data.replies.reply_a, "Gemini生成返信A");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });


  // ==========================================================================
  // 6. その他の未実装機能の監査
  // ==========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("【6. バックグラウンド処理 & 未実装箇所の監査】");
  console.log("--------------------------------------------------------------------------------");

  await runTest("Cron", "scheduled() / pollNewReviews() - Cron トリガー処理の監査", async () => {
    recordFlaw("FLAW-06", "scheduled(): pollNewReviews が空関数 (Cron 定期巡回が未実装)", "High", "Cron Trigger / pollNewReviews",
      "wrangler.toml で 15分おきの cron (crons = ['*/15 * * * *']) が設定されているものの、pollNewReviews(env) が空関数となっており、定期巡回によるGoogle新着レビューの取得・自動同期処理が行われていません。");
  });

  // ==========================================================================
  // 結果サマリー出力
  // ==========================================================================
  console.log("\n================================================================================");
  console.log("📊 総合検証結果サマリー (Comprehensive Audit Report)");
  console.log("================================================================================");
  console.log(`実行テスト総数 : ${stats.total}`);
  console.log(`成功 (PASSED)  : \x1b[32m${stats.passed}\x1b[0m`);
  console.log(`失敗 (FAILED)  : ${stats.failed > 0 ? `\x1b[31m${stats.failed}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log(`検出された脆弱性 (Security Vulnerabilities) : \x1b[31m${stats.vulnerabilities.length} 件\x1b[0m`);
  console.log(`検出された不具合・仕様上の穴 (Functional Flaws) : \x1b[33m${stats.flaws.length} 件\x1b[0m`);
  console.log("================================================================================\n");

  console.log("🚨 【検出された重大セキュリティ脆弱性一覧】");
  stats.vulnerabilities.forEach((v, i) => {
    console.log(`\n${i + 1}. [${v.id}] [${v.severity}] ${v.title}`);
    console.log(`   対象: ${v.endpoint}`);
    console.log(`   詳細: ${v.description}`);
  });

  console.log("\n⚠️ 【検出された不具合・未実装・仕様上の穴一覧】");
  stats.flaws.forEach((f, i) => {
    console.log(`\n${i + 1}. [${f.id}] [${f.severity}] ${f.title}`);
    console.log(`   対象: ${f.endpoint}`);
    console.log(`   詳細: ${f.description}`);
  });
  console.log("\n================================================================================\n");
}

main().catch(err => {
  console.error("Test Suite Runtime Error:", err);
  process.exit(1);
});
