-- WinningHunter — PostgreSQL Schema
-- Run this once to set up the database

-- Users & Auth
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  name                  VARCHAR(255),
  plan                  VARCHAR(20) DEFAULT 'starter',  -- starter | pro | agency
  searches_today        INT DEFAULT 0,
  stripe_customer_id    VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Products (winning products database)
CREATE TABLE products (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  niche             VARCHAR(100),
  source            VARCHAR(50),               -- facebook | tiktok | amazon | aliexpress
  score             INT DEFAULT 0,             -- 0–100 winning score
  price_usd         NUMERIC(10,2),
  cost_usd          NUMERIC(10,2),             -- supplier cost
  margin_pct        NUMERIC(5,2),
  engagement_7d     BIGINT DEFAULT 0,
  spend_estimate    NUMERIC(12,2),             -- estimated daily ad spend
  image_url         TEXT,
  aliexpress_url    TEXT,
  amazon_url        TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Product daily history for charts
CREATE TABLE product_history (
  id            SERIAL PRIMARY KEY,
  product_id    INT REFERENCES products(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  engagement    BIGINT,
  spend         NUMERIC(12,2),
  score         INT,
  UNIQUE(product_id, date)
);

-- Tags
CREATE TABLE product_tags (
  id          SERIAL PRIMARY KEY,
  product_id  INT REFERENCES products(id) ON DELETE CASCADE,
  tag         VARCHAR(100)
);

-- Ads (ad spy database)
CREATE TABLE ads (
  id              SERIAL PRIMARY KEY,
  platform        VARCHAR(50),                -- facebook | tiktok | instagram | youtube
  title           VARCHAR(500),
  body            TEXT,
  thumbnail_url   TEXT,
  video_url       TEXT,
  likes           BIGINT DEFAULT 0,
  shares          BIGINT DEFAULT 0,
  comments        BIGINT DEFAULT 0,
  views           BIGINT DEFAULT 0,
  ctr             NUMERIC(5,2),
  countries       TEXT,                       -- comma-separated: 'US,GB,AU'
  spend_estimate  NUMERIC(12,2),
  days_running    INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  product_id      INT REFERENCES products(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, title)
);

-- Stores (competitor Shopify tracker)
CREATE TABLE stores (
  id                SERIAL PRIMARY KEY,
  url               VARCHAR(500) UNIQUE,
  name              VARCHAR(255),
  products_count    INT DEFAULT 0,
  revenue_estimate  NUMERIC(15,2),
  monthly_traffic   BIGINT,
  niche             VARCHAR(100),
  last_scraped      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Products found in tracked stores
CREATE TABLE store_products (
  id          SERIAL PRIMARY KEY,
  store_id    INT REFERENCES stores(id) ON DELETE CASCADE,
  product_id  INT REFERENCES products(id),
  price       NUMERIC(10,2),
  inventory   INT,
  first_seen  TIMESTAMPTZ DEFAULT NOW(),
  last_seen   TIMESTAMPTZ DEFAULT NOW()
);

-- User saved products & alerts
CREATE TABLE user_actions (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  product_id  INT REFERENCES products(id) ON DELETE CASCADE,
  action      VARCHAR(50),                    -- save | alert | hide
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, action)
);

-- User alerts (price drops, new ads, trending alerts)
CREATE TABLE alerts (
  id            SERIAL PRIMARY KEY,
  user_id       INT REFERENCES users(id) ON DELETE CASCADE,
  product_id    INT REFERENCES products(id),
  alert_type    VARCHAR(50),                  -- new_ad | trending | price_drop
  message       TEXT,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_score ON products(score DESC);
CREATE INDEX idx_products_niche ON products(niche);
CREATE INDEX idx_products_source ON products(source);
CREATE INDEX idx_ads_platform ON ads(platform);
CREATE INDEX idx_ads_spend ON ads(spend_estimate DESC);
CREATE INDEX idx_user_actions_user ON user_actions(user_id);
CREATE INDEX idx_product_history_product ON product_history(product_id, date DESC);
