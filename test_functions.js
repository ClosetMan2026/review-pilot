import assert from 'assert';
import {
  getUserBySession,
  getUserLocations,
  getLocationById,
  getLocationReviews,
  updateLocationSettings,
  updateReviewReply,
  extractSessionToken
} from './src/index.js';

console.log("=== Testing D1 RLS Helper Functions directly ===");

// D1 Mock Client
function createMockDB() {
  const users = [
    { id: 'usr_shibuya', email: 'shibuya@example.com' },
    { id: 'usr_shinjuku', email: 'shinjuku@example.com' }
  ];
  const sessions = [
    { id: 'sess_shibuya', user_id: 'usr_shibuya', expires_at: '2099-01-01' }
  ];
  const locations = [
    { id: 'locations/111', user_id: 'usr_shibuya', location_name: '渋谷店' },
    { id: 'locations/222', user_id: 'usr_shinjuku', location_name: '新宿店' }
  ];
  const reviews = [
    { id: 'rev/1', location_id: 'locations/111', comment: '最高！' },
    { id: 'rev/2', location_id: 'locations/222', comment: '美味！' }
  ];

  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM sessions s') && sql.includes('JOIN users u')) {
                const token = args[0];
                const s = sessions.find(x => x.id === token);
                if (!s) return null;
                const u = users.find(x => x.id === s.user_id);
                return u ? { ...u, session_id: s.id } : null;
              }
              if (sql.includes('FROM locations') && sql.includes('WHERE id = ? AND user_id = ?')) {
                const [locId, userId] = args;
                return locations.find(l => l.id === locId && l.user_id === userId) || null;
              }
              return null;
            },
            async all() {
              if (sql.includes('FROM locations') && sql.includes('WHERE user_id = ?')) {
                const userId = args[0];
                return { results: locations.filter(l => l.user_id === userId) };
              }
              if (sql.includes('FROM reviews') && (sql.includes('WHERE location_id = ?') || sql.includes('WHERE r.location_id = ?'))) {
                const locId = args[0];
                return { results: reviews.filter(r => r.location_id === locId) };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('UPDATE locations') && sql.includes('WHERE id = ? AND user_id = ?')) {
                const locId = args[3];
                const userId = args[4];
                const loc = locations.find(l => l.id === locId && l.user_id === userId);
                return { meta: { changes: loc ? 1 : 0 } };
              }
              if (sql.includes('UPDATE reviews') && sql.includes('WHERE id = ? AND location_id = ?')) {
                const revId = args[2];
                const locId = args[3];
                const rev = reviews.find(r => r.id === revId && r.location_id === locId);
                return { meta: { changes: rev ? 1 : 0 } };
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
  const db = createMockDB();

  // Test extractSessionToken
  const reqWithHeader = new Request('http://localhost/', {
    headers: { 'Authorization': 'Bearer test_token_123' }
  });
  assert.strictEqual(extractSessionToken(reqWithHeader), 'test_token_123');
  console.log("✅ extractSessionToken (Bearer Header) passed");

  const reqWithCookie = new Request('http://localhost/', {
    headers: { 'Cookie': 'other=123; session_id=cookie_token_abc' }
  });
  assert.strictEqual(extractSessionToken(reqWithCookie), 'cookie_token_abc');
  console.log("✅ extractSessionToken (Cookie) passed");

  // Test getUserBySession
  const validUser = await getUserBySession(db, 'sess_shibuya');
  assert.strictEqual(validUser.id, 'usr_shibuya');
  console.log("✅ getUserBySession (valid session) passed");

  const invalidUser = await getUserBySession(db, 'non_existent');
  assert.strictEqual(invalidUser, null);
  console.log("✅ getUserBySession (invalid session returns null) passed");

  // Test getUserLocations
  const locs = await getUserLocations(db, 'usr_shibuya');
  assert.strictEqual(locs.length, 1);
  assert.strictEqual(locs[0].id, 'locations/111');
  console.log("✅ getUserLocations (tenant isolation) passed");

  // Test getLocationById (RLS)
  const myLoc = await getLocationById(db, 'locations/111', 'usr_shibuya');
  assert.strictEqual(myLoc.id, 'locations/111');
  console.log("✅ getLocationById (own location access) passed");

  const otherLoc = await getLocationById(db, 'locations/222', 'usr_shibuya');
  assert.strictEqual(otherLoc, null);
  console.log("✅ getLocationById (other tenant location returns null) passed");

  // Test getLocationReviews (RLS)
  const myReviews = await getLocationReviews(db, 'locations/111', 'usr_shibuya');
  assert.strictEqual(myReviews.length, 1);
  assert.strictEqual(myReviews[0].id, 'rev/1');
  console.log("✅ getLocationReviews (own reviews) passed");

  let threw = false;
  try {
    await getLocationReviews(db, 'locations/222', 'usr_shibuya');
  } catch (err) {
    threw = true;
    assert.match(err.message, /Row-Level Security Violation/);
  }
  assert.strictEqual(threw, true, "Should throw on cross-tenant review access");
  console.log("✅ getLocationReviews (cross-tenant RLS rejection with error) passed");

  // Test updateLocationSettings (RLS)
  const updateRes = await updateLocationSettings(db, 'locations/111', 'usr_shibuya', {
    locationName: '新店舗名'
  });
  assert.strictEqual(updateRes.success, true);
  console.log("✅ updateLocationSettings (own location) passed");

  let updateThrew = false;
  try {
    await updateLocationSettings(db, 'locations/222', 'usr_shibuya', {
      locationName: 'ハック'
    });
  } catch (err) {
    updateThrew = true;
    assert.match(err.message, /アクセス権限がありません/);
  }
  assert.strictEqual(updateThrew, true, "Should reject updating other tenant location");
  console.log("✅ updateLocationSettings (cross-tenant update blocked) passed");

  // Test updateReviewReply
  const replyRes = await updateReviewReply(db, 'rev/1', 'locations/111', {
    replyText: 'ありがとうございます！',
    replyStatus: 'replied_manual'
  });
  assert.strictEqual(replyRes.success, true);
  console.log("✅ updateReviewReply passed");

  let replyThrew = false;
  try {
    await updateReviewReply(db, 'rev/2', 'locations/111', {
      replyText: '不正更新'
    });
  } catch (err) {
    replyThrew = true;
  }
  assert.strictEqual(replyThrew, true, "Should reject reply update when location_id does not match review");
  console.log("✅ updateReviewReply (mismatched review/location rejected) passed");

  console.log("\n✨ ALL UNIT TESTS FOR D1 RLS FUNCTIONS PASSED! ✨\n");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
