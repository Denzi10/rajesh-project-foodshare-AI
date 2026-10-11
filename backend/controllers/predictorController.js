const surplusPredictorService = require('../services/surplusPredictorService');

class PredictorController {
  async getForecast(req, res, next) {
    try {
      // FR-11: SurplusPredictor returns forecast of expected surplus for donor
      const forecast = await surplusPredictorService.predictSurplus(req.user.id);
      res.json({
        success: true,
        data: forecast
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PredictorController();
