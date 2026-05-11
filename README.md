# ⚡ WinningHunter — Full Stack Setup Guide

## What's Included

| File | Purpose |
|------|---------|
| `server.js` | Full Express API — auth, products, ad spy, stores, billing |
| `schema.sql` | PostgreSQL database schema |
| `scrapers/facebook.js` | Facebook Ad Library API scraper |
| `scrapers/shopify.js` | Shopify public store scraper + bestseller detector |
| `scrapers/aliexpress.js` | AliExpress product data + winning score algorithm |
| `frontend/App.jsx` | Full React app — dashboard, products, billing, auth |
| `.env.example` | All environment variables needed |

---

## Quick Start (Backend)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up PostgreSQL
```bash
# Create database
createdb winninghunter

# Run schema
npm run db:setup
```

### 3. Set up Redis
```bash
# Mac
brew install redis && brew services start redis

# Ubuntu
sudo apt install redis-server && sudo systemctl start redis
```

### 4. Configure environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 5. Run the server
```bash
npm run dev   # development (auto-restart)
npm start     # production
```

---

## Quick Start (Frontend)

```bash
cd frontend
npm create vite@latest . -- --template react
npm install recharts react-router-dom axios
# Copy App.jsx into src/App.jsx
cp .env.example .env  # set VITE_API_URL
npm run dev
```

---

## Getting API Keys

### Facebook Ad Library (FREE — most important)
1. Go to https://developers.facebook.com
2. Create a new app → choose "Business" type
3. Add "Marketing API" product
4. Generate a long-lived user access token
5. Token lasts 60 days — refresh with: `GET /oauth/access_token`

### AliExpress Affiliate API
1. Go to https://portals.aliexpress.com
2. Sign up as an affiliate
3. Go to Tools → API → apply for API access (approved in 1-3 days)

### Stripe
1. Sign up at https://stripe.com
2. Dashboard → Developers → API Keys → copy secret key
3. Create products/prices for your plans:
   - Pro: $49/month recurring
   - Agency: $149/month recurring
4. Set up webhook endpoint: `POST /api/webhook`
   - Events to listen: `customer.subscription.deleted`, `invoice.payment_succeeded`

---

## Deployment

### Recommended Stack
- **Backend**: Railway.app or Render.com (free tiers available)
- **Database**: Supabase (free PostgreSQL) or Railway PostgreSQL
- **Redis**: Upstash (free Redis)
- **Frontend**: Vercel (free)

### Environment on Railway
```
DATABASE_URL=        (auto-set by Railway PostgreSQL plugin)
REDIS_URL=           (get from Upstash)
JWT_SECRET=          (random 64-char string)
STRIPE_SECRET_KEY=   (from Stripe dashboard)
FACEBOOK_ACCESS_TOKEN= (from Facebook developers)
```

---

## Winning Score Algorithm

Products are scored 0-100 based on:

| Signal | Weight | Notes |
|--------|--------|-------|
| Ad spend/day | 25 pts | $10k+/day = max score |
| Ad longevity | 15 pts | 30+ days running = validated |
| Social engagement | 20 pts | 100k+ likes/shares |
| AliExpress sales | 15 pts | 10k+ monthly sales |
| Profit margin | 10 pts | 60%+ margin = max |
| Google Trends | 10 pts | Rising trend = bonus |
| Competition level | 5 pts | Fewer competitors = better |

---

## Monetization

| Plan | Price | Limit |
|------|-------|-------|
| Starter | Free | 50 searches/day |
| Pro | $49/month | 500 searches/day + ad spy |
| Agency | $149/month | Unlimited + API access |

### Revenue targets
- 100 Pro users = $4,900/month
- 50 Agency users = $7,450/month
- Mix of both = $10,000+/month realistic at 6 months

---

## Scaling Tips

1. **Cache aggressively** — Redis caches search results for 5 minutes, saves DB load
2. **Run scrapers off-peak** — Cron jobs set to 3am to avoid rate limits
3. **Use a job queue** (Bull/BullMQ) for heavy scraping tasks
4. **CDN for images** — Store product thumbnails in S3 + CloudFront
5. **Read replicas** — Add PostgreSQL read replica when you hit 1000+ users
