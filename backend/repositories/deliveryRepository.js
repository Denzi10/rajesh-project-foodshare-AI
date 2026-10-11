const { getDatabase } = require('../database/connection');

class DeliveryRepository {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  async findAvailableTasks() {
    const sql = `
      SELECT c.id as claim_id, c.listing_id, c.ngo_id, c.claimed_at,
             l.title as listing_title, l.category, l.quantity, l.unit,
             l.pickup_address, l.pickup_window, l.expires_at, l.status as listing_status,
             l.donor_id, donor.name as donor_name, donor.email as donor_email,
             ngo.name as ngo_name, ngo_p.organisation_name as ngo_org_name, ngo_p.address as ngo_address
      FROM claims c
      JOIN food_listings l ON c.listing_id = l.id
      JOIN users donor ON l.donor_id = donor.id
      JOIN users ngo ON c.ngo_id = ngo.id
      LEFT JOIN ngo_profiles ngo_p ON ngo.id = ngo_p.user_id
      LEFT JOIN deliveries del ON c.id = del.claim_id
      WHERE del.id IS NULL
        AND l.status = 'CLAIMED'
      ORDER BY c.claimed_at ASC
    `;
    return await this.db.all(sql);
  }

  async findByVolunteerId(volunteerId) {
    const sql = `
      SELECT del.*,
             c.listing_id, c.ngo_id, c.claimed_at,
             l.title as listing_title, l.category, l.quantity, l.unit,
             l.pickup_address, l.pickup_window, l.status as listing_status,
             l.donor_id, donor.name as donor_name, donor.email as donor_email,
             ngo.name as ngo_name, ngo_p.organisation_name as ngo_org_name, ngo_p.address as ngo_address
      FROM deliveries del
      JOIN claims c ON del.claim_id = c.id
      JOIN food_listings l ON c.listing_id = l.id
      JOIN users donor ON l.donor_id = donor.id
      JOIN users ngo ON c.ngo_id = ngo.id
      LEFT JOIN ngo_profiles ngo_p ON ngo.id = ngo_p.user_id
      WHERE del.volunteer_id = ?
      ORDER BY del.id DESC
    `;
    return await this.db.all(sql, [volunteerId]);
  }

