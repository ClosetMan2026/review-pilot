/**
 * ============================================================================
 * らくらくクチコミ返信（らくコミくん / ReviewPilot）
 * 全画面・機能徹底動作検証 自動テストスクリプト
 * (verify_all_pages_and_features.js)
 *
 * 【検証範囲】
 * 1. 全ページ & 全リンクの導線性（404リンク、アンカー不一致の完全ゼロ保証）
 * 2. 全DOM要素、ID、クラス、イベントリスナー、onclickの整合性
 * 3. ダッシュボードの全機能 & タブ切り替え（ログイン前/後、統計、フィルター、即時返信、設定、LINE、Stripe、ログアウト）
 * 4. 個別返信画面 (reply.html) の全機能（パラメータ、AI案切り替え、手動編集、返信送信、モーダル、導線）
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { JSDOM } from 'jsdom';

// テスト統計カウンタ
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

async function testCase(category, title, fn) {
  stats.total++;
  const id = `[TC-${String(stats.total).padStart(2, '0')}]`;
  process.stdout.write(`${id} [${category}] ${title} ... `);
  try {
    await fn();
    stats.passed++;
    console.log(`\x1b[32mPASSED\x1b[0m`);
  } catch (err) {
    stats.failed++;
    stats.errors.push({ id, category, title, error: err.message, stack: err.stack });
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`     \x1b[31mError:\x1b[0m ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// ヘルパー: ファイル読み込み & DOMテキスト取得
// -----------------------------------------------------------------------------
const projectRoot = path.resolve('.');
const publicDir = path.join(projectRoot, 'public');

const TARGET_PAGES = [
  'index.html',
  'dashboard.html',
  'reply.html',
  'tokushoho.html',
  'terms.html',
  'privacy.html'
];

function readPublicFile(filename) {
  const filePath = path.join(publicDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readRootFile(filename) {
  const filePath = path.join(projectRoot, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Root file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function getText(el) {
  if (!el) return '';
  const val = (el.innerText !== undefined && el.innerText !== null) ? el.innerText : (el.textContent || '');
  return String(val).trim();
}

// =============================================================================
// MAIN VERIFICATION SUITE
// =============================================================================
async function runAllVerifications() {
  console.log('================================================================');
  console.log('🔍 らくらくクチコミ返信（らくコミくん） 全画面・機能徹底動作検証 🔍');
  console.log('================================================================\n');

  // ===========================================================================
  // SECTION 1: 全HTMLファイルの整合性とルート・public同期検証
  // ===========================================================================
  console.log('----------------------------------------------------------------');
  console.log('【1. HTML構文・ファイル完全性 & 同期チェック】');
  console.log('----------------------------------------------------------------');

  for (const page of TARGET_PAGES) {
    await testCase('File Integrity', `public/${page} と ルート ${page} の完全同期チェック`, () => {
      const publicContent = readPublicFile(page);
      const rootContent = readRootFile(page);
      assert.strictEqual(
        publicContent,
        rootContent,
        `public/${page} と ルートの ${page} の内容が一致していません。両方の同期が必要です。`
      );
      assert(publicContent.length > 500, `${page} のファイルサイズが小さすぎます（欠落の可能性）`);
      assert(publicContent.includes('<!DOCTYPE html>'), `${page} に DOCTYPE 宣言がありません`);
      assert(publicContent.includes('<html'), `${page} に html タグがありません`);
      assert(publicContent.includes('</html>'), `${page} に </html> 終了タグがありません`);
      assert(publicContent.includes('<meta charset="UTF-8">'), `${page} に UTF-8 meta宣言がありません`);
      assert(publicContent.includes('<title>'), `${page} に title タグがありません`);
    });
  }

  // ===========================================================================
  // SECTION 2: 全ページ・全リンクの網羅的導線検証 (404リンク・アンカー不一致チェック)
  // ===========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【2. 全リンク・全アンカーの導線検証 (404 / リンク切れゼロ保証)】');
  console.log('----------------------------------------------------------------');

  const pageDoms = {};
  for (const page of TARGET_PAGES) {
    const html = readPublicFile(page);
    pageDoms[page] = new JSDOM(html, { url: `https://reviewpilot.pages.dev/${page}` });
  }

  for (const page of TARGET_PAGES) {
    await testCase('Link & Anchor', `${page} 内の全リンク (<a>タグ) の参照先検証`, () => {
      const dom = pageDoms[page];
      const anchors = Array.from(dom.window.document.querySelectorAll('a'));
      assert(anchors.length > 0, `${page} にリンクが1つも存在しません`);

      for (const a of anchors) {
        const href = a.getAttribute('href');
        assert(href, `${page} 内のリンク要素に href 属性が存在しません: ${a.outerHTML}`);

        // 1. 同一ページ内アンカー (#features, #demo 等)
        if (href.startsWith('#')) {
          const targetId = href.slice(1);
          if (targetId) {
            const targetEl = dom.window.document.getElementById(targetId);
            assert(
              targetEl !== null,
              `${page} 内のアンカーリンク "${href}" の飛び先要素 (id="${targetId}") が存在しません！`
            );
          }
        }
        // 2. 内部絶対パスリンク (/dashboard.html, /tokushoho.html, /, /#pricing 等)
        else if (href.startsWith('/')) {
          const urlObj = new URL(href, 'https://reviewpilot.pages.dev');
          const pathname = urlObj.pathname;

          if (pathname === '/') {
            assert(fs.existsSync(path.join(publicDir, 'index.html')));
            if (urlObj.hash) {
              const hashId = urlObj.hash.slice(1);
              const indexDom = pageDoms['index.html'];
              assert(
                indexDom.window.document.getElementById(hashId) !== null,
                `${page} からのリンク "${href}" のアンカー (id="${hashId}") が index.html に存在しません！`
              );
            }
          } else {
            const relativeFile = pathname.replace(/^\//, '');
            const targetFilePath = path.join(publicDir, relativeFile);
            assert(
              fs.existsSync(targetFilePath),
              `${page} からの内部リンク "${href}" の参照先ファイル "${targetFilePath}" が存在しません（404エラー）！`
            );

            if (urlObj.hash && TARGET_PAGES.includes(relativeFile)) {
              const targetDom = pageDoms[relativeFile];
              const hashId = urlObj.hash.slice(1);
              assert(
                targetDom.window.document.getElementById(hashId) !== null,
                `${page} からのリンク "${href}" のアンカー (id="${hashId}") が ${relativeFile} に存在しません！`
              );
            }
          }
        }
        // 3. 外部リンク (https://coconala.com, https://manager.line.biz, mailto: など)
        else if (href.startsWith('http://') || href.startsWith('https://')) {
          assert.doesNotThrow(() => new URL(href), `${page} 内の外部リンク "${href}" が不正なURL形式です`);
          if (a.getAttribute('target') === '_blank') {
            const rel = a.getAttribute('rel');
            assert(rel && rel.includes('noopener'), `${page} の target="_blank" リンク "${href}" に rel="noopener" がありません`);
          }
        } else if (href.startsWith('mailto:')) {
          assert(href.includes('@'), `${page} 内の mailto リンク "${href}" にメールアドレスが含まれていません`);
        } else {
          throw new Error(`${page} に未対応のリンク形式があります: ${href}`);
        }
      }
    });
  }

  // ===========================================================================
  // SECTION 3: LP (index.html) のインタラクティブデモ検証
  // ===========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【3. LP (index.html) のAI返信デモシミュレータ動作検証】');
  console.log('----------------------------------------------------------------');

  await testCase('LP Demo', 'プリセット切り替え (setDemoPreset) と入力値反映', () => {
    const html = readPublicFile('index.html');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://reviewpilot.pages.dev/' });
    const { window } = dom;

    assert(typeof window.setDemoPreset === 'function', 'setDemoPreset 関数が定義されていません');
    assert(typeof window.generateDemoReplies === 'function', 'generateDemoReplies 関数が定義されていません');
    assert(typeof window.copyReply === 'function', 'copyReply 関数が定義されていません');

    // 1. pasta プリセット
    window.setDemoPreset('pasta');
    assert.strictEqual(window.document.getElementById('demo-rating').value, '5');
    assert.strictEqual(window.document.getElementById('demo-category').value, 'イタリアンレストラン');
    assert(window.document.getElementById('demo-text').value.includes('カルボナーラ'));
    assert(window.document.getElementById('demo-translation-box').classList.contains('hidden'));

    // 2. inbound_en (英語クチコミ) プリセット
    window.setDemoPreset('inbound_en');
    assert.strictEqual(window.document.getElementById('demo-rating').value, '5');
    assert(window.document.getElementById('demo-text').value.includes('truffle pasta'));
    assert(!window.document.getElementById('demo-translation-box').classList.contains('hidden'), '英語プリセット時に日本語訳ボックスが表示されていません');
    assert(getText(window.document.getElementById('demo-translation-text')).includes('トリュフパスタ'));

    // 3. complaint (クレーム) プリセット
    window.setDemoPreset('complaint');
    assert.strictEqual(window.document.getElementById('demo-rating').value, '2');
    assert(window.document.getElementById('demo-text').value.includes('待たされました'));
  });

  await testCase('LP Demo', 'AI返信案生成 (generateDemoReplies) の非同期実行と3案出力', async () => {
    const html = readPublicFile('index.html');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://reviewpilot.pages.dev/' });
    const { window } = dom;

    window.HTMLElement.prototype.scrollIntoView = () => {};

    // 日本語クチコミの返信案生成
    window.setDemoPreset('pasta');
    window.generateDemoReplies();

    await new Promise(r => setTimeout(r, 600));

    assert(!window.document.getElementById('demo-results').classList.contains('hidden'), '返信案結果が表示されていません');
    const replyA = getText(window.document.getElementById('reply-a'));
    const replyB = getText(window.document.getElementById('reply-b'));
    const replyC = getText(window.document.getElementById('reply-c'));

    assert(replyA.length > 20, 'パターンAの返信案が空または短すぎます');
    assert(replyB.length > 20, 'パターンBの返信案が空または短すぎます');
    assert(replyC.length > 20, 'パターンCの返信案が空または短すぎます');
    assert(replyB.includes('😊'), 'パターンB（親しみ）に絵文字が含まれていません');

    // 英語クチコミの返信案生成
    window.setDemoPreset('inbound_en');
    window.generateDemoReplies();
    await new Promise(r => setTimeout(r, 600));

    const replyAEn = getText(window.document.getElementById('reply-a'));
    const replyAJa = getText(window.document.getElementById('reply-a-ja'));
    assert(replyAEn.includes('Thank you'), '英語返信案に英文が含まれていません');
    assert(!window.document.getElementById('reply-a-ja').classList.contains('hidden'), '英語返信案の日本語訳が表示されていません');
    assert(replyAJa.includes('【日本語訳】'), '英語返信案の日本語訳プレビューが不完全です');
  });

  // ===========================================================================
  // SECTION 4: 管理画面 (dashboard.html) ログイン前ビューの徹底検証
  // ===========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【4. ダッシュボード (dashboard.html) ログイン前ビューの徹底検証】');
  console.log('----------------------------------------------------------------');

  await testCase('Dashboard Auth', '未ログイン時のログインビュー表示とパスワードトグル動作', async () => {
    const html = readPublicFile('dashboard.html');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://reviewpilot.pages.dev/dashboard.html' });
    const { window } = dom;

    window.fetch = async (url) => {
      if (url === '/api/auth/me') {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    await window.checkAuthState();

    const loginView = window.document.getElementById('loginView');
    const dashboardView = window.document.getElementById('dashboardView');

    assert(!loginView.classList.contains('hidden'), '未認証時に loginView が表示されていません');
    assert(dashboardView.classList.contains('hidden'), '未認証時に dashboardView が非表示になっていません');

    const pwdInput = window.document.getElementById('loginPassword');
    const iconSpan = window.document.getElementById('passwordToggleIcon');
    assert.strictEqual(pwdInput.type, 'password');

    window.togglePasswordVisibility();
    assert.strictEqual(pwdInput.type, 'text', 'togglePasswordVisibility 呼び出し後に type="text" になっていません');
    assert.strictEqual(getText(iconSpan), '🙈');

    window.togglePasswordVisibility();
    assert.strictEqual(pwdInput.type, 'password', '再呼び出し後に type="password" に戻っていません');
    assert.strictEqual(getText(iconSpan), '👁️');
  });

  await testCase('Dashboard Auth', 'ログインフォーム送信 (handleLoginSubmit) のバリデーションと失敗/成功処理', async () => {
    const html = readPublicFile('dashboard.html');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://reviewpilot.pages.dev/dashboard.html' });
    const { window } = dom;

    let loginApiCalled = false;
    let loginPayload = null;
    let shouldSucceed = false;

    window.fetch = async (url, options) => {
      if (url === '/api/auth/login') {
        loginApiCalled = true;
        loginPayload = JSON.parse(options.body);
        if (shouldSucceed) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, message: 'Login successful' })
          };
        } else {
          return {
            ok: false,
            status: 401,
            json: async () => ({ success: false, error: 'メールアドレスまたはパスワードが正しくありません。' })
          };
        }
      }
      if (url === '/api/auth/me') {
        if (shouldSucceed) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              user: { id: 'usr_123', name: 'テストオーナー', email: 'owner@test.com' },
              locations: [{ id: 'locations/123', location_name: 'テスト店舗' }]
            })
          };
        }
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ reviews: [] }) };
    };

    // 1. 不正ログイン (401)
    window.document.getElementById('loginEmail').value = 'wrong@test.com';
    window.document.getElementById('loginPassword').value = 'wrongpass';

    const fakeEvent = { preventDefault: () => {} };
    await window.handleLoginSubmit(fakeEvent);

    assert(loginApiCalled, '/api/auth/login API が呼び出されていません');
    assert.strictEqual(loginPayload.email, 'wrong@test.com');
    const errorBox = window.document.getElementById('loginErrorMsg');
    const errorText = window.document.getElementById('loginErrorText');
    assert(!errorBox.classList.contains('hidden'), 'ログイン失敗時にエラーメッセージボックスが表示されていません');
    assert(getText(errorText).includes('メールアドレスまたはパスワードが正しくありません'));

    // 2. 正常ログイン (200)
    shouldSucceed = true;
    window.document.getElementById('loginEmail').value = 'owner@test.com';
    window.document.getElementById('loginPassword').value = 'correctpass';

    await window.handleLoginSubmit(fakeEvent);

    assert.strictEqual(window.localStorage.getItem('rakukomi_logged_in'), 'true', 'localStorage にフラグが保存されていません');
    const loginView = window.document.getElementById('loginView');
    const dashboardView = window.document.getElementById('dashboardView');
    assert(loginView.classList.contains('hidden'), 'ログイン成功後に loginView が非表示になっていません');
    assert(!dashboardView.classList.contains('hidden'), 'ログイン成功後に dashboardView が表示されていません');
    assert.strictEqual(getText(window.document.getElementById('navStoreName')), 'テスト店舗');
  });

  // ===========================================================================
  // SECTION 5: 管理画面 (dashboard.html) ログイン後ビューの徹底検証
  // ===========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【5. ダッシュボード (dashboard.html) ログイン後機能の徹底検証】');
  console.log('----------------------------------------------------------------');

  const mockReviews = [
    {
      id: 'reviews/101',
      location_id: 'locations/184920481920',
      reviewer_name: '田中 太郎 様',
      star_rating: 5,
      comment: '料理も雰囲気も最高でした！また来ます。',
      reply_status: 'replied_a',
      final_reply_text: 'ご来店誠にありがとうございました！',
      replied_at: '2026-09-01T12:00:00Z',
      generated_reply_a: 'ご来店誠にありがとうございました！'
    },
    {
      id: 'reviews/102',
      location_id: 'locations/184920481920',
      reviewer_name: 'John Doe',
      star_rating: 5,
      comment: 'Great pasta and atmosphere!',
      translated_comment: 'パスタも雰囲気も最高でした！',
      reply_status: null, // 未返信
      generated_reply_a: 'Thank you very much for your kind words! We look forward to seeing you again.'
    },
    {
      id: 'reviews/103',
      location_id: 'locations/184920481920',
      reviewer_name: '鈴木 一郎 様',
      star_rating: 2,
      comment: '料理はおいしかったが、席が狭かった。',
      reply_status: null, // 未返信
      generated_reply_a: 'この度はご利用ありがとうございます。席の配置につき改善に努めます。',
      generated_reply_c: 'この度はご不快な思いをさせてしまい申し訳ございませんでした。座席改善に努めます。'
    }
  ];

  function setupLoggedInDashboard() {
    const html = readPublicFile('dashboard.html');
    let reviewsData = JSON.parse(JSON.stringify(mockReviews));
    let lastNavigatedUrl = null;

    const fetchHandler = async (url, options = {}) => {
      const method = options.method || 'GET';

      if (url === '/api/auth/me') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            user: {
              id: 'usr_demo_shibuya',
              name: 'TRATTORIA SHIBUYA オーナー',
              email: 'owner@trattoria-shibuya.com',
              notification_email: 'notice@trattoria-shibuya.com',
              plan: 'pro',
              subscription_status: 'active',
              trial_ends_at: null
            },
            locations: [
              {
                id: 'locations/184920481920',
                location_name: 'TRATTORIA SHIBUYA (渋谷店)',
                category: 'イタリアンレストラン',
                address: '東京都渋谷区宇田川町12-3',
                auto_reply: 0,
                ai_tone: 'polite'
              }
            ]
          })
        };
      }

      if (url === '/api/reviews/reply' && method === 'POST') {
        const body = JSON.parse(options.body);
        const target = reviewsData.find(r => r.id === body.reviewId);
        if (target) {
          target.reply_status = body.replyStatus || 'replied_a';
          target.final_reply_text = body.replyText;
          target.replied_at = new Date().toISOString();
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Replied successfully' })
        };
      }

      if (url.startsWith('/api/reviews')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            reviews: reviewsData
          })
        };
      }

      if (url === '/api/location/settings' && method === 'POST') {
        const body = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, location: body })
        };
      }

      if (url === '/api/line/test-push' && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Push sent' })
        };
      }

      if (url === '/api/stripe/create-portal-session' && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://billing.stripe.com/session/test_portal' })
        };
      }

      if (url === '/api/stripe/create-checkout-session' && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://checkout.stripe.com/c/pay/test_cs' })
        };
      }

      if (url === '/api/auth/logout' && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    };

    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'https://reviewpilot.pages.dev/dashboard.html',
      beforeParse(w) {
        w.alert = () => {};
        w.confirm = () => true;
        w.onNavigateUrl = (val) => { lastNavigatedUrl = val; };
        w.fetch = fetchHandler;
      }
    });
    const { window } = dom;

    return {
      window,
      getReviews: () => reviewsData,
      getLastNavigatedUrl: () => lastNavigatedUrl
    };
  }

  await testCase('Dashboard UI', '統計サマリーカードの正確な動的計算 (総数、平均★、未返信、AI返信率)', async () => {
    const { window } = setupLoggedInDashboard();
    await window.checkAuthState();

    // 総クチコミ数: 3件
    assert.strictEqual(getText(window.document.getElementById('statTotalReviews')), '3');
    assert.strictEqual(getText(window.document.getElementById('reviewsCountBadge')), '3件');

    // 平均評価: (5 + 5 + 2) / 3 = 4.0
    assert.strictEqual(getText(window.document.getElementById('statAvgRating')), '★ 4.0');
    assert.strictEqual(getText(window.document.getElementById('statRatingStars')), '★★★★☆');

    // 未返信件数: 2件
    assert.strictEqual(getText(window.document.getElementById('statPendingReviews')), '2');
    assert.strictEqual(getText(window.document.getElementById('statPendingBadge')), '要対応');

    // 返信完了率: 1 / 3 = 33%
    assert.strictEqual(getText(window.document.getElementById('statReplyRate')), '33%');
    assert.strictEqual(getText(window.document.getElementById('statRepliedCount')), '1 / 3 件返信完了');
  });

  await testCase('Dashboard UI', 'クチコミ一覧フィルター (すべて / 未返信 / 返信完了) のタブ切り替え', async () => {
    const { window } = setupLoggedInDashboard();
    await window.checkAuthState();

    // 初期状態: すべて (3件)
    let reviewCards = window.document.getElementById('reviewsList').children;
    assert.strictEqual(reviewCards.length, 3, '初期表示ですべてのクチコミ(3件)が表示されていません');

    // 1. 未返信のみに切り替え
    window.setReviewFilter('pending');
    reviewCards = window.document.getElementById('reviewsList').children;
    assert.strictEqual(reviewCards.length, 2, '未返信フィルターで2件が表示されていません');
    assert(window.document.getElementById('filterBtnPending').className.includes('bg-indigo-600'), '未返信ボタンがアクティブスタイルになっていません');

    // 2. 返信完了のみに切り替え
    window.setReviewFilter('replied');
    reviewCards = window.document.getElementById('reviewsList').children;
    assert.strictEqual(reviewCards.length, 1, '返信完了フィルターで1件が表示されていません');
    assert(window.document.getElementById('filterBtnReplied').className.includes('bg-indigo-600'), '返信完了ボタンがアクティブスタイルになっていません');

    // 3. すべてに戻す
    window.setReviewFilter('all');
    reviewCards = window.document.getElementById('reviewsList').children;
    assert.strictEqual(reviewCards.length, 3, 'すべてフィルターで3件に戻っていません');
  });

  await testCase('Dashboard Action', '「このAI案で即時返信」ボタンの動作と統計自動再計算', async () => {
    const { window, getReviews } = setupLoggedInDashboard();
    await window.checkAuthState();

    const buttons = Array.from(window.document.querySelectorAll('button[data-review-id]'));
    assert(buttons.length >= 2, '未返信レビューの即時返信ボタンが見つかりません');

    const targetBtn = buttons.find(b => b.dataset.reviewId === 'reviews/102');
    assert(targetBtn, 'reviews/102 の即時返信ボタンが存在しません');

    // 即時返信実行
    await window.quickReplyByDataset(targetBtn);

    // API側データが更新されたか
    const updatedReview = getReviews().find(r => r.id === 'reviews/102');
    assert(updatedReview.reply_status.startsWith('replied'), '返信ステータスが更新されていません');

    // 統計サマリーが自動再計算されたか
    assert.strictEqual(getText(window.document.getElementById('statPendingReviews')), '1', '未返信件数が1件に減少していません');
    assert.strictEqual(getText(window.document.getElementById('statReplyRate')), '67%', 'AI返信率が67%に増加していません');

    // トースト通知が表示されたか
    const toast = window.document.querySelector('.toast-animate');
    assert(toast, '返信完了のトースト通知が表示されていません');
    assert(getText(toast).includes('Googleマップへ返信を投稿しました'), 'トーストの文言が一致しません');
  });

  await testCase('Dashboard Action', '「店舗設定の保存」ボタン (自動返信スイッチ、トーン、通知先変更) と即時反映', async () => {
    const { window } = setupLoggedInDashboard();
    await window.checkAuthState();

    const nameInput = window.document.getElementById('settingLocationName');
    const autoReplyToggle = window.document.getElementById('settingAutoReply');
    const emailInput = window.document.getElementById('settingNotificationEmail');

    assert.strictEqual(nameInput.value, 'TRATTORIA SHIBUYA (渋谷店)');
    assert.strictEqual(autoReplyToggle.checked, false);

    nameInput.value = 'TRATTORIA SHIBUYA 本店 (リニューアル)';
    autoReplyToggle.checked = true;
    emailInput.value = 'new-notice@shibuya.com';

    const toneRadios = window.document.getElementsByName('aiTone');
    for (const r of toneRadios) {
      if (r.value === 'friendly') r.checked = true;
    }

    const fakeEvent = { preventDefault: () => {} };
    await window.handleSaveSettings(fakeEvent);

    assert.strictEqual(getText(window.document.getElementById('navStoreName')), 'TRATTORIA SHIBUYA 本店 (リニューアル)');

    const toast = window.document.querySelector('.toast-animate');
    assert(toast, '設定保存のトースト通知が表示されていません');
    assert(getText(toast).includes('店舗設定を保存しました'));
  });

  await testCase('Dashboard Action', '「店舗IDコピー」ボタンの動作', () => {
    const { window } = setupLoggedInDashboard();
    let copiedText = '';
    window.navigator.clipboard = {
      writeText: async (text) => { copiedText = text; }
    };

    window.copyLocationId();
    assert.strictEqual(copiedText, 'locations/184920481920', '店舗IDがクリップボードにコピーされていません');
    const toast = window.document.querySelector('.toast-animate');
    assert(toast && getText(toast).includes('店舗IDをコピーしました'));
  });

  await testCase('Dashboard Action', 'LINE連携モーダルの開閉 & 「LINEテスト通知を送信」ボタン', async () => {
    const { window } = setupLoggedInDashboard();
    await window.checkAuthState();

    const lineModal = window.document.getElementById('lineModal');
    assert(lineModal.classList.contains('hidden'));

    window.openLineModal();
    assert(!lineModal.classList.contains('hidden'), 'LINEモーダルが開いていません');

    window.closeLineModal();
    assert(lineModal.classList.contains('hidden'), 'LINEモーダルが閉じていません');

    await window.sendLineTestPush();
    const toast = window.document.querySelector('.toast-animate');
    assert(toast && getText(toast).includes('LINE公式アカウントへテスト通知を送信しました'));
  });

  await testCase('Dashboard Action', 'Stripe「プラン変更・解約（カスタマーポータル）」ボタン & チェックアウトボタン', async () => {
    const { window, getLastNavigatedUrl } = setupLoggedInDashboard();
    await window.checkAuthState();

    await window.openStripePortal();
    assert.strictEqual(getLastNavigatedUrl(), 'https://billing.stripe.com/session/test_portal');

    await window.startStripeCheckout();
    assert.strictEqual(getLastNavigatedUrl(), 'https://checkout.stripe.com/c/pay/test_cs');
  });

  await testCase('Dashboard Action', 'スマホ用タブ切り替え (switchMobileTab)', async () => {
    const { window } = setupLoggedInDashboard();
    await window.checkAuthState();

    const reviewsEl = window.document.getElementById('reviewsContainer');
    const settingsEl = window.document.getElementById('settingsContainer');

    window.switchMobileTab('settings');
    assert(reviewsEl.classList.contains('hidden'), 'settings選択時にreviewsContainerがhiddenになっていません');
    assert(!settingsEl.classList.contains('hidden'), 'settings選択時にsettingsContainerが表示されていません');

    window.switchMobileTab('reviews');
    assert(!reviewsEl.classList.contains('hidden'), 'reviews選択時にreviewsContainerが表示されていません');
    assert(settingsEl.classList.contains('hidden'), 'reviews選択時にsettingsContainerがhiddenになっていません');
  });

  await testCase('Dashboard Action', '「ログアウト」ボタン (logoutUser) の動作', async () => {
    const { window } = setupLoggedInDashboard();
    await window.checkAuthState();

    window.confirm = () => true;
    window.localStorage.setItem('rakukomi_logged_in', 'true');

    let loggedOut = false;
    const origFetch = window.fetch;
    window.fetch = async (url, opts) => {
      if (url === '/api/auth/logout') {
        loggedOut = true;
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url === '/api/auth/me' && loggedOut) {
        return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
      }
      return origFetch(url, opts);
    };

    await window.logoutUser();

    assert(loggedOut, 'ログアウトAPIが呼び出されていません');
    assert.strictEqual(window.localStorage.getItem('rakukomi_logged_in'), null, 'localStorage のログインフラグが削除されていません');

    const loginView = window.document.getElementById('loginView');
    const dashboardView = window.document.getElementById('dashboardView');
    assert(!loginView.classList.contains('hidden'), 'ログアウト後に loginView が表示されていません');
    assert(dashboardView.classList.contains('hidden'), 'ログアウト後に dashboardView が非表示になっていません');
  });

  // ===========================================================================
  // SECTION 6: 個別返信画面 (reply.html) の徹底検証
  // ===========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【6. 個別返信画面 (reply.html) の全機能徹底検証】');
  console.log('----------------------------------------------------------------');

  await testCase('Reply Page', 'URLパラメータの読み込み、レビューデータ反映、案A/B/C切り替え、文字数カウント', async () => {
    const html = readPublicFile('reply.html');
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'https://reviewpilot.pages.dev/reply.html?review_id=reviews/102&location_id=locations/184920481920'
    });
    const { window } = dom;

    window.fetch = async (url) => {
      if (url === '/api/auth/me') {
        return {
          ok: true,
          json: async () => ({
            locations: [{ id: 'locations/184920481920', location_name: 'TRATTORIA SHIBUYA (渋谷店)' }]
          })
        };
      }
      if (url.startsWith('/api/reviews')) {
        return {
          ok: true,
          json: async () => ({
            reviews: [
              {
                id: 'reviews/102',
                location_id: 'locations/184920481920',
                reviewer_name: 'John Doe',
                star_rating: 5,
                comment: 'The truffle pasta was absolutely phenomenal!',
                translated_comment: 'トリュフパスタが本当に絶品でした！',
                generated_reply_a: 'Thank you very much for your feedback! (案A)',
                generated_reply_b: 'Thank you so much! 😊 (案B)',
                generated_reply_c: 'Thank you for visiting us. (案C)'
              }
            ]
          })
        };
      }
      return { ok: false, json: async () => ({}) };
    };

    await window.initPage();

    assert.strictEqual(getText(window.document.getElementById('header-store-name')), 'TRATTORIA SHIBUYA (渋谷店)');
    assert(getText(window.document.getElementById('reviewer-name')).includes('John Doe 様'));
    assert(getText(window.document.getElementById('review-comment')).includes('truffle pasta'));

    const transBox = window.document.getElementById('review-translation-box');
    assert(!transBox.classList.contains('hidden'), '英語レビューで翻訳ボックスが表示されていません');
    assert(getText(window.document.getElementById('review-translation-text')).includes('トリュフパスタ'));

    const textarea = window.document.getElementById('reply-text');
    assert.strictEqual(textarea.value, 'Thank you very much for your feedback! (案A)');
    assert(getText(window.document.getElementById('char-count')).includes('文字'));

    window.insertTemplate('b');
    assert.strictEqual(textarea.value, 'Thank you so much! 😊 (案B)');

    window.insertTemplate('c');
    assert.strictEqual(textarea.value, 'Thank you for visiting us. (案C)');

    textarea.value = '追記メッセージを追加しました。';
    textarea.dispatchEvent(new window.Event('input'));
    assert.strictEqual(getText(window.document.getElementById('char-count')), `${textarea.value.length} 文字`);
  });

  await testCase('Reply Page', '「Googleマップに返信する」ボタン押下時の送信と完了モーダル表示', async () => {
    const html = readPublicFile('reply.html');
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'https://reviewpilot.pages.dev/reply.html?review_id=reviews/102&location_id=locations/184920481920'
    });
    const { window } = dom;

    let replySubmitted = false;
    let submittedPayload = null;

    window.alert = () => {};

    window.fetch = async (url, options = {}) => {
      const method = options.method || 'GET';

      if (url === '/api/auth/me') {
        return { ok: true, json: async () => ({ locations: [{ id: 'locations/184920481920', location_name: '渋谷店' }] }) };
      }
      if (url === '/api/reviews/reply' && method === 'POST') {
        replySubmitted = true;
        submittedPayload = JSON.parse(options.body);
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.startsWith('/api/reviews')) {
        return {
          ok: true,
          json: async () => ({
            reviews: [{ id: 'reviews/102', location_id: 'locations/184920481920', star_rating: 5, comment: 'test' }]
          })
        };
      }
      return { ok: false, json: async () => ({}) };
    };

    await window.initPage();

    const textarea = window.document.getElementById('reply-text');
    textarea.value = '心を込めて返信いたします。';

    const modal = window.document.getElementById('modal');
    assert(modal.classList.contains('hidden'), '送信前に完了モーダルが表示されています');

    await window.submitReply();

    assert(replySubmitted, '/api/reviews/reply が送信されていません');
    assert.strictEqual(submittedPayload.reviewId, 'reviews/102');
    assert.strictEqual(submittedPayload.locationId, 'locations/184920481920');
    assert.strictEqual(submittedPayload.replyText, '心を込めて返信いたします。');
    assert.strictEqual(submittedPayload.replyStatus, 'replied_manual');

    assert(!modal.classList.contains('hidden'), '送信成功後に完了モーダルが表示されていません');

    const returnLink = modal.querySelector('a[href="/dashboard.html"]');
    assert(returnLink, '完了モーダル内に管理画面への戻りリンクが存在しません');
  });

  // ===========================================================================
  // SECTION 7: DOM ID・クラス・イベントハンドラ総合整合性監査
  // ===========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【7. 全DOM要素ID・インラインイベントハンドラ総合整合性監査】');
  console.log('----------------------------------------------------------------');

  for (const page of ['dashboard.html', 'reply.html', 'index.html']) {
    await testCase('DOM Consistency', `${page} 内のインラインイベントハンドラ定義チェック`, () => {
      const html = readPublicFile(page);
      const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        url: `https://reviewpilot.pages.dev/${page}`,
        beforeParse(w) {
          w.fetch = () => Promise.resolve({ ok: false, json: async () => ({}) });
        }
      });
      const { window } = dom;

      const allElements = window.document.querySelectorAll('*');
      for (const el of allElements) {
        for (const attr of el.attributes) {
          if (attr.name.startsWith('on')) {
            const code = attr.value;
            const fnMatch = code.match(/^([a-zA-Z0-9_$]+)\s*\(/);
            if (fnMatch) {
              const fnName = fnMatch[1];
              assert(
                typeof window[fnName] === 'function',
                `${page} の <${el.tagName.toLowerCase()}> の ${attr.name}="${code}" で参照されている関数 "${fnName}" が window スコープに定義されていません！`
              );
            }
          }
        }
      }
    });
  }

  // ===========================================================================
  // 総合結果出力
  // ===========================================================================
  console.log('\n================================================================');
  console.log('📊 全画面・機能動作検証 総合サマリー');
  console.log('================================================================');
  console.log(`実行テスト総数 : ${stats.total}`);
  console.log(`成功 (PASSED)  : \x1b[32m${stats.passed}\x1b[0m`);
  console.log(`失敗 (FAILED)  : ${stats.failed > 0 ? `\x1b[31m${stats.failed}\x1b[0m` : '\x1b[32m0\x1b[0m'}`);
  console.log('================================================================');

  if (stats.failed > 0) {
    console.error('\n🚨 以下のテストで不具合が検出されました:');
    for (const err of stats.errors) {
      console.error(`- ${err.id} [${err.category}] ${err.title}: ${err.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n✨ 全ページ・全リンク・全タブ・全ボタン・画面遷移・フォームの完全動作が確認されました！ ✨');
  }
}

runAllVerifications().catch(err => {
  console.error('致命的エラー:', err);
  process.exit(1);
});
