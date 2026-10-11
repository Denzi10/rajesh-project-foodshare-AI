const listingRepository = require('../repositories/listingRepository');

class ListingService {
  toDto(listing) {
    if (!listing) return null;
    return {
      id: listing.id,
      donorId: listing.donor_id,
      donorName: listing.donor_name,
      donorEmail: listing.donor_email,
      title: listing.title,
      category: listing.category,
      quantity: listing.quantity,
      unit: listing.unit,
      pickupAddress: listing.pickup_address,
      pickupWindow: listing.pickup_window,
      expiresAt: listing.expires_at,
      status: listing.status,
      version: listing.version,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      claim: listing.claim_id ? {
        id: listing.claim_id,
        ngoId: listing.ngo_id,
        ngoName: listing.ngo_name,
        ngoOrgName: listing.ngo_org_name,
        claimedAt: listing.claimed_at,
        delivery: listing.delivery_id ? {
          id: listing.delivery_id,
          volunteerId: listing.volunteer_id,
          volunteerName: listing.volunteer_name,
          status: listing.delivery_status
        } : null
      } : null
    };
  }

  async createListing(donorId, data) {
    const { title, category, quantity, unit, pickupAddress, pickupWindow, expiresAt } = data;

    if (!title || !title.trim()) {
      const err = new Error('Food title/name is required');
      err.statusCode = 400;
      throw err;
    }

    if (!category || !category.trim()) {
      const err = new Error('Category is required');
      err.statusCode = 400;
      throw err;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      const err = new Error('Quantity must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    if (!unit || !unit.trim()) {
      const err = new Error('Unit of measurement is required (e.g., kg, portions)');
      err.statusCode = 400;
      throw err;
    }

    if (!pickupAddress || !pickupAddress.trim()) {
      const err = new Error('Pickup address is required');
      err.statusCode = 400;
      throw err;
    }

    if (!pickupWindow || !pickupWindow.trim()) {
      const err = new Error('Pickup window is required');
      err.statusCode = 400;
      throw err;
    }

    if (!expiresAt) {
      const err = new Error('Expiry date and time is required');
      err.statusCode = 400;
      throw err;
    }

    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime()) || expiryDate.getTime() <= Date.now()) {
      const err = new Error('Expiry time must be in the future');
      err.statusCode = 400;
      throw err;
    }

    const listing = await listingRepository.create({
      donorId,
      title,
      category,
      quantity: numQty,
      unit,
      pickupAddress,
      pickupWindow,
      expiresAt: expiryDate.toISOString()
    });

    return this.toDto(listing);
  }

  async getListingById(id) {
    const listing = await listingRepository.findById(id);
    if (!listing) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }
    return this.toDto(listing);
  }

  async getDonorListings(donorId) {
    const listings = await listingRepository.findByDonorId(donorId);
    return listings.map(l => this.toDto(l));
  }

  async getAvailableListings(filters = {}) {
    const listings = await listingRepository.findAvailable(filters);
    return listings.map(l => this.toDto(l));
  }

  async updateListing(id, donorId, updates) {
    const current = await listingRepository.findById(id);
    if (!current) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check (Page 4)
    if (current.donor_id !== donorId) {
      const err = new Error('You can only edit your own listings');
      err.statusCode = 403;
      throw err;
    }

    // Must be unclaimed (FR-3)
    if (current.status !== 'AVAILABLE') {
      const err = new Error(`Cannot edit listing: it is already ${current.status}`);
      err.statusCode = 400;
      throw err;
    }

    const expiryDate = new Date(updates.expiresAt || current.expires_at);
    if (isNaN(expiryDate.getTime()) || expiryDate.getTime() <= Date.now()) {
      const err = new Error('Expiry time must be in the future');
      err.statusCode = 400;
      throw err;
    }

    const success = await listingRepository.update(
      id,
      donorId,
      {
        title: updates.title || current.title,
        category: updates.category || current.category,
        quantity: updates.quantity || current.quantity,
        unit: updates.unit || current.unit,
        pickupAddress: updates.pickupAddress || current.pickup_address,
        pickupWindow: updates.pickupWindow || current.pickup_window,
        expiresAt: expiryDate.toISOString()
      },
      current.version
    );

    if (!success) {
      const err = new Error('Listing was modified or claimed by another user. Update failed.');
      err.statusCode = 409;
      throw err;
    }

    return await this.getListingById(id);
  }

  async cancelListing(id, donorId) {
    const current = await listingRepository.findById(id);
    if (!current) {
      const err = new Error('Listing not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check
    if (current.donor_id !== donorId) {
      const err = new Error('You can only cancel your own listings');
      err.statusCode = 403;
      throw err;
    }

    // Must be unclaimed (FR-3)
    if (current.status !== 'AVAILABLE') {
      const err = new Error(`Cannot cancel listing: it is already ${current.status}`);
      err.statusCode = 400;
      throw err;
    }

    const success = await listingRepository.cancel(id, donorId);
    if (!success) {
      const err = new Error('Failed to cancel listing');
      err.statusCode = 500;
      throw err;
    }

    return { message: 'Listing successfully cancelled', id };
  }
}

module.exports = new ListingService();
