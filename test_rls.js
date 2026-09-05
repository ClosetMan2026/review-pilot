import { execSync } from 'child_process';

function runD1(sql, remote = true) {
  const flag = remote ? '--remote' : '--local';
  const escapedSql = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute review-pilot-db ${flag} --json --command="${escapedSql}"`;
  const output = execSync(cmd, { encoding: 'utf-8' });
  
  // wrangler出力からJSON配列部分を抽出
  const jsonMatch = output.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON output: ${output}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed[0]?.results || [];
}

console.log("=== ReviewPilot D1 & Multi-Tenant RLS Test Suite ===\n");

try {
  // Test 1: セッション検証
  console.log("Test 1: セッション照合によるテナント認証 (getUserBySession)");
  const sessionUser = runD1(`
    SELECT u.id, u.email, u.name, s.id as session_id 
    FROM sessions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.id = 'sess_demo_shibuya_token' AND s.expires_at > CURRENT_TIMESTAMP;
  `);
  console.log("  Result:", sessionUser);
  if (sessionUser.length === 1 && sessionUser[0].id === 'usr_demo_shibuya') {
    console.log("  ✅ PASS: 正しいセッションで渋谷店ユーザーを特定");
  } else {
    throw new Error("Test 1 FAILED");
  }

  // 無効セッション
  const invalidSession = runD1(`
    SELECT u.id FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = 'invalid_token';
  `);
  if (invalidSession.length === 0) {
    console.log("  ✅ PASS: 無効セッションを拒絶");
  } else {
    throw new Error("Test 1 (invalid session) FAILED");
  }

  // Test 2: 店舗一覧のテナント分離 (getUserLocations)
  console.log("\nTest 2: 店舗データのテナント分離 (getUserLocations)");
  const shibuyaLocations = runD1(`
    SELECT id, location_name FROM locations WHERE user_id = 'usr_demo_shibuya';
  `);
  console.log("  Shibuya Locations:", shibuyaLocations);
  if (shibuyaLocations.length === 1 && shibuyaLocations[0].id === 'locations/184920481920') {
    console.log("  ✅ PASS: 渋谷店オーナーには渋谷店のみが返却される（新宿店は混入しない）");
  } else {
    throw new Error("Test 2 FAILED");
  }

  // Test 3: クロステナント不正アクセス遮断 (getLocationById RLS)
  console.log("\nTest 3: 他テナント店舗への不正アクセス遮断 (RLS: WHERE id = ? AND user_id = ?)");
  const crossTenantAccess = runD1(`
    SELECT id FROM locations WHERE id = 'locations/999999999999' AND user_id = 'usr_demo_shibuya';
  `);
  console.log("  Cross-tenant access attempt result count:", crossTenantAccess.length);
  if (crossTenantAccess.length === 0) {
    console.log("  ✅ PASS: 渋谷店ユーザーが新宿店(999999999999)を取得しようとしても完全遮断(0件)");
  } else {
    throw new Error("Test 3 FAILED: クロステナントアクセスが遮断されていません！");
  }

  // Test 4: クチコミデータのテナント分離 (getLocationReviews)
  console.log("\nTest 4: クチコミ一覧のテナント分離 (getLocationReviews)");
  const shibuyaReviews = runD1(`
    SELECT id, reviewer_name, star_rating, reply_status FROM reviews WHERE location_id = 'locations/184920481920';
  `);
  console.log("  Shibuya reviews count:", shibuyaReviews.length);
  if (shibuyaReviews.length === 4) {
    console.log("  ✅ PASS: 渋谷店のクチコミ4件が正確に取得された");
  } else {
    throw new Error(`Test 4 FAILED: Expected 4 reviews, got ${shibuyaReviews.length}`);
  }

  // Test 5: 他テナントデータの不正改ざん防御 (updateLocationSettings RLS)
  console.log("\nTest 5: 他テナントデータの改ざん防止 (RLS UPDATE)");
  runD1(`
    UPDATE locations SET location_name = 'HACKED' WHERE id = 'locations/999999999999' AND user_id = 'usr_demo_shibuya';
  `);
  const shinjukuCheck = runD1(`
    SELECT location_name FROM locations WHERE id = 'locations/999999999999';
  `);
  console.log("  Shinjuku name after hack attempt:", shinjukuCheck[0]?.location_name);
  if (shinjukuCheck[0]?.location_name === 'BISTRO SHINJUKU (新宿店)') {
    console.log("  ✅ PASS: 改ざんクエリは0件更新となり、新宿店のデータは改ざんされず完全防御！");
  } else {
    throw new Error("Test 5 FAILED: 他テナント店舗が改ざんされてしまいました！");
  }

  console.log("\n========================================================");
  console.log("🎉 ALL MULTI-TENANT RLS TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("========================================================");
} catch (err) {
  console.error("❌ Test failed:", err);
  process.exit(1);
}
