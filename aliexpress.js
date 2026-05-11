// scrapers/aliexpress.js + scoring/score.js combined
// AliExpress product research via their affiliate API

const axios = require('axios');
const crypto = require('crypto');

// ─── AliExpress Affiliate API ─────────────────────────────────────────────────
// Sign up: https://portals.aliexpress.com → Affiliate Program → API
const AE_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const AE_SECRET = process.env.ALIEXPRESS_SECRET;

function signRequest(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('md5', AE_SECRET).update(AE_SECRET + sorted + AE_SECRET).digest('hex').toUpperCase();
}

async function searchAliExpressProducts({ keyword, min_sale_price, max_sale_price, sort = 'SALE_PRICE_ASC', page = 1 }) {
  const params = {
    app_key: AE_APP_KEY,
    method: 'aliexpress.affiliate.product.query',
    sign_method: 'md5',
    timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
    v: '2.0',
    keywords: keyword,
    min_sale_price,
    max_sale_price,
    sort,
    page_no: page,
    page_size: 50,
    fields: 'product_id,product_title,target_sale_price,original_price,sale_price,commission_rate,sales_amount,product_main_image_url,product_detail_url,first_level_category_name',
  };
  params.sign = signRequest(params);

  const res = await axios.post('https://gw.api.taobao.com/router/rest', null, { params });
  const products = res.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];

  return products.map(p => ({
    id: p.product_id,
    title: p.product_title,
    price: parseFloat(p.target_sale_price),
    original_price: parseFloat(p.original_price),
    sales: parseInt(p.sales_amount) || 0,
    commission_rate: parseFloat(p.commission_rate),
    image_url: p.product_main_image_url,
    url: p.product_detail_url,
    category: p.first_level_category_name,
  }));
}

// ─── Winning Score Algorithm ──────────────────────────────────────────────────
/**
 * Calculate a 0–100 "winning score" for a product
 * based on multiple signals
 */
function calculateWinningScore({
  ad_spend_daily = 0,        // USD/day
  ad_days_running = 0,       // days the ad has been running
  ad_engagement = 0,         // total likes + shares + comments
  social_shares = 0,
  aliexpress_sales = 0,      // monthly sales count
  profit_margin = 0,         // percentage 0-100
  google_trends_score = 0,   // 0-100 from Google Trends
  num_competitors = 0,       // how many stores selling same product
  review_count = 0,
  review_rating = 0,         // 0-5
}) {
  let score = 0;

  // Ad spend signal (if someone is spending big, it's working) — max 25 pts
  if (ad_spend_daily > 10000) score += 25;
  else if (ad_spend_daily > 5000) score += 20;
  else if (ad_spend_daily > 1000) score += 15;
  else if (ad_spend_daily > 500) score += 10;
  else score += Math.min(ad_spend_daily / 100, 5);

  // Ad longevity (running for 7+ days = validated) — max 15 pts
  if (ad_days_running >= 30) score += 15;
  else if (ad_days_running >= 14) score += 12;
  else if (ad_days_running >= 7) score += 8;
  else score += Math.min(ad_days_running * 1.5, 5);

  // Social engagement — max 20 pts
  const totalEngagement = ad_engagement + social_shares;
  if (totalEngagement > 100000) score += 20;
  else if (totalEngagement > 50000) score += 15;
  else if (totalEngagement > 10000) score += 10;
  else score += Math.min(totalEngagement / 1000, 5);

  // AliExpress demand — max 15 pts
  if (aliexpress_sales > 10000) score += 15;
  else if (aliexpress_sales > 5000) score += 12;
  else if (aliexpress_sales > 1000) score += 8;
  else score += Math.min(aliexpress_sales / 200, 5);

  // Profit margin — max 10 pts
  if (profit_margin > 60) score += 10;
  else if (profit_margin > 40) score += 7;
  else if (profit_margin > 30) score += 5;
  else score += Math.max(0, profit_margin / 10);

  // Google Trends momentum — max 10 pts
  score += Math.min(google_trends_score / 10, 10);

  // Competition penalty — fewer competitors = better — max 5 pts
  if (num_competitors < 5) score += 5;
  else if (num_competitors < 15) score += 3;
  else if (num_competitors > 50) score -= 5;

  // Review signal — max 5 pts
  if (review_count > 1000 && review_rating > 4.5) score += 5;
  else if (review_count > 100 && review_rating > 4.0) score += 3;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate profit margin
 */
function calcMargin(sellingPrice, supplierCost, shippingCost = 0, adCostPerOrder = 0) {
  const totalCost = supplierCost + shippingCost + adCostPerOrder;
  const profit = sellingPrice - totalCost;
  return {
    profit,
    margin_pct: ((profit / sellingPrice) * 100).toFixed(1),
    roi: ((profit / totalCost) * 100).toFixed(1),
  };
}

module.exports = { searchAliExpressProducts, calculateWinningScore, calcMargin };
