-- Seed Data for ReviewPilot (らくコミくん)
-- テスト・初期デモ用シードデータ

-- 1. デモユーザー (渋谷店オーナー & マルチテナント分離検証用新宿店オーナー)
-- 初期パスワード: password123 (PBKDF2 SHA-256 / 100,000 iterations)
INSERT OR REPLACE INTO users (
    id, email, password_hash, password_salt, name, plan,
    stripe_customer_id, stripe_subscription_id, 
    subscription_status, trial_ends_at, notification_email, line_user_id
) VALUES 
(
    'usr_demo_shibuya', 
    'owner@trattoria-shibuya.com', 
    'd3de1d8eb1756105a9cbfd0ebeac9b790a7b817f1e684d01cb330ac9b36eabc5',
    'a1b2c3d4e5f6789012345678abcdef01',
    'TRATTORIA SHIBUYA オーナー', 
    'pro',
    'cus_demo184920481920', 
    'sub_demo184920481920', 
    'trialing', 
    datetime('now', '+14 days'), 
    'owner@trattoria-shibuya.com', 
    'U184920481920demo'
),
(
    'usr_demo_shinjuku', 
    'owner@bistro-shinjuku.com', 
    'd3de1d8eb1756105a9cbfd0ebeac9b790a7b817f1e684d01cb330ac9b36eabc5',
    'a1b2c3d4e5f6789012345678abcdef01',
    'BISTRO SHINJUKU オーナー', 
    'standard',
    'cus_demo999999999999', 
    'sub_demo999999999999', 
    'active', 
    NULL, 
    'owner@bistro-shinjuku.com', 
    'U999999999999demo'
);

-- 2. セッションデータ (認証テスト用)
INSERT OR REPLACE INTO sessions (
    id, user_id, expires_at
) VALUES 
(
    'sess_demo_shibuya_token',
    'usr_demo_shibuya',
    datetime('now', '+30 days')
),
(
    'sess_demo_shinjuku_token',
    'usr_demo_shinjuku',
    datetime('now', '+30 days')
);

-- 3. 店舗データ (locations)
INSERT OR REPLACE INTO locations (
    id, user_id, account_id, location_name, category, address,
    auto_reply, ai_tone,
    google_access_token, google_refresh_token, token_expires_at, pubsub_subscribed
) VALUES 
(
    'locations/184920481920',
    'usr_demo_shibuya',
    'accounts/1098273645',
    'TRATTORIA SHIBUYA (渋谷店)',
    'イタリアンレストラン',
    '東京都渋谷区宇田川町12-3',
    0,
    'polite',
    'ya29.demo_token_shibuya',
    '1//demo_refresh_shibuya',
    datetime('now', '+30 days'),
    1
),
(
    'locations/999999999999',
    'usr_demo_shinjuku',
    'accounts/2098273646',
    'BISTRO SHINJUKU (新宿店)',
    'フランス料理店',
    '東京都新宿区新宿3-1-1',
    1,
    'friendly',
    'ya29.demo_token_shinjuku',
    '1//demo_refresh_shinjuku',
    datetime('now', '+30 days'),
    1
);

