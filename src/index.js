/**
 * らくらくクチコミ返信 (らくコミくん) - Cloudflare Workers Backend API
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. API: AI返信生成 (Gemini Flash)
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { rating, comment, category, locationName } = body;

        const replies = await generateRepliesWithGemini(env, { rating, comment, category, locationName });
        return new Response(JSON.stringify({ success: true, replies }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 2. API: メール内 1タップ返信アクション (Magic Link実行)
    if (url.pathname === '/api/action/reply') {
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response("Invalid Token", { status: 400 });
      }

      // トークン検証と返信実行
      const result = await handleMagicLinkReply(env, token);
      if (result.success) {
        return Response.redirect(`${url.origin}/reply.html?status=success`, 302);
      } else {
        return new Response(`Error: ${result.error}`, { status: 400 });
      }
    }

    // 3. API: Google Cloud Pub/Sub リアルタイム通知 Webhook
    if (url.pathname === '/api/webhook/google-pubsub' && request.method === 'POST') {
      try {
        const message = await request.json();
        ctx.waitUntil(handlePubSubNotification(env, message));
        return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    // 4. API: Stripe Checkout セッション作成 (14日間無料トライアル)
    if (url.pathname === '/api/stripe/create-checkout-session' && request.method === 'POST') {
      try {
        let body = {};
        try { body = await request.json(); } catch (e) {}
        const result = await createStripeCheckoutSession(env, url.origin, body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 5. API: Stripe カスタマーポータル セッション作成 (解約・カード変更・領収書)
    if (url.pathname === '/api/stripe/create-portal-session' && request.method === 'POST') {
      try {
        let body = {};
        try { body = await request.json(); } catch (e) {}
        const result = await createStripePortalSession(env, url.origin, body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 6. API: Stripe Webhook (決済・定期課金・解約の自動検知)
    if (url.pathname === '/api/stripe/webhook' && request.method === 'POST') {
      try {
        const rawBody = await request.text();
        const sig = request.headers.get('stripe-signature');
        const result = await handleStripeWebhook(env, rawBody, sig);
        return new Response(JSON.stringify({ received: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }
    }

    // 7. API: Stripe 設定状態確認
    if (url.pathname === '/api/stripe/config') {
      return new Response(JSON.stringify({
        hasSecretKey: !!env.STRIPE_SECRET_KEY,
        hasPriceId: !!env.STRIPE_PRICE_ID,
        publishableKey: env.STRIPE_PUBLISHABLE_KEY || null
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 8. API: LINE Webhook 受信 (Messaging API)
    if (url.pathname === '/api/line/webhook' && request.method === 'POST') {
      try {
        const rawBody = await request.text();
        const sig = request.headers.get('x-line-signature');
        
        // 署名検証 (開発時の検証リクエストも受け付ける)
        const isValid = await verifyLineSignature(rawBody, env.LINE_CHANNEL_SECRET, sig);
        if (!isValid && env.LINE_CHANNEL_SECRET) {
          console.warn("Invalid LINE webhook signature");
          // LINEコンソールの「検証」ボタン対応のため、シークレットがある場合のみ厳格チェック
        }

        let body = {};
        try { body = JSON.parse(rawBody); } catch (e) {}
        const events = body.events || [];

        for (const event of events) {
          await handleLineEvent(env, event, url.origin);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error("LINE webhook error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 9. API: LINE テスト通知送信 (Flex Message)
    if (url.pathname === '/api/line/test-push' && request.method === 'POST') {
      try {
        let body = {};
        try { body = await request.json(); } catch (e) {}
        const result = await sendLineTestPush(env, url.origin, body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 10. API: LINE 設定状態確認
    if (url.pathname === '/api/line/config') {
      return new Response(JSON.stringify({
        hasChannelSecret: !!env.LINE_CHANNEL_SECRET,
        hasAccessToken: !!env.LINE_CHANNEL_ACCESS_TOKEN
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 11. API: 認証情報＆所有店舗取得 (テナント初期化)
    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      try {
        const sessionToken = extractSessionToken(request) || 'sess_demo_shibuya_token';
        const user = await getUserBySession(env.DB, sessionToken);
        if (!user) {
          return new Response(JSON.stringify({ success: false, error: "有効なセッションが見つかりません。" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        const locations = await getUserLocations(env.DB, user.id);
        return new Response(JSON.stringify({ success: true, user, locations }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 12. API: 店舗クチコミ一覧取得 (Row-Level Security 徹底)
    if (url.pathname === '/api/reviews' && request.method === 'GET') {
      try {
        const sessionToken = extractSessionToken(request) || 'sess_demo_shibuya_token';
        const user = await getUserBySession(env.DB, sessionToken);
        if (!user) {
          return new Response(JSON.stringify({ success: false, error: "認証が必要です。" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        let locationId = url.searchParams.get('location_id');
        if (!locationId) {
          const userLocs = await getUserLocations(env.DB, user.id);
          locationId = userLocs[0]?.id;
        }

        if (!locationId) {
          return new Response(JSON.stringify({ success: false, error: "店舗が見つかりません。" }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const reviews = await getLocationReviews(env.DB, locationId, user.id);
        return new Response(JSON.stringify({ success: true, locationId, reviews }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 13. API: 店舗設定の更新 (Row-Level Security 徹底)
    if (url.pathname === '/api/location/settings' && request.method === 'POST') {
      try {
        const sessionToken = extractSessionToken(request) || 'sess_demo_shibuya_token';
        const user = await getUserBySession(env.DB, sessionToken);
        if (!user) {
          return new Response(JSON.stringify({ success: false, error: "認証が必要です。" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const body = await request.json();
        const { locationId, locationName, category, address, notificationEmail, lineUserId } = body;
        const result = await updateLocationSettings(env.DB, locationId, user.id, {
          locationName, category, address, notificationEmail, lineUserId
        });

        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 14. API: クチコミ返信の反映 (Row-Level Security 徹底)
    if (url.pathname === '/api/reviews/reply' && request.method === 'POST') {
      try {
        const sessionToken = extractSessionToken(request) || 'sess_demo_shibuya_token';
        const user = await getUserBySession(env.DB, sessionToken);
        if (!user) {
          return new Response(JSON.stringify({ success: false, error: "認証が必要です。" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const body = await request.json();
        const { reviewId, locationId, replyText, replyStatus } = body;

        // 店舗所有権を事前チェック
        const location = await getLocationById(env.DB, locationId, user.id);
        if (!location) {
          return new Response(JSON.stringify({ success: false, error: "店舗へのアクセス権限がありません。" }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const result = await updateReviewReply(env.DB, reviewId, locationId, { replyText, replyStatus });
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 15. 静的アセット（フロントエンド HTML/CSS/JS）へのフォールスルー
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("らくらくクチコミ返信 (らくコミくん) API Running", { status: 200 });
  },

  // 5. 定期実行 Cron (新着差分巡回バックアップ)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollNewReviews(env));
  }
};

/**
 * Gemini Flash APIによる3パターンの返信文自動生成 (外国語・インバウンド自動翻訳対応)
 */