  async findById(id) {
    const sql = `
      SELECT del.*,
             c.listing_id, c.ngo_id,
             l.title as listing_title, l.category, l.quantity, l.unit,
             l.pickup_address, l.pickup_window, l.status as listing_status,
             l.donor_id, donor.name as donor_name,
             ngo.name as ngo_name, ngo_p.organisation_name as ngo_org_name, ngo_p.address as ngo_address,
             vol.name as volunteer_name
      FROM deliveries del
      JOIN claims c ON del.claim_id = c.id
      JOIN food_listings l ON c.listing_id = l.id
      JOIN users donor ON l.donor_id = donor.id
      JOIN users ngo ON c.ngo_id = ngo.id
      LEFT JOIN ngo_profiles ngo_p ON ngo.id = ngo_p.user_id
      JOIN users vol ON del.volunteer_id = vol.id
      WHERE del.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async findByClaimId(claimId) {
    return await this.db.get('SELECT * FROM deliveries WHERE claim_id = ?', [claimId]);
  }

  async assignTask(claimId, volunteerId) {
    await this.db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const claim = await this.db.get('SELECT * FROM claims WHERE id = ?', [claimId]);
      if (!claim) {
        await this.db.run('ROLLBACK');
        const err = new Error('Claim not found');
        err.statusCode = 404;
        throw err;
      }

      const existingDelivery = await this.db.get(
        'SELECT id FROM deliveries WHERE claim_id = ?',
        [claimId]
      );
      if (existingDelivery) {
        await this.db.run('ROLLBACK');
        const err = new Error('Task has already been accepted by another volunteer');
        err.statusCode = 409;
        throw err;
      }

      const res = await this.db.run(
        `INSERT INTO deliveries (claim_id, volunteer_id, status, created_at)
         VALUES (?, ?, 'ASSIGNED', datetime('now'))`,
        [claimId, volunteerId]
      );

      await this.db.run('COMMIT');
      return await this.findById(res.lastID);
    } catch (error) {
      try {
        await this.db.run('ROLLBACK');
      } catch (e) {}
      throw error;
    }
  }

  async markPickedUp(deliveryId, volunteerId) {
    await this.db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const delivery = await this.db.get(
        'SELECT * FROM deliveries WHERE id = ?',
        [deliveryId]
      );

      if (!delivery) {
        await this.db.run('ROLLBACK');
        const err = new Error('Delivery record not found');
        err.statusCode = 404;
        throw err;
      }

      if (delivery.volunteer_id !== volunteerId) {
        await this.db.run('ROLLBACK');
        const err = new Error('You are not authorized to update this delivery task');
        err.statusCode = 403;
        throw err;
      }

      if (delivery.status !== 'ASSIGNED') {
        await this.db.run('ROLLBACK');
        const err = new Error(`Cannot mark picked up: Task is currently in '${delivery.status}' status`);
        err.statusCode = 400;
        throw err;
      }

      // Update delivery
      await this.db.run(
        `UPDATE deliveries
         SET status = 'PICKED_UP',
             picked_up_at = datetime('now')
         WHERE id = ?`,
        [deliveryId]
      );

      // Also update listing status to PICKED_UP
      const claim = await this.db.get('SELECT listing_id FROM claims WHERE id = ?', [delivery.claim_id]);
      if (claim) {
        await this.db.run(
          `UPDATE food_listings
           SET status = 'PICKED_UP',
               version = version + 1,
               updated_at = datetime('now')
           WHERE id = ?`,
          [claim.listing_id]
        );
      }

      await this.db.run('COMMIT');
      return await this.findById(deliveryId);
    } catch (error) {
      try {
        await this.db.run('ROLLBACK');
      } catch (e) {}
      throw error;
    }
  }

  async markDelivered(deliveryId, volunteerId) {
    await this.db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const delivery = await this.db.get(
        'SELECT * FROM deliveries WHERE id = ?',
        [deliveryId]
      );

      if (!delivery) {
        await this.db.run('ROLLBACK');
        const err = new Error('Delivery record not found');
        err.statusCode = 404;
        throw err;
      }

      if (delivery.volunteer_id !== volunteerId) {
        await this.db.run('ROLLBACK');
        const err = new Error('You are not authorized to update this delivery task');
        err.statusCode = 403;
        throw err;
      }

      if (delivery.status !== 'PICKED_UP') {
        await this.db.run('ROLLBACK');
        const err = new Error(`Cannot mark delivered: Task must be 'PICKED_UP' first (current status: '${delivery.status}')`);
        err.statusCode = 400;
        throw err;
      }

      // Update delivery
      await this.db.run(
        `UPDATE deliveries
         SET status = 'DELIVERED',
             delivered_at = datetime('now')
         WHERE id = ?`,
        [deliveryId]
      );

      // Update claim status to COMPLETED
      await this.db.run(
        `UPDATE claims SET status = 'COMPLETED' WHERE id = ?`,
        [delivery.claim_id]
      );

      // Update food_listings status to DELIVERED
      const claim = await this.db.get('SELECT listing_id FROM claims WHERE id = ?', [delivery.claim_id]);
      if (claim) {
        await this.db.run(
          `UPDATE food_listings
           SET status = 'DELIVERED',
               version = version + 1,
               updated_at = datetime('now')
           WHERE id = ?`,
          [claim.listing_id]
        );
      }

      await this.db.run('COMMIT');
      return await this.findById(deliveryId);
    } catch (error) {
      try {
        await this.db.run('ROLLBACK');
      } catch (e) {}
      throw error;
    }
  }
}

module.exports = new DeliveryRepository();
