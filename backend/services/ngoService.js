const ngoRepository = require('../repositories/ngoRepository');
const notificationService = require('./notificationService');

class NgoService {
  async getProfileByUserId(userId) {
    const profile = await ngoRepository.findByUserId(userId);
    if (!profile) {
      const err = new Error('NGO profile not found');
      err.statusCode = 404;
      throw err;
    }
    return profile;
  }

  async getAllNgos(status = null) {
    return await ngoRepository.findAll(status);
  }

  async reviewNgo(ngoProfileId, status, adminUserId) {
    const validStatuses = ['APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      const err = new Error('Status must be either APPROVED or REJECTED');
      err.statusCode = 400;
      throw err;
    }

    const currentProfile = await ngoRepository.findById(ngoProfileId);
    if (!currentProfile) {
      const err = new Error('NGO profile not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await ngoRepository.updateVerification(ngoProfileId, status, adminUserId);

    // Send in-app notification to NGO user (FR-7)
    const notifMessage = status === 'APPROVED'
      ? `Congratulations! Your NGO "${currentProfile.organisation_name}" has been APPROVED. You can now claim surplus food donations.`
      : `Your NGO profile "${currentProfile.organisation_name}" was reviewed and marked as REJECTED. Please contact administrator.`;

    await notificationService.notify(
      currentProfile.user_id,
      notifMessage,
      status === 'APPROVED' ? 'SUCCESS' : 'WARNING'
    );

    return updated;
  }
}

module.exports = new NgoService();