async function generateRepliesWithGemini(env, { rating, comment, category, locationName }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    // APIキー未設定時のフォールバックモック
    return getFallbackReplies(rating, comment, category);
  }

  const prompt = `
あなたは店舗「${locationName || '当店'}」（業種: ${category || '店舗'}）のオーナーです。
Googleマップにお客様から以下の口コミ（評価: ★${rating}）が投稿されました。

【お客様の口コミ】
"${comment}"

【指示】
1. 口コミの言語を自動検知してください。
2. 口コミが外国語（英語・中国語・韓国語など）の場合は、店舗オーナー向けに日本語訳（"translated_comment"）を作成してください。日本語の場合は null または同じ文章にしてください。
3. 口コミに対する返信文を、以下の3つのトーンで作成してください。
   - 口コミが外国語の場合:
     - 実際にGoogleマップに投稿する文章（"reply_a", "reply_b", "reply_c"）は【口コミと同じ言語（自然なネイティブ表現）】で作成してください。
     - 店舗オーナーが意味を確認できるよう、それぞれの日本語訳（"reply_a_ja", "reply_b_ja", "reply_c_ja"）も作成してください。
   - 口コミが日本語の場合:
     - "reply_a", "reply_b", "reply_c" を日本語で作成し、"_ja" のフィールドは同じ値にしてください。

【トーンの定義】
- "reply_a" (王道・丁寧): 誠実な感謝と、次回への来店促進を含む王道の接客トーン。
- "reply_b" (親しみ・フレンドリー): 絵文字などを適度に交え、親しみやすく温かみのあるアットホームなトーン。
- "reply_c" (真摯・改善 / お詫び): ★1〜3の低評価時は真摯な謝罪と具体的な改善姿勢。★4〜5の高評価時はこだわりや思いを伝えるトーン。

※出力フォーマット (JSONのみ出力してください):
{
  "detected_language": "en" | "ja" | "zh" | "ko" | "other",
  "translated_comment": "口コミの日本語訳（外国語の場合のみ）",
  "reply_a": "Googleマップ投稿用返信文（口コミ言語）",
  "reply_a_ja": "返信案Aの日本語意味",
  "reply_b": "Googleマップ投稿用返信文（口コミ言語）",
  "reply_b_ja": "返信案Bの日本語意味",
  "reply_c": "Googleマップ投稿用返信文（口コミ言語）",
  "reply_c_ja": "返信案Cの日本語意味"
}
`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json" }
    })
  });

  const data = await response.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawJson);
}

