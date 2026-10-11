const { getDatabase } = require('../database/connection');

class ListingRepository {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  async create({ donorId, title, category, quantity, unit, pickupAddress, pickupWindow, expiresAt }) {
    const result = await this.db.run(
      `INSERT INTO food_listings 
        (donor_id, title, category, quantity, unit, pickup_address, pickup_window, expires_at, status, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 1)`,
      [
        donorId,
        title.trim(),
        category.trim(),
        parseFloat(quantity),
        unit.trim(),
        pickupAddress.trim(),
        pickupWindow.trim(),
        expiresAt
      ]
    );
    return await this.findById(result.lastID);
  }

  async findById(id) {
    const sql = `
      SELECT l.*, u.name as donor_name, u.email as donor_email,
             c.id as claim_id, c.ngo_id, c.claimed_at,
             ngo.name as ngo_name, ngo_p.organisation_name as ngo_org_name,
             del.id as delivery_id, del.volunteer_id, del.status as delivery_status,
             vol.name as volunteer_name
      FROM food_listings l
      JOIN users u ON l.donor_id = u.id
      LEFT JOIN claims c ON l.id = c.listing_id
      LEFT JOIN users ngo ON c.ngo_id = ngo.id
      LEFT JOIN ngo_profiles ngo_p ON ngo.id = ngo_p.user_id
      LEFT JOIN deliveries del ON c.id = del.claim_id
      LEFT JOIN users vol ON del.volunteer_id = vol.id
      WHERE l.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async findByDonorId(donorId) {
    await this.markExpiredListings();
    const sql = `
      SELECT l.*,
             c.id as claim_id, c.claimed_at,
             ngo.name as ngo_name, ngo_p.organisation_name as ngo_org_name,
             del.id as delivery_id, del.volunteer_id, del.status as delivery_status,
             vol.name as volunteer_name
      FROM food_listings l
      LEFT JOIN claims c ON l.id = c.listing_id
      LEFT JOIN users ngo ON c.ngo_id = ngo.id
      LEFT JOIN ngo_profiles ngo_p ON ngo.id = ngo_p.user_id
      LEFT JOIN deliveries del ON c.id = del.claim_id
      LEFT JOIN users vol ON del.volunteer_id = vol.id
      WHERE l.donor_id = ?
      ORDER BY l.id DESC
    `;
    return await this.db.all(sql, [donorId]);
  }

  async findAvailable(filters = {}) {
    await this.markExpiredListings();
    let sql = `
      SELECT l.*, u.name as donor_name, u.email as donor_email
      FROM food_listings l
      JOIN users u ON l.donor_id = u.id
      WHERE l.status = 'AVAILABLE'
        AND datetime(l.expires_at) > datetime('now')
    `;
    const params = [];

    if (filters.category && filters.category !== 'ALL') {
      sql += ' AND l.category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      sql += ' AND (l.title LIKE ? OR l.pickup_address LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // FR-4: sorted by expiry (closest expiry first)
    sql += ' ORDER BY datetime(l.expires_at) ASC';
    return await this.db.all(sql, params);
  }

  async update(id, donorId, updates, currentVersion) {
    const result = await this.db.run(
      `UPDATE food_listings
       SET title = ?,
           category = ?,
           quantity = ?,
           unit = ?,
           pickup_address = ?,
           pickup_window = ?,
           expires_at = ?,
           version = version + 1,
           updated_at = datetime('now')
       WHERE id = ? AND donor_id = ? AND status = 'AVAILABLE' AND version = ?`,
      [
        updates.title.trim(),
        updates.category.trim(),
        parseFloat(updates.quantity),
        updates.unit.trim(),
        updates.pickupAddress.trim(),
        updates.pickupWindow.trim(),
        updates.expiresAt,
        id,
        donorId,
        currentVersion
      ]
    );
    return result.changes > 0;
  }

  async cancel(id, donorId) {
    const result = await this.db.run(
      `UPDATE food_listings
       SET status = 'CANCELLED',
           version = version + 1,
           updated_at = datetime('now')
       WHERE id = ? AND donor_id = ? AND status = 'AVAILABLE'`,
      [id, donorId]
    );
    return result.changes > 0;
  }

  async updateStatusWithVersion(id, newStatus, currentVersion) {
    const result = await this.db.run(
      `UPDATE food_listings
       SET status = ?,
           version = version + 1,
           updated_at = datetime('now')
       WHERE id = ? AND version = ?`,
      [newStatus, id, currentVersion]
    );
    return result.changes > 0;
  }

  async markExpiredListings() {
    await this.db.run(`
      UPDATE food_listings
      SET status = 'EXPIRED',
          version = version + 1,
          updated_at = datetime('now')
      WHERE status = 'AVAILABLE' AND datetime(expires_at) <= datetime('now')
    `);
  }
}

module.exports = new ListingRepository();
