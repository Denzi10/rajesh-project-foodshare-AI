const notificationRepository = require('../repositories/notificationRepository');

class NotificationService {
  async notify(userId, message, type = 'INFO') {
    try {
      return await notificationRepository.create({ userId, message, type });
    } catch (err) {
      console.error('Failed to create notification:', err.message);
      return null;
    }
  }

  async getUserNotifications(userId) {
    const list = await notificationRepository.findByUserId(userId);
    const unreadCount = await notificationRepository.countUnread(userId);
    return {
      notifications: list,
      unreadCount
    };
  }

  async markAsRead(id, userId) {
    return await notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId) {
    return await notificationRepository.markAllAsRead(userId);
  }
}

module.exports = new NotificationService();
