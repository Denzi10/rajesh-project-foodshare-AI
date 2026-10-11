const { getDatabase } = require('../database/connection');

class NotificationRepository {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  async create({ userId, message, type }) {
    const result = await this.db.run(
      `INSERT INTO notifications (user_id, message, type, read_flag, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`,
      [userId, message, type]
    );
    return await this.findById(result.lastID);
  }

  async findById(id) {
    return await this.db.get('SELECT * FROM notifications WHERE id = ?', [id]);
  }

  async findByUserId(userId, limit = 50) {
    return await this.db.all(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  async countUnread(userId) {
    const row = await this.db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_flag = 0',
      [userId]
    );
    return row ? row.count : 0;
  }

  async markAsRead(id, userId) {
    const res = await this.db.run(
      'UPDATE notifications SET read_flag = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return res.changes > 0;
  }

  async markAllAsRead(userId) {
    const res = await this.db.run(
      'UPDATE notifications SET read_flag = 1 WHERE user_id = ?',
      [userId]
    );
    return res.changes;
  }
}

module.exports = new NotificationRepository();
