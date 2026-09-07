import assert from 'assert';
import worker, {
  hashPassword,
  verifyPassword,
  timingSafeEqual,
  getCorsHeaders,
  addSecurityHeaders,
  extractSessionToken,
  getUserBySession,
  getUserLocations,
  getLocationReviews
} from './src/index.js';

console.log("================================================================");
console.log("🛡️  ReviewPilot (らくコミくん) 認証＆セキュリティ自動テストスイート 🛡️");
console.log("================================================================\n");

// ----------------------------------------------------------------------------
// インメモリ D1 モックデータベース
// ----------------------------------------------------------------------------
function createInMemoryD1() {
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
      id: 'sess_preexisting_shibuya',
      user_id: 'usr_demo_shibuya',
      expires_at: new Date(Date.now() + 86400000).toISOString()
    }
  ];

  const locations = [
    {
      id: 'locations/184920481920',
      user_id: 'usr_demo_shibuya',
      account_id: 'accounts/1098273645',
      location_name: 'TRATTORIA SHIBUYA (渋谷店)',
      category: 'イタリアンレストラン',
      address: '東京都渋谷区宇田川町12-3'
    },
    {
      id: 'locations/999999999999',
      user_id: 'usr_demo_shinjuku',
      account_id: 'accounts/2098273646',
      location_name: 'BISTRO SHINJUKU (新宿店)',
      category: 'フランス料理店',
      address: '東京都新宿区新宿3-1-1'
    }
  ];

  const reviews = [
    {
      id: 'reviews/101',
      location_id: 'locations/184920481920',
      reviewer_name: '渋谷客A',
      star_rating: 5,
      comment: '最高でした'
    },
    {
      id: 'reviews/201',
      location_id: 'locations/999999999999',
      reviewer_name: '新宿客B',
      star_rating: 4,
      comment: 'おいしかったです'
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
              // 1. SELECT ... FROM users WHERE email = ?
              if (sql.includes('FROM users') && sql.includes('WHERE email = ?')) {
                const email = args[0];
                return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
              }

              // 2. SELECT ... FROM sessions s JOIN users u ... WHERE s.id = ?
              if (sql.includes('FROM sessions s') && sql.includes('JOIN users u')) {
                const sessionId = args[0];
                const session = sessions.find(s => s.id === sessionId);
                if (!session) return null;
                const user = users.find(u => u.id === session.user_id);
                if (!user) return null;
                return {
                  ...user,
                  session_id: session.id,
                  session_expires_at: session.expires_at
                };
              }

              // 3. SELECT ... FROM locations WHERE id = ? AND user_id = ?
              if (sql.includes('FROM locations') && sql.includes('WHERE id = ? AND user_id = ?')) {
                const [locId, userId] = args;
                return locations.find(l => l.id === locId && l.user_id === userId) || null;
              }

              return null;
            },

            async all() {
              // 1. SELECT ... FROM locations WHERE user_id = ?
              if (sql.includes('FROM locations') && sql.includes('WHERE user_id = ?')) {
                const userId = args[0];
                return { results: locations.filter(l => l.user_id === userId) };
              }

              // 2. SELECT ... FROM reviews WHERE location_id = ?
              if (sql.includes('FROM reviews') && (sql.includes('WHERE location_id = ?') || sql.includes('WHERE r.location_id = ?'))) {
                const locId = args[0];
                return { results: reviews.filter(r => r.location_id === locId) };
              }

              return { results: [] };
            },

            async run() {
              // 1. INSERT INTO sessions
              if (sql.includes('INSERT INTO sessions')) {
                const [id, user_id] = args;
                sessions.push({
                  id,
                  user_id,
                  expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
                });
                return { meta: { changes: 1 } };
              }

              // 2. DELETE FROM sessions WHERE id = ?
              if (sql.includes('DELETE FROM sessions WHERE id = ?')) {
                const id = args[0];
                const prevCount = sessions.length;
                sessions = sessions.filter(s => s.id !== id);
                return { meta: { changes: prevCount - sessions.length } };
              }

              // 3. UPDATE users SET password_hash = ...
              if (sql.includes('UPDATE users SET password_hash = ?')) {
                const [hash, salt, userId] = args;
                const user = users.find(u => u.id === userId);
                if (user) {
                  user.password_hash = hash;
                  user.password_salt = salt;
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

async function runTestSuite() {
  let passedCount = 0;
  let totalCount = 0;

  function test(title, fn) {
    totalCount++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ [PASS] ${title}`);
        passedCount++;
      } catch (err) {
        console.error(`  ❌ [FAIL] ${title}`);
        console.error(`     Error: ${err.message}`);
        throw err;
      }
    })();
  }

  // ==========================================================================
  console.log("SECTION 1: 暗号化 & パスワードハッシュ (PBKDF2 Web Crypto API)");
  // ==========================================================================

  await test("PBKDF2 ハッシュ生成とランダムソルト発行", async () => {
    const creds1 = await hashPassword("super-secret-password");
    assert.strictEqual(typeof creds1.hash, "string");
    assert.strictEqual(creds1.hash.length, 64, "SHA-256 256-bit hash should be 64 hex chars");
    assert.strictEqual(typeof creds1.salt, "string");
    assert.strictEqual(creds1.salt.length, 32, "16-byte salt should be 32 hex chars");

    // 異なるソルトで異なるハッシュになること
    const creds2 = await hashPassword("super-secret-password");
    assert.notStrictEqual(creds1.salt, creds2.salt);
    assert.notStrictEqual(creds1.hash, creds2.hash);
  });

  await test("パスワード検証の正確性 (一致 / 不一致)", async () => {
    const { hash, salt } = await hashPassword("correctPassword123!");
    const isMatch = await verifyPassword("correctPassword123!", hash, salt);
    assert.strictEqual(isMatch, true, "正しいパスワードでtrue");

    const isWrong = await verifyPassword("wrongPassword", hash, salt);
    assert.strictEqual(isWrong, false, "誤ったパスワードでfalse");
  });

  await test("タイミングセーフ等値比較 (timingSafeEqual)", () => {
    assert.strictEqual(timingSafeEqual("abc123xyz", "abc123xyz"), true);
    assert.strictEqual(timingSafeEqual("abc123xyz", "abc123xyw"), false);
    assert.strictEqual(timingSafeEqual("abc", "abcd"), false);
  });

  // ==========================================================================
  console.log("\nSECTION 2: CORS 完全厳格化 (Access-Control-Allow-Origin: * 完全撤廃)");
  // ==========================================================================

  await test("許可オリジン (review-pilot-6bm.pages.dev) への Credentials 付与", () => {
    const req = new Request("https://review-pilot.workers.dev/api/auth/me", {
      headers: { 'Origin': 'https://review-pilot-6bm.pages.dev' }
    });
    const headers = getCorsHeaders(req);
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://review-pilot-6bm.pages.dev');
    assert.strictEqual(headers['Access-Control-Allow-Credentials'], 'true');
    assert.notStrictEqual(headers['Access-Control-Allow-Origin'], '*');
  });

  await test("ローカル開発オリジン (http://localhost:3000, 127.0.0.1:8787) の許可", () => {
    const reqLocal = new Request("https://review-pilot.workers.dev/api/auth/me", {
      headers: { 'Origin': 'http://localhost:3000' }
    });
    const headersLocal = getCorsHeaders(reqLocal);
    assert.strictEqual(headersLocal['Access-Control-Allow-Origin'], 'http://localhost:3000');
    assert.strictEqual(headersLocal['Access-Control-Allow-Credentials'], 'true');

    const reqIp = new Request("https://review-pilot.workers.dev/api/auth/me", {
      headers: { 'Origin': 'http://127.0.0.1:8787' }
    });
    const headersIp = getCorsHeaders(reqIp);
    assert.strictEqual(headersIp['Access-Control-Allow-Origin'], 'http://127.0.0.1:8787');
    assert.strictEqual(headersIp['Access-Control-Allow-Credentials'], 'true');
  });

  await test("不許可オリジン (攻撃者サイト) の遮断 (* を返さず Origin なし)", () => {
    const reqAttacker = new Request("https://review-pilot.workers.dev/api/auth/me", {
      headers: { 'Origin': 'https://malicious-phishing.com' }
    });
    const headers = getCorsHeaders(reqAttacker);
    assert.strictEqual(headers['Access-Control-Allow-Origin'], undefined, "不許可オリジンにはOriginヘッダーを返さない");
    assert.strictEqual(headers['Access-Control-Allow-Credentials'], undefined);
  });

  // ==========================================================================
  console.log("\nSECTION 3: セキュリティヘッダー自動付加");
  // ==========================================================================

  await test("すべてのレスポンスに防御ヘッダーが付加されること", () => {
    const baseRes = new Response(JSON.stringify({ ok: true }));
    const securedRes = addSecurityHeaders(baseRes);

    assert.strictEqual(securedRes.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.strictEqual(securedRes.headers.get('X-Frame-Options'), 'DENY');
    assert.strictEqual(securedRes.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  });

  // ==========================================================================
  console.log("\nSECTION 4: 本物の認証 API (ログイン・セッションCookie・/api/auth/me・ログアウト)");
  // ==========================================================================

  const db = createInMemoryD1();
  const env = { DB: db };

  let authCookie = null;
  let issuedSessionId = null;

  await test("POST /api/auth/login: 誤ったパスワードで 401 拒絶", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "owner@trattoria-shibuya.com",
        password: "incorrect-password"
      })
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY');
  });

  await test("POST /api/auth/login: 存在しないメールアドレスで 401 拒絶", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@trattoria.com",
        password: "password123"
      })
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  await test("POST /api/auth/login: 正しい資格情報でログイン成功＆セキュアクッキー発行", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://review-pilot-6bm.pages.dev"
      },
      body: JSON.stringify({
        email: "owner@trattoria-shibuya.com",
        password: "password123"
      })
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, "usr_demo_shibuya");
    assert.strictEqual(data.user.email, "owner@trattoria-shibuya.com");
    assert.strictEqual(data.user.plan, "pro");

    // Cookie 検証
    const setCookie = res.headers.get("Set-Cookie");
    assert.ok(setCookie, "Set-Cookie ヘッダーが存在すること");
    assert.match(setCookie, /session_id=sess_[a-f0-9-]+;/);
    assert.match(setCookie, /Path=\/;/);
    assert.match(setCookie, /HttpOnly;/);
    assert.match(setCookie, /Secure;/);
    assert.match(setCookie, /SameSite=Lax;/);
    assert.match(setCookie, /Max-Age=2592000(?:;|$)/);

    authCookie = setCookie.split(';')[0]; // session_id=sess_...
    issuedSessionId = authCookie.split('=')[1];

    // CORS & セキュリティヘッダー検証
    assert.strictEqual(res.headers.get("Access-Control-Allow-Origin"), "https://review-pilot-6bm.pages.dev");
    assert.strictEqual(res.headers.get("Access-Control-Allow-Credentials"), "true");
    assert.strictEqual(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.strictEqual(res.headers.get("X-Frame-Options"), "DENY");
  });

  await test("GET /api/auth/me: 未ログイン時に 401 Unauthorized を返却", async () => {
    const req = new Request("http://localhost/api/auth/me", {
      method: "GET"
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Unauthorized");
  });

  await test("GET /api/auth/me: ログイン中セッションCookieでユーザー情報取得", async () => {
    const req = new Request("http://localhost/api/auth/me", {
      method: "GET",
      headers: {
        "Cookie": authCookie,
        "Origin": "https://review-pilot-6bm.pages.dev"
      }
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, "usr_demo_shibuya");
    assert.strictEqual(data.user.email, "owner@trattoria-shibuya.com");
    assert.strictEqual(data.user.plan, "pro");
    assert.strictEqual(data.locations.length, 1);
    assert.strictEqual(data.locations[0].id, "locations/184920481920");
  });

  // ==========================================================================
  console.log("\nSECTION 5: マルチテナント Row-Level Security (RLS) 遮断");
  // ==========================================================================

  await test("GET /api/reviews: 自店舗 (渋谷店) のクチコミ取得成功", async () => {
    const req = new Request("http://localhost/api/reviews?location_id=locations/184920481920", {
      method: "GET",
      headers: { "Cookie": authCookie }
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.reviews.length, 1);
    assert.strictEqual(data.reviews[0].reviewer_name, "渋谷客A");
  });

  await test("GET /api/reviews: 他テナント (新宿店) へのアクセスは 403 Forbidden で完全拒絶", async () => {
    const req = new Request("http://localhost/api/reviews?location_id=locations/999999999999", {
      method: "GET",
      headers: { "Cookie": authCookie }
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 403, "他人の店舗へのアクセスは403で拒否されること");
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /Row-Level Security Violation/);
  });

  // ==========================================================================
  console.log("\nSECTION 6: ログアウト処理 (Cookie無効化 & セッション破棄)");
  // ==========================================================================

  await test("POST /api/auth/logout: セッション削除 & Max-Age=0 Cookie 返却", async () => {
    const req = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { "Cookie": authCookie }
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    const clearCookie = res.headers.get("Set-Cookie");
    assert.ok(clearCookie, "無効化 Set-Cookie が返却されること");
    assert.match(clearCookie, /session_id=;/);
    assert.match(clearCookie, /Max-Age=0(?:;|$)/);
  });

  await test("ログアウト後の GET /api/auth/me: 401 Unauthorized になること", async () => {
    const req = new Request("http://localhost/api/auth/me", {
      method: "GET",
      headers: { "Cookie": authCookie }
    });
    const res = await worker.fetch(req, env);
    assert.strictEqual(res.status, 401, "セッションが破棄されたため未認証");
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Unauthorized");
  });

  // ==========================================================================
  console.log("\n================================================================");
  console.log(`🎉 全テスト成功: ${passedCount}/${totalCount} TESTS PASSED! 🎉`);
  console.log("================================================================");
}

runTestSuite().catch(err => {
  console.error("\n❌ テストスイート失敗:", err);
  process.exit(1);
});
