const { getDatabase } = require('../database/connection');

class NgoRepository {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  async create({ userId, organisationName, registrationNumber, address }) {
    const result = await this.db.run(
      `INSERT INTO ngo_profiles (user_id, organisation_name, registration_number, address, verification_status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [userId, organisationName.trim(), registrationNumber.trim(), address.trim()]
    );
    return await this.findById(result.lastID);
  }

  async findById(id) {
    const sql = `
      SELECT p.*, u.name as contact_name, u.email, u.enabled
      FROM ngo_profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async findByUserId(userId) {
    const sql = `
      SELECT p.*, u.name as contact_name, u.email, u.enabled
      FROM ngo_profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
    `;
    return await this.db.get(sql, [userId]);
  }

  async findAll(statusFilter = null) {
    let sql = `
      SELECT p.*, u.name as contact_name, u.email, u.enabled,
             reviewer.name as reviewer_name
      FROM ngo_profiles p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users reviewer ON p.reviewed_by = reviewer.id
    `;
    const params = [];
    if (statusFilter) {
      sql += ' WHERE p.verification_status = ?';
      params.push(statusFilter);
    }
    sql += ' ORDER BY p.id DESC';
    return await this.db.all(sql, params);
  }

  async updateVerification(id, status, reviewedBy) {
    await this.db.run(
      `UPDATE ngo_profiles
       SET verification_status = ?,
           reviewed_by = ?,
           reviewed_at = datetime('now')
       WHERE id = ?`,
      [status, reviewedBy, id]
    );
    return await this.findById(id);
  }
}

module.exports = new NgoRepository();
