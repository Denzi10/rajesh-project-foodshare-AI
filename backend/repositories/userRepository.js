const { getDatabase } = require('../database/connection');

class UserRepository {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  async findByEmail(email) {
    return await this.db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  }

  async findById(id) {
    return await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async create({ name, email, passwordHash, role, enabled = 1 }) {
    const result = await this.db.run(
      `INSERT INTO users (name, email, password_hash, role, enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, role, enabled]
    );
    return await this.findById(result.lastID);
  }

  async findAll(filters = {}) {
    let sql = 'SELECT id, name, email, role, enabled, created_at FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      sql += ' AND role = ?';
      params.push(filters.role);
    }
    if (filters.enabled !== undefined && filters.enabled !== null) {
      sql += ' AND enabled = ?';
      params.push(filters.enabled ? 1 : 0);
    }
    if (filters.search) {
      sql += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY id DESC';
    return await this.db.all(sql, params);
  }

  async updateStatus(id, enabled) {
    await this.db.run('UPDATE users SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
    return await this.findById(id);
  }

  async countTotal() {
    const row = await this.db.get('SELECT COUNT(*) as count FROM users');
    return row ? row.count : 0;
  }
}

module.exports = new UserRepository();
