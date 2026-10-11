const claimService = require('../services/claimService');

class ClaimController {
  async claim(req, res, next) {
    try {
      const { listingId, expectedVersion } = req.body;
      if (!listingId) {
        return res.status(400).json({
          success: false,
          error: 'listingId is required'
        });
      }

      const claim = await claimService.claimListing(
        parseInt(listingId, 10),
        req.user.id,
        expectedVersion !== undefined ? parseInt(expectedVersion, 10) : null
      );

      res.status(201).json({
        success: true,
        message: 'Food donation claimed successfully',
        data: claim
      });
    } catch (err) {
      next(err);
    }
  }

  async getMyClaims(req, res, next) {
    try {
      const claims = await claimService.getNgoClaims(req.user.id);
      res.json({
        success: true,
        data: claims
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const claim = await claimService.getClaimById(req.params.id);
      res.json({
        success: true,
        data: claim
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ClaimController();
