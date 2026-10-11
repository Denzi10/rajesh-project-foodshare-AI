const { getDatabase } = require('../database/connection');

/**
 * SurplusPredictor Interface & Baseline Implementation
 * As specified in FR-11:
 * "A SurplusPredictor interface returns a forecast of expected surplus for a donor;
 *  the first version is a documented baseline and is labelled as an estimate, never as live data"
 */
class SurplusPredictorService {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  /**
   * Predicts expected surplus for a given donor based on moving averages of past listings.
   * @param {number} donorId
   * @returns {Promise<Object>} Forecast estimate object
   */
  async predictSurplus(donorId) {
    // 1. Fetch donor's historical listings
    const rows = await this.db.all(
      `SELECT category, quantity, unit, created_at, status
       FROM food_listings
       WHERE donor_id = ?
       ORDER BY id DESC
       LIMIT 20`,
      [donorId]
    );

    if (!rows || rows.length === 0) {
      return {
        donorId,
        hasHistoricalData: false,
        isEstimate: true,
        modelType: 'Statistical Baseline Model (Cold Start / Industry Standard)',
        disclaimer: 'This prediction is an estimated baseline projection, not live inventory data.',
        predictedNextSurplus: {
          recommendedCategory: 'Cooked Meals',
          estimatedQuantity: 15.0,
          unit: 'kg',
          suggestedPickupWindow: '17:00 - 19:00',
          estimatedPeopleFed: 30,
          confidenceScore: 0.65
        },
        categoryBreakdown: [
          { category: 'Cooked Meals', expectedFrequency: '45%' },
          { category: 'Bakery & Bread', expectedFrequency: '30%' },
          { category: 'Fresh Produce', expectedFrequency: '25%' }
        ]
      };
    }

    // 2. Compute moving average of recent listings
    const totalQty = rows.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);
    const movingAverageQuantity = Math.round((totalQty / rows.length) * 10) / 10;

    // Category frequency analysis
    const categoryCounts = {};
    const unitsByCategory = {};

    rows.forEach(r => {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      unitsByCategory[r.category] = r.unit;
    });

    let topCategory = 'Cooked Meals';
    let maxCount = 0;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topCategory = cat;
      }
    }

    const preferredUnit = unitsByCategory[topCategory] || 'kg';
    const estimatedPeopleFed = Math.round(movingAverageQuantity * (preferredUnit === 'portions' ? 1 : 2));

    const categoryBreakdown = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
      percentage: `${Math.round((count / rows.length) * 100)}%`
    }));

    // Confidence increases with more sample points up to 0.95
    const confidenceScore = Math.min(0.95, 0.70 + (rows.length * 0.02));

    return {
      donorId,
      hasHistoricalData: true,
      sampleSize: rows.length,
      isEstimate: true,
      modelType: 'SurplusPredictor Moving Average Baseline (v1)',
      disclaimer: 'This prediction is an estimated AI baseline calculated from past donations, never live inventory data.',
      predictedNextSurplus: {
        recommendedCategory: topCategory,
        estimatedQuantity: movingAverageQuantity,
        unit: preferredUnit,
        suggestedPickupWindow: '18:00 - 20:00',
        estimatedPeopleFed,
        confidenceScore: parseFloat(confidenceScore.toFixed(2))
      },
      categoryBreakdown
    };
  }
}

module.exports = new SurplusPredictorService();