-- 4. 口コミデータ (reviews)
INSERT OR REPLACE INTO reviews (
    id, location_id, reviewer_name, star_rating, comment,
    review_created_at, reply_status,
    generated_reply_a, generated_reply_b, generated_reply_c,
    final_reply_text, replied_at
) VALUES 
(
    'reviews/101',
    'locations/184920481920',
    '田中 太郎 様',
    5,
    'ランチで訪問しました。カルボナーラがとても美味しかったです！店員さんの接客も心地よく、また利用したいと思います。',
    datetime('now', '-2 days'),
    'replied_a',
    'この度はご来店いただき誠にありがとうございました。カルボナーラをお気に召していただけて大変光栄です！次回はぜひディナーの限定メニューもお試しくださいませ。',
    '嬉しいお言葉ありがとうございます！気に入っていただけてスタッフ一同とても喜んでおります😊 次回もぜひお待ちしております！',
    'ご来店いただき誠にありがとうございました。当店こだわりのカルボナーラをご体感いただけて光栄です。次回もより良い時間をご提供できるよう努めてまいります。',
    'この度はご来店いただき誠にありがとうございました。カルボナーラをお気に召していただけて大変光栄です！次回はぜひディナーの限定メニューもお試しくださいませ。',
    datetime('now', '-2 days', '+10 minutes')
),
(
    'reviews/102',
    'locations/184920481920',
    'David Miller 様',
    5,
    'The truffle pasta was amazing! Best Italian food we had during our stay in Tokyo. Great staff and cozy ambiance.',
    datetime('now', '-3 days'),
    'replied_a',
    'Thank you so much for your wonderful review! We are delighted that you enjoyed our truffle pasta. Have a fantastic stay in Japan, and we hope to see you again!',
    'Thank you so much! 😊 We are super happy you loved the pasta and cozy vibe. Have a wonderful stay in Japan and see you next time!',
    'Thank you for dining with us. We take great pride in our authentic cuisine and attentive hospitality. We hope to serve you again on your next visit.',
    'Thank you so much for your wonderful review! We are delighted that you enjoyed our truffle pasta. Have a fantastic stay in Japan, and we hope to see you again!',
    datetime('now', '-3 days', '+15 minutes')
),
(
    'reviews/103',
    'locations/184920481920',
    '佐藤 花子 様',
    4,
    'ピザの生地がモチモチで最高でした！ただ少し混んでいて席に案内されるまで10分ほど待ちました。',
    datetime('now', '-4 days'),
    'replied_b',
    'この度は当店をご利用いただき誠にありがとうございます。ピザをお褒めいただき光栄です。混雑時にお待たせしてしまい申し訳ありませんでした。またのお越しをお待ちしております。',
    '嬉しいお言葉ありがとうございます！ピザを褒めていただきピカイチの笑顔になりました🍕 お待たせしてしまい申し訳ありませんでした。次回はスムーズにご案内できるよう準備してお待ちしております！',
    'ご来店誠にありがとうございました。ご案内にお時間を要しお詫び申し上げます。オペレーションを改善し、次回はより快適におもてなしいたします。',
    '嬉しいお言葉ありがとうございます！ピザを褒めていただきピカイチの笑顔になりました🍕 お待たせしてしまい申し訳ありませんでした。次回はスムーズにご案内できるよう準備してお待ちしております！',
    datetime('now', '-4 days', '+30 minutes')
),
(
    'reviews/104',
    'locations/184920481920',
    '鈴木 一郎 様',
    2,
    '料理はおいしかったのですが、隣の席との間隔が狭くて少し落ち着かなかったです。',
    datetime('now', '-1 hours'),
    'pending',
    'この度はご来店いただきありがとうございました。お席の間隔に関しまして、落ち着いてお食事いただけず申し訳ございませんでした。今後のレイアウト改善の参考にさせていただきます。',
    'ご来店誠にありがとうございました！せっかくお越しいただいたのに、ゆったりとお過ごしいただけず大変申し訳ありませんでした。より居心地の良いお店作りに努めます。',
    'この度は当店をご利用いただいたにもかかわらず、ご不快な思いをさせてしまい誠に申し訳ございませんでした。いただいたご指摘を真摯に受け止め、座席配置の見直し等、改善に努めてまいります。',
    NULL,
    NULL
),
(
    'reviews/201',
    'locations/999999999999',
    '山田 次郎 様',
    5,
    '新宿店のランチコースをいただきました。お肉の焼き加減が素晴らしく、ワインも最高でした！',
    datetime('now', '-1 days'),
    'replied_a',
    'ご来店誠にありがとうございました。ローストビーフとお料理に合わせたワインをお楽しみいただけて幸いです。またのご来店を心よりお待ちしております。',
    '素敵なレビューありがとうございます！ワインとお肉のペアリング、喜んでいただけて何よりです🍷 またぜひ遊びにいらしてください！',
    '当店のご利用誠にありがとうございます。厳選した食材とワインをお褒めいただき大変光栄です。今後もご満足いただける料理を追求してまいります。',
    'ご来店誠にありがとうございました。ローストビーフとお料理に合わせたワインをお楽しみいただけて幸いです。またのご来店を心よりお待ちしております。',
    datetime('now', '-1 days', '+20 minutes')
);

-- 5. マジックリンクトークン (未返信の reviews/104 向け)
INSERT OR REPLACE INTO reply_tokens (
    token, review_id, location_id, action_type, expires_at, is_used
) VALUES 
(
    'token_demo_104_manual',
    'reviews/104',
    'locations/184920481920',
    'manual_edit',
    datetime('now', '+7 days'),
    0
),
(
    'token_demo_104_reply_a',
    'reviews/104',
    'locations/184920481920',
    'reply_a',
    datetime('now', '+7 days'),
    0
);
