-- Cloudflare D1 Database Schema for ReviewPilot

-- 1. Users Table (店舗オーナー・アカウント情報)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'trialing', -- trialing, active, past_due, canceled
    trial_ends_at TIMESTAMP,
    notification_email TEXT,
    line_user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Locations Table (Googleビジネスプロフィールの店舗情報 & 認証トークン)
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY, -- Google location resource name (e.g. locations/123456789)
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL, -- Google account ID
    location_name TEXT NOT NULL, -- 店舗表示名 (e.g. TRATTORIA SHIBUYA)
    category TEXT, -- 業種 (e.g. イタリアンレストラン, 美容室)
    address TEXT,
    google_access_token TEXT,
    google_refresh_token TEXT,
    token_expires_at TIMESTAMP,
    pubsub_subscribed BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Reviews Table (同期・受信した口コミ)
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY, -- Google review resource name / ID
    location_id TEXT NOT NULL,
    reviewer_name TEXT,
    star_rating INTEGER NOT NULL, -- 1 to 5
    comment TEXT,
    review_created_at TIMESTAMP,
    reply_status TEXT DEFAULT 'pending', -- pending, replied_a, replied_b, replied_c, replied_manual
    generated_reply_a TEXT,
    generated_reply_b TEXT,
    generated_reply_c TEXT,
    final_reply_text TEXT,
    replied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- 4. Magic Link Tokens Table (メール内1タップ返信および手動編集用の一時トークン)
CREATE TABLE IF NOT EXISTS reply_tokens (
    token TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'reply_a', 'reply_b', 'reply_c', 'manual_edit'
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

-- 5. Sessions Table (ダッシュボード認証・セッション管理)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

