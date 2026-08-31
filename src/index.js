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
        // Pub/Subメッセージの解析と処理
        ctx.waitUntil(handlePubSubNotification(env, message));
        return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    // 4. 静的アセット（フロントエンド HTML/CSS/JS）へのフォールスルー
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
  // DBからトークン照合、Google Business Profile APIへ返信を送信する処理
  return { success: true };
}

async function handlePubSubNotification(env, message) {
  // Pub/Subメッセージ受信時の処理
}

async function pollNewReviews(env) {
  // 定期巡回処理
}
