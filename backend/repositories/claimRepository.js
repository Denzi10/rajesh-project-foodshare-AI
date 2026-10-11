const { getDatabase } = require('../database/connection');

class ClaimRepository {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  async findById(id) {
    const sql = `
      SELECT c.*,
             l.title as listing_title, l.category, l.quantity, l.unit,
             l.pickup_address, l.pickup_window, l.expires_at, l.status as listing_status,
             l.donor_id, donor.name as donor_name, donor.email as donor_email,
             ngo.name as ngo_name, ngo_p.organisation_name as ngo_org_name,
             del.id as delivery_id, del.volunteer_id, del.status as delivery_status,
             vol.name as volunteer_name
      FROM claims c
      JOIN food_listings l ON c.listing_id = l.id
      JOIN users donor ON l.donor_id = donor.id
      JOIN users ngo ON c.ngo_id = ngo.id
      LEFT JOIN ngo_profiles ngo_p ON ngo.id = ngo_p.user_id
      LEFT JOIN deliveries del ON c.id = del.claim_id
      LEFT JOIN users vol ON del.volunteer_id = vol.id
      WHERE c.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async findByListingId(listingId) {
    return await this.db.get('SELECT * FROM claims WHERE listing_id = ?', [listingId]);
  }

  async findByNgoId(ngoId) {
    const sql = `
      SELECT c.*,
             l.title as listing_title, l.category, l.quantity, l.unit,
             l.pickup_address, l.pickup_window, l.expires_at, l.status as listing_status,
             donor.name as donor_name, donor.email as donor_email,
             del.id as delivery_id, del.volunteer_id, del.status as delivery_status,
             vol.name as volunteer_name
      FROM claims c
      JOIN food_listings l ON c.listing_id = l.id
      JOIN users donor ON l.donor_id = donor.id
      LEFT JOIN deliveries del ON c.id = del.claim_id
      LEFT JOIN users vol ON del.volunteer_id = vol.id
      WHERE c.ngo_id = ?
      ORDER BY c.id DESC
    `;
    return await this.db.all(sql, [ngoId]);
  }

  /**
   * Atomic claim execution with optimistic locking & unique constraint (FR-5)
   */
  async atomicClaimListing(listingId, ngoId, expectedVersion = null) {
    // Begin immediate transaction for SQLite concurrency
    await this.db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      // 1. Fetch current listing under transaction lock
      const listing = await this.db.get(
        'SELECT id, status, version, expires_at, donor_id, title FROM food_listings WHERE id = ?',
        [listingId]
      );

      if (!listing) {
        await this.db.run('ROLLBACK');
        const err = new Error('Listing not found');
        err.statusCode = 404;
        throw err;
      }

      if (listing.status !== 'AVAILABLE') {
        await this.db.run('ROLLBACK');
        const err = new Error(`Listing is no longer available (current status: ${listing.status})`);
        err.statusCode = 409;
        throw err;
      }

      // Check expiry
      if (new Date(listing.expires_at).getTime() <= Date.now()) {
        await this.db.run(
          `UPDATE food_listings SET status = 'EXPIRED', version = version + 1 WHERE id = ?`,
          [listingId]
        );
        await this.db.run('ROLLBACK');
        const err = new Error('Listing has already expired');
        err.statusCode = 410;
        throw err;
      }

      // Check version if provided
      if (expectedVersion !== null && listing.version !== expectedVersion) {
        await this.db.run('ROLLBACK');
        const err = new Error('Listing was modified concurrently. Please refresh and try again.');
        err.statusCode = 409;
        throw err;
      }

      // 2. Perform optimistic update on food_listings
      const updateRes = await this.db.run(
        `UPDATE food_listings
         SET status = 'CLAIMED',
             version = version + 1,
             updated_at = datetime('now')
         WHERE id = ? AND status = 'AVAILABLE' AND version = ?`,
        [listingId, listing.version]
      );

      if (updateRes.changes === 0) {
        await this.db.run('ROLLBACK');
        const err = new Error('Listing was claimed by another organization simultaneously');
        err.statusCode = 409;
        throw err;
      }

      // 3. Insert claim record (guarded by UNIQUE listing_id)
      const claimRes = await this.db.run(
        `INSERT INTO claims (listing_id, ngo_id, claimed_at, status)
         VALUES (?, ?, datetime('now'), 'ACTIVE')`,
        [listingId, ngoId]
      );

      await this.db.run('COMMIT');

      return {
        claimId: claimRes.lastID,
        listingId,
        donorId: listing.donor_id,
        listingTitle: listing.title
      };
    } catch (error) {
      try {
        await this.db.run('ROLLBACK');
      } catch (rbErr) {
        // transaction may already be aborted
      }
      throw error;
    }
  }
}

module.exports = new ClaimRepository();
