// WinningHunter — Backend API
// Stack: Node.js, Express, PostgreSQL (via pg), Redis (cache), Stripe

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { scrapeAdLibrary } = require('./scrapers/facebook');
const { scrapeShopify } = require('./scrapers/shopify');
const { getAliExpressProduct } = require('./scrapers/aliexpress');

const app = express();
app.use(cors({
  origin: ['https://drop-spy-six.vercel.app', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ─── DB & Cache ────────────────────────────────────────────────────────────────
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const cache = redis.createClient({ url: process.env.REDIS_URL });
cache.connect();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Plan limits: starter=50, pro=500, agency=unlimited
async function checkLimit(req, res, next) {
  const { rows } = await db.query('SELECT plan, searches_today FROM users WHERE id=$1', [req.user.id]);
  const user = rows[0];
  const limits = { starter: 50, pro: 500, agency: Infinity };
  if (user.searches_today >= limits[user.plan]) {
    return res.status(429).json({ error: 'Daily search limit reached. Upgrade your plan.' });
  }
  await db.query('UPDATE users SET searches_today=searches_today+1 WHERE id=$1', [req.user.id]);
  next();
}

// ─── Auth Routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await db.query(
      'INSERT INTO users(email, password_hash, name, plan) VALUES($1,$2,$3,$4) RETURNING id,email,name,plan',
      [email, hash, name, 'starter']
    );
    const token = jwt.sign({ id: rows[0].id, plan: rows[0].plan }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: rows[0] });
  } catch (e) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: rows[0].id, plan: rows[0].plan }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name, plan: rows[0].plan } });
});

// ─── Products Routes ───────────────────────────────────────────────────────────
// GET /api/products — list winning products with filters
app.get('/api/products', authMiddleware, checkLimit, async (req, res) => {
  const { niche, source, min_score, sort = 'score', page = 1, limit = 20 } = req.query;
  const cacheKey = `products:${JSON.stringify(req.query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  let query = `SELECT p.*, 
    array_agg(DISTINCT t.tag) as tags,
    COUNT(DISTINCT ua.id) as saves
    FROM products p
    LEFT JOIN product_tags t ON t.product_id = p.id
    LEFT JOIN user_actions ua ON ua.product_id = p.id AND ua.action='save'
    WHERE p.is_active = true`;
  const params = [];

  if (niche) { params.push(niche); query += ` AND p.niche = $${params.length}`; }
  if (source) { params.push(source); query += ` AND p.source = $${params.length}`; }
  if (min_score) { params.push(min_score); query += ` AND p.score >= $${params.length}`; }

  query += ` GROUP BY p.id ORDER BY p.${sort} DESC`;
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  await cache.setEx(cacheKey, 300, JSON.stringify(rows)); // cache 5 min
  res.json(rows);
});

// GET /api/products/:id — product detail with full metrics
app.get('/api/products/:id', authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, 
      json_agg(json_build_object('date', ph.date, 'value', ph.engagement)) as engagement_history,
      json_agg(DISTINCT json_build_object('id', a.id, 'platform', a.platform, 'likes', a.likes, 'shares', a.shares, 'spend_estimate', a.spend_estimate)) as ads
    FROM products p
    LEFT JOIN product_history ph ON ph.product_id = p.id
    LEFT JOIN ads a ON a.product_id = p.id
    WHERE p.id = $1
    GROUP BY p.id`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// POST /api/products/:id/save — save/unsave a product
app.post('/api/products/:id/save', authMiddleware, async (req, res) => {
  const existing = await db.query(
    'SELECT id FROM user_actions WHERE user_id=$1 AND product_id=$2 AND action=$3',
    [req.user.id, req.params.id, 'save']
  );
  if (existing.rows.length) {
    await db.query('DELETE FROM user_actions WHERE id=$1', [existing.rows[0].id]);
    return res.json({ saved: false });
  }
  await db.query('INSERT INTO user_actions(user_id,product_id,action) VALUES($1,$2,$3)', [req.user.id, req.params.id, 'save']);
  res.json({ saved: true });
});

// ─── Ad Spy Routes ─────────────────────────────────────────────────────────────
app.get('/api/ads', authMiddleware, checkLimit, async (req, res) => {
  const { platform, country, days_running, keyword, page = 1 } = req.query;
  let query = 'SELECT * FROM ads WHERE 1=1';
  const params = [];

  if (platform) { params.push(platform); query += ` AND platform=$${params.length}`; }
  if (country) { params.push(`%${country}%`); query += ` AND countries ILIKE $${params.length}`; }
  if (days_running) { params.push(days_running); query += ` AND days_running >= $${params.length}`; }
  if (keyword) { params.push(`%${keyword}%`); query += ` AND (title ILIKE $${params.length} OR body ILIKE $${params.length})`; }

  query += ' ORDER BY spend_estimate DESC LIMIT 20 OFFSET $' + (params.length + 1);
  params.push((Number(page) - 1) * 20);

  const { rows } = await db.query(query, params);
  res.json(rows);
});

// ─── Store Tracker Routes ──────────────────────────────────────────────────────
app.get('/api/stores', authMiddleware, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM stores ORDER BY revenue_estimate DESC LIMIT 50');
  res.json(rows);
});

app.post('/api/stores/track', authMiddleware, async (req, res) => {
  const { url } = req.body;
  const products = await scrapeShopify(url);
  const { rows } = await db.query(
    'INSERT INTO stores(url, products_count, last_scraped) VALUES($1,$2,NOW()) ON CONFLICT(url) DO UPDATE SET last_scraped=NOW() RETURNING *',
    [url, products.length]
  );
  res.json({ store: rows[0], products });
});

// ─── Trends Route ──────────────────────────────────────────────────────────────
app.get('/api/trends', authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    `SELECT niche, 
      AVG(score) as avg_score, 
      COUNT(*) as product_count,
      SUM(engagement_7d) as total_engagement
    FROM products WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY niche ORDER BY total_engagement DESC LIMIT 10`
  );
  res.json(rows);
});

