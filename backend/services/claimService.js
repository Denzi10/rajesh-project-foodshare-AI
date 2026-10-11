const claimRepository = require('../repositories/claimRepository');
const ngoRepository = require('../repositories/ngoRepository');
const notificationService = require('./notificationService');

class ClaimService {
  toDto(claim) {
    if (!claim) return null;
    return {
      id: claim.id,
      listingId: claim.listing_id,
      listingTitle: claim.listing_title,
      category: claim.category,
      quantity: claim.quantity,
      unit: claim.unit,
      pickupAddress: claim.pickup_address,
      pickupWindow: claim.pickup_window,
      expiresAt: claim.expires_at,
      status: claim.status,
      claimedAt: claim.claimed_at,
      donor: {
        id: claim.donor_id,
        name: claim.donor_name,
        email: claim.donor_email
      },
      delivery: claim.delivery_id ? {
        id: claim.delivery_id,
        volunteerId: claim.volunteer_id,
        volunteerName: claim.volunteer_name,
        status: claim.delivery_status
      } : null
    };
  }

  async claimListing(listingId, ngoUserId, expectedVersion = null) {
    // 1. Verify NGO is APPROVED (FR-2)
    const profile = await ngoRepository.findByUserId(ngoUserId);
    if (!profile) {
      const err = new Error('NGO profile not found for this user.');
      err.statusCode = 404;
      throw err;
    }

    if (profile.verification_status !== 'APPROVED') {
      const err = new Error(
        `Only admin-verified NGOs can claim food listings. Your verification status is currently '${profile.verification_status}'.`
      );
      err.statusCode = 403;
      throw err;
    }

    // 2. Atomic claim execution (FR-5)
    const result = await claimRepository.atomicClaimListing(listingId, ngoUserId, expectedVersion);

    // 3. Send in-app notification to Donor (FR-7)
    await notificationService.notify(
      result.donorId,
      `Your food donation "${result.listingTitle}" has been claimed by ${profile.organisation_name}! It is now awaiting volunteer pickup.`,
      'SUCCESS'
    );

    // 4. Send in-app notification to NGO
    await notificationService.notify(
      ngoUserId,
      `You successfully claimed "${result.listingTitle}". A volunteer can now accept the delivery pickup task.`,
      'INFO'
    );

    return await this.getClaimById(result.claimId);
  }

  async getClaimById(id) {
    const claim = await claimRepository.findById(id);
    if (!claim) {
      const err = new Error('Claim record not found');
      err.statusCode = 404;
      throw err;
    }
    return this.toDto(claim);
  }

  async getNgoClaims(ngoUserId) {
    const list = await claimRepository.findByNgoId(ngoUserId);
    return list.map(c => this.toDto(c));
  }
}

module.exports = new ClaimService();