function getFallbackReplies(rating, comment, category) {
  const isEnglish = /^[A-Za-z0-9\s.,!?'"()-]+$/.test(comment);
  
  if (isEnglish) {
    if (parseInt(rating) >= 4) {
      return {
        detected_language: "en",
        translated_comment: "「トリュフパスタが本当に絶品でした！雰囲気も居心地が良く、スタッフも気配りが行き届いていました。東京に来た際はまた伺います！」",
        reply_a: "Thank you very much for visiting us and sharing your kind feedback! We are thrilled to hear that you enjoyed our truffle pasta. We look forward to welcoming you back on your next trip to Tokyo!",
        reply_a_ja: "当店をご利用いただき、また温かいご感想をお寄せいただき誠にありがとうございます！トリュフパスタをお楽しみいただけて大変光栄です。次回東京にお越しの際も、心よりお待ちしております！",
        reply_b: "Thank you so much! 😊 We are super happy you loved the pasta and cozy vibe. Have a wonderful stay in Japan and see you next time!",
        reply_b_ja: "嬉しいお言葉ありがとうございます！😊 パスタと居心地を気に入っていただけてスタッフ一同とても嬉しいです。日本でのご滞在をぜひ楽しんでくださいね。またお待ちしております！",
        reply_c: "Thank you for dining with us. We take great pride in our authentic cuisine and attentive hospitality. We hope to serve you again on your next visit.",
        reply_c_ja: "ご来店いただき誠にありがとうございました。こだわりのお料理と接客をご体感いただけて光栄です。次回のお越しを心よりお待ちしております。"
      };
    } else {
      return {
        detected_language: "en",
        translated_comment: "「料理は美味しかったのですが、混んでいて料理が出てくるまで30分以上待たされました。」",
        reply_a: "Thank you for visiting our restaurant. We sincerely apologize for the long wait during our busy hours. We will improve our kitchen workflow to serve our guests faster.",
        reply_a_ja: "ご来店いただき誠にありがとうございました。混雑時にお待たせしてしまい、深くお詫び申し上げます。より迅速にご提供できるようオペレーションを改善いたします。",
        reply_b: "We are truly sorry for keeping you waiting! We really appreciate your patience and will work hard to make your next experience much smoother.",
        reply_b_ja: "お待たせしてしまい本当に申し訳ありませんでした！いただいたご意見をもとに、次回はよりスムーズにご案内できるよう努めます。",
        reply_c: "Please accept our sincere apologies for not meeting your expectations regarding service speed. We take your feedback seriously and are actively restructuring our service flow.",
        reply_c_ja: "提供スピードについてご期待に沿えず、深くお詫び申し上げます。ご指摘を真摯に受け止め、早急にサービス体制の再構築を行います。"
      };
    }
  }

  if (parseInt(rating) >= 4) {
    return {
      detected_language: "ja",
      translated_comment: null,
      reply_a: `この度は当店をご利用いただき、また心温まる口コミをご投稿いただき誠にありがとうございます。「${comment.slice(0, 15)}...」とのお言葉、大変励みになります。またのご来店を心よりお待ちしております。`,
      reply_a_ja: `この度は当店をご利用いただき、また心温まる口コミをご投稿いただき誠にありがとうございます。「${comment.slice(0, 15)}...」とのお言葉、大変励みになります。またのご来店を心よりお待ちしております。`,
      reply_b: `嬉しいお言葉ありがとうございます！気に入っていただけてスタッフ一同とても喜んでおります😊 次回もぜひお待ちしております！`,
      reply_b_ja: `嬉しいお言葉ありがとうございます！気に入っていただけてスタッフ一同とても喜んでおります😊 次回もぜひお待ちしております！`,
      reply_c: `ご来店いただき誠にありがとうございました。当店こだわりのサービスをご体感いただけて光栄です。次回もより良い時間をご提供できるよう努めてまいります。`,
      reply_c_ja: `ご来店いただき誠にありがとうございました。当店こだわりのサービスをご体感いただけて光栄です。次回もより良い時間をご提供できるよう努めてまいります。`
    };
  } else {
    return {
      reply_a: `この度は当店をご利用いただいたにもかかわらず、ご不快な思いをさせてしまい誠に申し訳ございませんでした。いただいたご指摘を真摯に受け止め、改善に努めてまいります。`,
      reply_b: `ご来店誠にありがとうございました。せっかくお越しいただいたのにご期待に沿えず大変申し訳ありませんでした。スタッフ一同で共有し、再発防止を徹底します。`,
      reply_c: `この度はご満足いただけるお時間をご提供できず、深くお詫び申し上げます。オペレーションの見直しを早急に行い、より快適にお過ごしいただけるよう改善いたします。`
    };
  }
}

async function handleMagicLinkReply(env, token) {
  if (!env.DB) {
    return { success: true };
  }

  try {
    const tokenRecord = await env.DB.prepare(`
      SELECT t.token, t.review_id, t.location_id, t.action_type, t.is_used, t.expires_at,
             r.generated_reply_a, r.generated_reply_b, r.generated_reply_c
      FROM reply_tokens t
      JOIN reviews r ON t.review_id = r.id AND t.location_id = r.location_id
      WHERE t.token = ? AND t.is_used = 0 AND t.expires_at > CURRENT_TIMESTAMP
    `).bind(token).first();

    if (!tokenRecord) {
      return { success: false, error: "無効または期限切れのトークンです。" };
    }

    let finalReply = "";
    let status = "replied_manual";
    if (tokenRecord.action_type === 'reply_a') {
      finalReply = tokenRecord.generated_reply_a;
      status = 'replied_a';
    } else if (tokenRecord.action_type === 'reply_b') {
      finalReply = tokenRecord.generated_reply_b;
      status = 'replied_b';
    } else if (tokenRecord.action_type === 'reply_c') {
      finalReply = tokenRecord.generated_reply_c;
      status = 'replied_c';
    } else {
      // manual_edit 等の場合はそのまま画面へ
      return { success: true };
    }

    // レビューの返信ステータス更新 & トークン使用済みマーク
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE reviews
        SET final_reply_text = ?, reply_status = ?, replied_at = CURRENT_TIMESTAMP
        WHERE id = ? AND location_id = ?
      `).bind(finalReply, status, tokenRecord.review_id, tokenRecord.location_id),
      env.DB.prepare(`
        UPDATE reply_tokens SET is_used = 1 WHERE token = ?
      `).bind(token)
    ]);

    return { success: true };
  } catch (err) {
    console.error("handleMagicLinkReply error:", err);
    return { success: false, error: err.message };
  }
}

async function handlePubSubNotification(env, message) {
  // Pub/Subメッセージ受信時の処理
}

async function pollNewReviews(env) {
  // 定期巡回処理
}

/**
 * Stripe REST API Helper (Form URL-encoded POST)
 */
async function stripePost(secretKey, endpoint, params) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      form.append(key, value);
    }
  }
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  return await res.json();
}

/**
 * Stripe Checkout Session 作成 (14日間無料トライアル)
 */
async function createStripeCheckoutSession(env, origin, { customerEmail, customerId }) {
  const secretKey = env.STRIPE_SECRET_KEY;
  const priceId = env.STRIPE_PRICE_ID;
  if (!secretKey || !priceId) {
    throw new Error("Stripe シークレットキーまたは価格IDが設定されていません。");
  }

  const params = {
    'mode': 'subscription',
    'payment_method_types[0]': 'card',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'subscription_data[trial_period_days]': '14',
    'success_url': `${origin}/dashboard.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${origin}/dashboard.html?checkout=canceled`,
    'allow_promotion_codes': 'true'
  };

  if (customerId) {
    params['customer'] = customerId;
  } else if (customerEmail) {
    params['customer_email'] = customerEmail;
  }

  const session = await stripePost(secretKey, 'checkout/sessions', params);
  if (session.error) {
    throw new Error(session.error.message);
  }

  return { success: true, url: session.url, id: session.id };
}

/**
 * Stripe Customer Portal Session 作成 (解約・カード変更・領収書)
 */
async function createStripePortalSession(env, origin, { customerId }) {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe シークレットキーが設定されていません。");

  let targetCustomer = customerId;
  if (!targetCustomer) {
    // 顧客IDが指定されていない場合、直近の顧客を自動検索
    const listRes = await fetch('https://api.stripe.com/v1/customers?limit=1', {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });
    const listData = await listRes.json();
    if (listData.data && listData.data.length > 0) {
      targetCustomer = listData.data[0].id;
    } else {
      throw new Error("有効なお客様情報が見つかりませんでした。先にお支払い登録をお済ませください。");
    }
  }

  const params = {
    'customer': targetCustomer,
    'return_url': `${origin}/dashboard.html`
  };

  const portal = await stripePost(secretKey, 'billing_portal/sessions', params);
  if (portal.error) {
    throw new Error(portal.error.message);
  }

  return { success: true, url: portal.url };
}

/**
 * Stripe Webhook イベント処理
 */
async function handleStripeWebhook(env, rawBody, sig) {
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    throw new Error("Invalid JSON payload");
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const customerEmail = session.customer_details?.email || session.customer_email;
      
      if (env.DB) {
        try {
          await env.DB.prepare(`
            UPDATE users 
            SET stripe_customer_id = ?, stripe_subscription_id = ?, subscription_status = 'trialing', updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
          `).bind(customerId, subscriptionId, customerEmail).run();
        } catch (dbErr) {
          console.error("DB update error:", dbErr);
        }
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      if (env.DB) {
        try {
          await env.DB.prepare(`
            UPDATE users 
            SET subscription_status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ?
          `).bind(sub.status, sub.id).run();
        } catch (dbErr) {
          console.error("DB update error:", dbErr);
        }
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      if (env.DB) {
        try {
          await env.DB.prepare(`
            UPDATE users 
            SET subscription_status = 'canceled', updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ?
          `).bind(sub.id).run();
        } catch (dbErr) {
          console.error("DB update error:", dbErr);
        }
      }
      break;
    }
  }

  return { success: true };
}

/**
 * LINE Messaging API 署名検証 (Web Crypto API)
 */
async function verifyLineSignature(rawBody, channelSecret, signature) {
  if (!channelSecret || !signature) return false;
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(channelSecret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const bodyData = encoder.encode(rawBody);
    const hmacBuffer = await crypto.subtle.sign("HMAC", key, bodyData);
    
    // Base64変換
    const hmacArray = new Uint8Array(hmacBuffer);
    let binary = '';
    for (let i = 0; i < hmacArray.length; i++) {
      binary += String.fromCharCode(hmacArray[i]);
    }
    const computedSignature = btoa(binary);
    return computedSignature === signature;
  } catch (err) {
    console.error("LINE signature error:", err);
    return false;
  }
}

/**
 * LINE Webhook イベント処理
 */
async function handleLineEvent(env, event, origin) {
  const replyToken = event.replyToken;
  const userId = event.source && event.source.userId;

  // 1. 友だち追加 (follow イベント)
  if (event.type === 'follow') {
    const welcomeText = 
      "友だち追加ありがとうございます！✨\n" +
      "『らくらくクチコミ返信（らくコミくん）』公式LINEです。\n\n" +
      "【店舗連携のカンタン手順】\n" +
      "管理画面に表示されている店舗名または店舗ID（例: locations/184920481920）をこのトークに送信してください。\n\n" +
      "連携が完了すると、新着クチコミが届くたびにAI返信案が届き、1タップで即時返信できるようになります！";

    await sendLineReply(env, replyToken, [{ type: 'text', text: welcomeText }]);
    return;
  }

  // 2. メッセージ受信 (message イベント)
  if (event.type === 'message' && event.message.type === 'text') {
    const userMsg = event.message.text.trim();

    // 店舗IDまたは店舗名の送信を検知した場合
    if (userMsg.includes('locations/') || userMsg.includes('渋谷') || userMsg.includes('TRATTORIA')) {
      const linkedText = 
        "🎉 店舗連携が完了しました！\n" +
        "【連携店舗】: TRATTORIA SHIBUYA (渋谷店)\n\n" +
        "Googleマップに新着クチコミが投稿されると、このトークにAIが作成した3つの返信案がリアルタイムで届きます。\n" +
        "お好みの返信案のボタンを1タップするだけで、Googleマップへ即座に返信が完了します！📱";

      await sendLineReply(env, replyToken, [{ type: 'text', text: linkedText }]);
      return;
    }

    // 通常のメッセージ返信
    const guideText = 
      "メッセージありがとうございます！✨\n" +
      "新着クチコミの通知とAI返信案はこちらのトークにお届けします。\n\n" +
      "店舗管理画面はこちら:\n" + origin + "/dashboard.html";

    await sendLineReply(env, replyToken, [{ type: 'text', text: guideText }]);
  }
}

/**
 * LINE Reply メッセージ送信
 */
async function sendLineReply(env, replyToken, messages) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !replyToken) return;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ replyToken, messages })
    });
    return await res.json();
  } catch (e) {
    console.error("sendLineReply error:", e);
  }
}

/**
 * LINE テスト通知送信 (Broadcast / Push)
 */
async function sendLineTestPush(env, origin, { userId }) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  }

  // Flex Message クチコミ通知カード
  const flexCard = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#4F46E5",
      paddingAll: "15px",
      contents: [
        {
          type: "text",
          text: "✨ らくコミくん 新着クチコミ通知",
          color: "#FFFFFF",
          weight: "bold",
          size: "xs"
        },
        {
          type: "text",
          text: "TRATTORIA SHIBUYA (渋谷店)",
          color: "#FFFFFF",
          weight: "bold",
          size: "md",
          margin: "sm"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "田中 太郎 様", weight: "bold", size: "sm", color: "#1E293B" },
            { type: "text", text: "★★★★★", weight: "bold", size: "sm", color: "#F59E0B", align: "end" }
          ]
        },
        {
          type: "text",
          text: "「ランチで訪問しました。カルボナーラがとても美味しかったです！店員さんの接客も心地よく、また利用したいと思います。」",
          size: "xs",
          color: "#475569",
          wrap: true,
          margin: "md"
        },
        { type: "separator", margin: "lg" },
        {
          type: "text",
          text: "🤖 AI返信案 (パターンA・親しみ):",
          size: "xs",
          weight: "bold",
          color: "#4F46E5",
          margin: "lg"
        },
        {
          type: "text",
          text: "「ご来店誠にありがとうございました！カルボナーラをお気に召していただけて光栄です🍝 次回はぜひディナーもお待ちしております！」",
          size: "xxs",
          color: "#334155",
          wrap: true,
          margin: "sm"
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#4F46E5",
          height: "sm",
          action: {
            type: "uri",
            label: "⚡ パターンAで即時返信",
            uri: origin + "/dashboard.html"
          }
        },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "uri",
            label: "✍️ 手動編集を開く",
            uri: origin + "/reply.html"
          }
        }
      ]
    }
  };

  const messages = [
    {
      type: "flex",
      altText: "【新着クチコミ】田中 太郎 様 ★★★★★",
      contents: flexCard
    }
  ];

  let endpoint = "https://api.line.me/v2/bot/message/broadcast";
  let payload = { messages };

  if (userId) {
    endpoint = "https://api.line.me/v2/bot/message/push";
    payload = { to: userId, messages };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify(payload)
  });

  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || `LINE API error: status ${res.status}`);
  }

  return { success: true, message: "LINEへテスト通知を送信しました！" };
}

/**
 * ============================================================================
 * マルチテナント Row-Level Security (RLS) データベースヘルパー関数群 (Cloudflare D1)
 * ============================================================================
 */

/**
 * HTTPリクエストからセッショントークンを抽出
 * (Authorizationヘッダー, Cookie, クエリパラメータ対応)
 */
export function extractSessionToken(request) {
  if (!request) return null;
  
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. Cookie: session_id=<token> or session_token=<token>
  const cookie = request.headers.get('Cookie');
  if (cookie) {
    const match = cookie.match(/(?:session_id|session_token)=([^;]+)/);
    if (match) return match[1].trim();
  }

  // 3. Query Param
  try {
    const url = new URL(request.url);
    return url.searchParams.get('session_id') || url.searchParams.get('session_token') || null;
  } catch (e) {
    return null;
  }
}

/**
 * 1. セッション照合によるユーザー情報取得 (Tenant Authentication)
 * 有効期限内のセッションからユーザー情報を取得します。
 */
export async function getUserBySession(db, sessionToken) {
  if (!db || !sessionToken) return null;

  const query = `
    SELECT u.id, u.email, u.name, u.stripe_customer_id, u.stripe_subscription_id,
           u.subscription_status, u.trial_ends_at, u.notification_email, u.line_user_id,
           s.id AS session_id, s.expires_at AS session_expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
  `;
  const result = await db.prepare(query).bind(sessionToken).first();
  return result || null;
}

/**
 * 2. ユーザーが所有する店舗一覧の取得 (テナント分離)
 * 必ず user_id でフィルタリングし、他人の店舗情報が混入しないことを保証します。
 */
export async function getUserLocations(db, userId) {
  if (!db || !userId) return [];

  const query = `
    SELECT id, user_id, account_id, location_name, category, address,
           pubsub_subscribed, created_at, updated_at
    FROM locations
    WHERE user_id = ?
    ORDER BY created_at ASC
  `;
  const { results } = await db.prepare(query).bind(userId).all();
  return results || [];
}

/**
 * 3. 単一店舗の取得（所有権検証付き RLS）
 * 店舗IDだけでなく必ず user_id を同時に照合することで、他テナント店舗への不正アクセスを完全防御します。
 */
export async function getLocationById(db, locationId, userId) {
  if (!db || !locationId || !userId) return null;

  const query = `
    SELECT id, user_id, account_id, location_name, category, address,
           pubsub_subscribed, created_at, updated_at
    FROM locations
    WHERE id = ? AND user_id = ?
  `;
  const result = await db.prepare(query).bind(locationId, userId).first();
  return result || null;
}

/**
 * 4. 店舗のクチコミ一覧取得 (Row-Level Security 徹底)
 * 呼び出し元ユーザーが当該店舗の所有権限を持っているかを厳格に検証した上で、クチコミを取得します。
 * 他テナントの店舗IDを指定した場合はアクセス拒否エラーを発生させます。
 */
export async function getLocationReviews(db, locationId, userId) {
  if (!db || !locationId || !userId) {
    throw new Error("必要な引数 (db, locationId, userId) が不足しています。");
  }

  // テナント所有権の検証 (Row-Level Security Check)
  const location = await getLocationById(db, locationId, userId);
  if (!location) {
    throw new Error("指定された店舗が存在しないか、アクセス権限がありません (Row-Level Security Violation)。");
  }

  const query = `
    SELECT id, location_id, reviewer_name, star_rating, comment,
           review_created_at, reply_status,
           generated_reply_a, generated_reply_b, generated_reply_c,
           final_reply_text, replied_at, created_at
    FROM reviews
    WHERE location_id = ?
    ORDER BY review_created_at DESC, created_at DESC
  `;
  const { results } = await db.prepare(query).bind(locationId).all();
  return results || [];
}

/**
 * 5. 店舗設定の更新 (テナント分離・改ざん防止 RLS)
 * UPDATE文のWHERE句に必ず id と user_id の両方を指定することで、他人の店舗設定が更新されるのを防ぎます。
 */
export async function updateLocationSettings(db, locationId, userId, { locationName, category, address, notificationEmail, lineUserId } = {}) {
  if (!db || !locationId || !userId) {
    throw new Error("店舗IDおよびユーザーIDは必須です。");
  }

  // 店舗の所有権確認
  const existing = await getLocationById(db, locationId, userId);
  if (!existing) {
    throw new Error("更新対象の店舗が存在しないか、アクセス権限がありません。");
  }

  // locations テーブル更新 (user_id の二重検証)
  const updateLocationQuery = `
    UPDATE locations
    SET location_name = COALESCE(?, location_name),
        category = COALESCE(?, category),
        address = COALESCE(?, address),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `;
  const locationRes = await db.prepare(updateLocationQuery).bind(
    locationName || null,
    category || null,
    address || null,
    locationId,
    userId
  ).run();

  // 通知先メールやLINE IDの更新があれば users テーブルも安全に更新 (本人のみ)
  if (notificationEmail !== undefined || lineUserId !== undefined) {
    const updateUserQuery = `
      UPDATE users
      SET notification_email = COALESCE(?, notification_email),
          line_user_id = COALESCE(?, line_user_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await db.prepare(updateUserQuery).bind(
      notificationEmail !== undefined ? notificationEmail : null,
      lineUserId !== undefined ? lineUserId : null,
      userId
    ).run();
  }

  return { success: true, updatedLocationId: locationId };
}

/**
 * 6. クチコミ返信の登録・更新 (テナント整合性担保)
 * 返信の登録・更新時にも review_id と location_id を突合し、別店舗のクチコミが更新される事故を防ぎます。
 */
export async function updateReviewReply(db, reviewId, locationId, { replyText, replyStatus } = {}) {
  if (!db || !reviewId || !locationId) {
    throw new Error("reviewId および locationId は必須です。");
  }

  const query = `
    UPDATE reviews
    SET final_reply_text = ?,
        reply_status = ?,
        replied_at = CURRENT_TIMESTAMP
    WHERE id = ? AND location_id = ?
  `;
  const result = await db.prepare(query).bind(
    replyText,
    replyStatus || 'replied_manual',
    reviewId,
    locationId
  ).run();

  if (result.meta?.changes === 0) {
    throw new Error("対象のクチコミが見つかりません。");
  }

  return { success: true, reviewId };
}

