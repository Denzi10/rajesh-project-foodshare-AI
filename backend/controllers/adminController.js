const userRepository = require('../repositories/userRepository');
const ngoService = require('../services/ngoService');
const analyticsService = require('../services/analyticsService');

class AdminController {
  async getUsers(req, res, next) {
    try {
      const filters = {
        role: req.query.role,
        enabled: req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined,
        search: req.query.search
      };
      const users = await userRepository.findAll(filters);
      res.json({
        success: true,
        data: users
      });
    } catch (err) {
      next(err);
    }
  }

  async setUserStatus(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      const { enabled } = req.body;

      if (enabled === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Field "enabled" (boolean) is required'
        });
      }

      // Prevent disabling the current admin's own account
      if (userId === req.user.id && !enabled) {
        return res.status(400).json({
          success: false,
          error: 'You cannot disable your own administrator account'
        });
      }

      const updated = await userRepository.updateStatus(userId, enabled);
      res.json({
        success: true,
        message: `User account has been ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          enabled: Boolean(updated.enabled)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getNgos(req, res, next) {
    try {
      const status = req.query.status || null;
      const ngos = await ngoService.getAllNgos(status);
      res.json({
        success: true,
        data: ngos
      });
    } catch (err) {
      next(err);
    }
  }

  async reviewNgo(req, res, next) {
    try {
      const ngoProfileId = parseInt(req.params.id, 10);
      const { status } = req.body; // 'APPROVED' or 'REJECTED'

      if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Verification status must be either APPROVED or REJECTED'
        });
      }

      const updated = await ngoService.reviewNgo(ngoProfileId, status, req.user.id);
      res.json({
        success: true,
        message: `NGO verification status updated to ${status}`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const analytics = await analyticsService.getAdminAnalytics();
      res.json({
        success: true,
        data: analytics
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