// ─── Dashboard Stats ───────────────────────────────────────────────────────────
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const [trending, ads, stores, saved] = await Promise.all([
    db.query('SELECT COUNT(*) FROM products WHERE score > 70'),
    db.query('SELECT COUNT(*) FROM ads WHERE is_active=true'),
    db.query('SELECT COUNT(*) FROM stores'),
    db.query('SELECT COUNT(*) FROM user_actions WHERE user_id=$1 AND action=$2', [req.user.id, 'save']),
  ]);
  res.json({
    trending_products: trending.rows[0].count,
    active_ads: ads.rows[0].count,
    stores_monitored: stores.rows[0].count,
    saved_products: saved.rows[0].count,
  });
});

// ─── Stripe Billing ────────────────────────────────────────────────────────────
const PLANS = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
};

app.post('/api/billing/subscribe', authMiddleware, async (req, res) => {
  const { plan, payment_method_id } = req.body;
  const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const user = rows[0];

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.name });
    customerId = customer.id;
    await db.query('UPDATE users SET stripe_customer_id=$1 WHERE id=$2', [customerId, user.id]);
  }

  await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: payment_method_id } });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: PLANS[plan] }],
    expand: ['latest_invoice.payment_intent'],
  });

  await db.query('UPDATE users SET plan=$1, stripe_subscription_id=$2 WHERE id=$3', [plan, subscription.id, user.id]);
  res.json({ subscription });
});

app.post('/api/billing/portal', authMiddleware, async (req, res) => {
  const { rows } = await db.query('SELECT stripe_customer_id FROM users WHERE id=$1', [req.user.id]);
  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: process.env.FRONTEND_URL + '/dashboard',
  });
  res.json({ url: session.url });
});

// Stripe webhook to handle subscription updates
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).send('Webhook Error'); }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await db.query('UPDATE users SET plan=$1 WHERE stripe_subscription_id=$2', ['starter', sub.id]);
  }
  if (event.type === 'invoice.payment_succeeded') {
    // Reset monthly search counters, send receipt email, etc.
  }
  res.json({ received: true });
});

// ─── Cron Jobs: auto-scrape every hour ────────────────────────────────────────
cron.schedule('0 * * * *', async () => {
  console.log('Running hourly scrape...');
  const ads = await scrapeAdLibrary({ limit: 100, countries: ['US', 'GB', 'AU'] });
  for (const ad of ads) {
    await db.query(
      `INSERT INTO ads(platform,title,body,likes,shares,countries,spend_estimate,thumbnail_url,days_running)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(platform, title) DO UPDATE SET likes=$4, shares=$5, spend_estimate=$7`,
      [ad.platform, ad.title, ad.body, ad.likes, ad.shares, ad.countries, ad.spend_estimate, ad.thumbnail_url, ad.days_running]
    );
  }
});

// Reset daily search counts at midnight
cron.schedule('0 0 * * *', async () => {
  await db.query('UPDATE users SET searches_today=0');
});

app.listen(3001, () => console.log('WinningHunter API running on port 3001'));
