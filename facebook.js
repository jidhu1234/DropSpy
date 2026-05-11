// scrapers/facebook.js
// Uses Facebook's official Ad Library API (free + legal)
// Docs: https://www.facebook.com/ads/library/api/

const axios = require('axios');

const FB_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const BASE_URL = 'https://graph.facebook.com/v19.0/ads_archive';

/**
 * Scrape Facebook Ad Library for active ads
 * @param {object} opts - Options
 * @param {string} opts.keyword - Search keyword (optional)
 * @param {number} opts.limit - Number of ads to fetch (max 500/call)
 * @param {string[]} opts.countries - Country codes e.g. ['US','GB']
 * @returns {Promise<Array>} Array of ad objects
 */
async function scrapeAdLibrary({ keyword = '', limit = 100, countries = ['US'] } = {}) {
  const params = {
    access_token: FB_TOKEN,
    ad_type: 'ALL',
    ad_reached_countries: countries.join(','),
    search_terms: keyword,
    limit,
    fields: [
      'id',
      'ad_creative_bodies',
      'ad_creative_link_titles',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'impressions',
      'spend',
      'page_name',
      'page_id',
      'bylines',
      'publisher_platforms',
      'languages',
      'eu_total_reach',
    ].join(','),
  };

  try {
    const res = await axios.get(BASE_URL, { params });
    const ads = res.data.data || [];

    return ads.map(ad => {
      const startDate = new Date(ad.ad_delivery_start_time);
      const daysRunning = Math.floor((Date.now() - startDate) / 86400000);
      const body = ad.ad_creative_bodies?.[0] || '';
      const title = ad.ad_creative_link_titles?.[0] || ad.page_name || '';
      const spendRange = ad.spend || {};
      const spendEstimate = spendRange.upper_bound
        ? (Number(spendRange.lower_bound) + Number(spendRange.upper_bound)) / 2
        : 0;

      return {
        platform: 'facebook',
        title,
        body,
        page_name: ad.page_name,
        likes: ad.eu_total_reach || 0,
        shares: 0,
        countries: countries.join(','),
        spend_estimate: spendEstimate,
        days_running: daysRunning,
        thumbnail_url: null,
        raw: ad,
      };
    });
  } catch (err) {
    console.error('Facebook Ad Library error:', err.response?.data || err.message);
    return [];
  }
}

/**
 * Get ads for a specific Facebook page (competitor spy)
 */
async function getPageAds(pageId, limit = 50) {
  const params = {
    access_token: FB_TOKEN,
    ad_type: 'ALL',
    search_page_ids: pageId,
    limit,
    fields: 'id,ad_creative_bodies,spend,impressions,ad_delivery_start_time',
  };
  const res = await axios.get(BASE_URL, { params });
  return res.data.data || [];
}

module.exports = { scrapeAdLibrary, getPageAds };
