const notificationService = require('../services/notificationService');

class NotificationController {
  async getMyNotifications(req, res, next) {
    try {
      const data = await notificationService.getUserNotifications(req.user.id);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      await notificationService.markAsRead(id, req.user.id);
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      await notificationService.markAllAsRead(req.user.id);
      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
