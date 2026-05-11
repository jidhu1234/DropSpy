// scrapers/shopify.js
// Shopify /products.json is publicly accessible on all Shopify stores
// This is legal — it's a public endpoint Shopify exposes by default

const axios = require('axios');

/**
 * Scrape all products from a public Shopify store
 * @param {string} storeUrl - e.g. "https://gymshark.com"
 * @returns {Promise<Array>} Array of product objects
 */
async function scrapeShopify(storeUrl) {
  const base = storeUrl.replace(/\/$/, '');
  const products = [];
  let page = 1;

  while (true) {
    try {
      const res = await axios.get(`${base}/products.json`, {
        params: { limit: 250, page },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProductResearchBot/1.0)',
        },
      });

      const batch = res.data.products || [];
      if (!batch.length) break;
      products.push(...batch);
      if (batch.length < 250) break;
      page++;
      await sleep(500); // be polite
    } catch (err) {
      console.error(`Shopify scrape error for ${storeUrl}:`, err.message);
      break;
    }
  }

  return products.map(p => ({
    title: p.title,
    vendor: p.vendor,
    product_type: p.product_type,
    tags: p.tags,
    variants: p.variants.map(v => ({
      price: parseFloat(v.price),
      inventory: v.inventory_quantity,
      sku: v.sku,
    })),
    images: p.images.map(i => i.src),
    published_at: p.published_at,
    handle: p.handle,
    url: `${base}/products/${p.handle}`,
  }));
}

/**
 * Detect bestsellers by tracking inventory changes over time
 * Compare current inventory vs saved snapshot — items that sold out fastest = bestsellers
 */
async function detectBestsellers(storeUrl, previousSnapshot) {
  const current = await scrapeShopify(storeUrl);
  if (!previousSnapshot) return { products: current, bestsellers: [] };

  const snapshotMap = {};
  previousSnapshot.forEach(p => {
    p.variants.forEach(v => { snapshotMap[v.sku] = v.inventory; });
  });

  const bestsellers = [];
  current.forEach(p => {
    p.variants.forEach(v => {
      const prev = snapshotMap[v.sku];
      if (prev !== undefined && prev > v.inventory) {
        bestsellers.push({
          product: p.title,
          sku: v.sku,
          sold: prev - v.inventory,
          current_inventory: v.inventory,
          price: v.price,
        });
      }
    });
  });

  bestsellers.sort((a, b) => b.sold - a.sold);
  return { products: current, bestsellers };
}

/**
 * Get estimated store revenue (price × units sold estimate)
 */
async function estimateStoreRevenue(storeUrl) {
  const products = await scrapeShopify(storeUrl);
  // Rough estimate: assume 30 sales/day per product with > 0 inventory
  const activeProducts = products.filter(p => p.variants.some(v => v.inventory > 0));
  const avgPrice = activeProducts.reduce((sum, p) => {
    const prices = p.variants.map(v => v.price);
    return sum + (prices.reduce((a, b) => a + b, 0) / prices.length);
  }, 0) / (activeProducts.length || 1);

  return {
    product_count: products.length,
    active_products: activeProducts.length,
    avg_price: avgPrice.toFixed(2),
    estimated_monthly_revenue: (activeProducts.length * 30 * avgPrice).toFixed(0),
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrapeShopify, detectBestsellers, estimateStoreRevenue };
