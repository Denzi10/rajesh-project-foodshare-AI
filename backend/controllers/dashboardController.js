const analyticsService = require('../services/analyticsService');

class DashboardController {
  async getDashboard(req, res, next) {
    try {
      const { role, id } = req.user;
      let dashboardData = {};

      if (role === 'DONOR') {
        dashboardData = await analyticsService.getDonorDashboard(id);
      } else if (role === 'NGO') {
        dashboardData = await analyticsService.getNgoDashboard(id);
      } else if (role === 'VOLUNTEER') {
        dashboardData = await analyticsService.getVolunteerDashboard(id);
      } else if (role === 'ADMIN') {
        dashboardData = await analyticsService.getAdminAnalytics();
      }

      res.json({
        success: true,
        role,
        data: dashboardData
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardController();
