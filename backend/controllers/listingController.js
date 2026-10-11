const listingService = require('../services/listingService');

class ListingController {
  async create(req, res, next) {
    try {
      const listing = await listingService.createListing(req.user.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Food listing created successfully',
        data: listing
      });
    } catch (err) {
      next(err);
    }
  }

  async getAllAvailable(req, res, next) {
    try {
      const filters = {
        category: req.query.category,
        search: req.query.search
      };
      const listings = await listingService.getAvailableListings(filters);
      res.json({
        success: true,
        data: listings
      });
    } catch (err) {
      next(err);
    }
  }

  async getMyListings(req, res, next) {
    try {
      const listings = await listingService.getDonorListings(req.user.id);
      res.json({
        success: true,
        data: listings
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const listing = await listingService.getListingById(req.params.id);
      res.json({
        success: true,
        data: listing
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const listing = await listingService.updateListing(req.params.id, req.user.id, req.body);
      res.json({
        success: true,
        message: 'Listing updated successfully',
        data: listing
      });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await listingService.cancelListing(req.params.id, req.user.id);
      res.json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ListingController();
