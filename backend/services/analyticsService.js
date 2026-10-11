const { getDatabase } = require('../database/connection');

class AnalyticsService {
  constructor(db) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  async getDonorDashboard(donorId) {
    // 1. Counts by status
    const counts = await this.db.all(
      `SELECT status, COUNT(*) as count, SUM(quantity) as sum_qty
       FROM food_listings
       WHERE donor_id = ?
       GROUP BY status`,
      [donorId]
    );

    const statsMap = {};
    counts.forEach(c => { statsMap[c.status] = c.count; });

    // 2. Rescued totals
    const rescuedTotals = await this.db.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN unit = 'kg' THEN quantity ELSE 0 END), 0) as total_kg,
         COALESCE(SUM(CASE WHEN unit = 'portions' THEN quantity ELSE 0 END), 0) as total_portions
       FROM food_listings
       WHERE donor_id = ? AND status = 'DELIVERED'`,
      [donorId]
    );

    // 3. Recent listings
    const recent = await this.db.all(
      `SELECT id, title, category, quantity, unit, status, expires_at, created_at
       FROM food_listings
       WHERE donor_id = ?
       ORDER BY id DESC
       LIMIT 5`,
      [donorId]
    );

    return {
      totalListings: Object.values(statsMap).reduce((a, b) => a + b, 0),
      availableCount: statsMap['AVAILABLE'] || 0,
      claimedCount: statsMap['CLAIMED'] || 0,
      inTransitCount: statsMap['PICKED_UP'] || 0,
      deliveredCount: statsMap['DELIVERED'] || 0,
      cancelledCount: statsMap['CANCELLED'] || 0,
      expiredCount: statsMap['EXPIRED'] || 0,
      totalKgRescued: Math.round((rescuedTotals ? rescuedTotals.total_kg : 0) * 10) / 10,
      totalPortionsRescued: Math.round((rescuedTotals ? rescuedTotals.total_portions : 0)),
      recentListings: recent
    };
  }

  async getNgoDashboard(ngoUserId) {
    const profile = await this.db.get(
      'SELECT verification_status, organisation_name FROM ngo_profiles WHERE user_id = ?',
      [ngoUserId]
    );

    const claimCounts = await this.db.all(
      `SELECT c.status, COUNT(*) as count
       FROM claims c
       WHERE c.ngo_id = ?
       GROUP BY c.status`,
      [ngoUserId]
    );

    const availableRow = await this.db.get(
      `SELECT COUNT(*) as count
       FROM food_listings
       WHERE status = 'AVAILABLE' AND datetime(expires_at) > datetime('now')`
    );

    const deliveredRow = await this.db.get(
      `SELECT COUNT(*) as count,
              COALESCE(SUM(CASE WHEN l.unit = 'kg' THEN l.quantity ELSE 0 END), 0) as total_kg
       FROM claims c
       JOIN food_listings l ON c.listing_id = l.id
       JOIN deliveries d ON c.id = d.claim_id
       WHERE c.ngo_id = ? AND d.status = 'DELIVERED'`,
      [ngoUserId]
    );

    return {
      verificationStatus: profile ? profile.verification_status : 'PENDING',
      organisationName: profile ? profile.organisation_name : '',
      totalClaims: claimCounts.reduce((acc, curr) => acc + curr.count, 0),
      activeClaims: (claimCounts.find(c => c.status === 'ACTIVE') || {}).count || 0,
      completedClaims: (claimCounts.find(c => c.status === 'COMPLETED') || {}).count || 0,
      availableFoodCount: availableRow ? availableRow.count : 0,
      deliveredFoodCount: deliveredRow ? deliveredRow.count : 0,
      totalKgReceived: Math.round((deliveredRow ? deliveredRow.total_kg : 0) * 10) / 10
    };
  }

  async getVolunteerDashboard(volunteerId) {
    const availableTasks = await this.db.get(
      `SELECT COUNT(*) as count
       FROM claims c
       JOIN food_listings l ON c.listing_id = l.id
       LEFT JOIN deliveries del ON c.id = del.claim_id
       WHERE del.id IS NULL AND l.status = 'CLAIMED'`
    );

    const myDeliveries = await this.db.all(
      `SELECT status, COUNT(*) as count
       FROM deliveries
       WHERE volunteer_id = ?
       GROUP BY status`,
      [volunteerId]
    );

    const stats = {};
    myDeliveries.forEach(d => { stats[d.status] = d.count; });

    const rescuedKg = await this.db.get(
      `SELECT COALESCE(SUM(CASE WHEN l.unit = 'kg' THEN l.quantity ELSE 0 END), 0) as total_kg
       FROM deliveries del
       JOIN claims c ON del.claim_id = c.id
       JOIN food_listings l ON c.listing_id = l.id
       WHERE del.volunteer_id = ? AND del.status = 'DELIVERED'`,
      [volunteerId]
    );

    return {
      availableTasksCount: availableTasks ? availableTasks.count : 0,
      assignedCount: stats['ASSIGNED'] || 0,
      inTransitCount: stats['PICKED_UP'] || 0,
      completedCount: stats['DELIVERED'] || 0,
      totalHandled: Object.values(stats).reduce((a, b) => a + b, 0),
      totalKgDelivered: Math.round((rescuedKg ? rescuedKg.total_kg : 0) * 10) / 10
    };
  }

  async getAdminAnalytics() {
    // 1. Users by role
    const usersByRoleRows = await this.db.all(
      `SELECT role, COUNT(*) as count FROM users GROUP BY role`
    );
    const usersByRole = { DONOR: 0, NGO: 0, VOLUNTEER: 0, ADMIN: 0 };
    let totalUsers = 0;
    usersByRoleRows.forEach(r => {
      usersByRole[r.role] = r.count;
      totalUsers += r.count;
    });

    // 2. Pending NGOs
    const pendingNgoRow = await this.db.get(
      `SELECT COUNT(*) as count FROM ngo_profiles WHERE verification_status = 'PENDING'`
    );

    // 3. Listings by status
    const listingsByStatusRows = await this.db.all(
      `SELECT status, COUNT(*) as count FROM food_listings GROUP BY status`
    );
    const listingsByStatus = {
      AVAILABLE: 0,
      CLAIMED: 0,
      PICKED_UP: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      EXPIRED: 0
    };
    let totalListings = 0;
    listingsByStatusRows.forEach(r => {
      listingsByStatus[r.status] = r.count;
      totalListings += r.count;
    });

    // 4. Overall rescued impact
    const impactRow = await this.db.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN unit = 'kg' THEN quantity ELSE 0 END), 0) as total_kg,
         COALESCE(SUM(CASE WHEN unit = 'portions' THEN quantity ELSE 0 END), 0) as total_portions
       FROM food_listings
       WHERE status = 'DELIVERED'`
    );

    // 5. Category breakdown
    const categoryRows = await this.db.all(
      `SELECT category, COUNT(*) as count, SUM(quantity) as total_qty
       FROM food_listings
       GROUP BY category
       ORDER BY count DESC`
    );

    // 6. Recent activity stream (honest events from real tables)
    const recentListings = await this.db.all(
      `SELECT 'LISTING_CREATED' as event_type, id, title as description, created_at, donor_id as user_id
       FROM food_listings
       ORDER BY id DESC LIMIT 5`
    );

    const recentDeliveries = await this.db.all(
      `SELECT 'DELIVERY_UPDATE' as event_type, id, ('Status: ' || status) as description, 
              COALESCE(delivered_at, picked_up_at, created_at) as created_at, volunteer_id as user_id
       FROM deliveries
       ORDER BY id DESC LIMIT 5`
    );

    return {
      totalUsers,
      usersByRole,
      pendingNgosCount: pendingNgoRow ? pendingNgoRow.count : 0,
      totalListings,
      listingsByStatus,
      totalKgRescued: Math.round((impactRow ? impactRow.total_kg : 0) * 10) / 10,
      totalPortionsRescued: Math.round((impactRow ? impactRow.total_portions : 0)),
      categoryBreakdown: categoryRows,
      recentActivity: [...recentListings, ...recentDeliveries].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      ).slice(0, 8)
    };
  }

  async getPublicStats() {
    const impactRow = await this.db.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN unit = 'kg' THEN quantity ELSE 0 END), 0) as total_kg,
         COALESCE(SUM(CASE WHEN unit = 'portions' THEN quantity ELSE 0 END), 0) as total_portions
       FROM food_listings
       WHERE status = 'DELIVERED'`
    );

    const activeListings = await this.db.get(
      `SELECT COUNT(*) as count FROM food_listings WHERE status = 'AVAILABLE' AND datetime(expires_at) > datetime('now')`
    );

    const verifiedNgos = await this.db.get(
      `SELECT COUNT(*) as count FROM ngo_profiles WHERE verification_status = 'APPROVED'`
    );

    return {
      totalKgRescued: Math.round((impactRow ? impactRow.total_kg : 0) * 10) / 10,
      totalPortionsRescued: Math.round(impactRow ? impactRow.total_portions : 0),
      activeListingsCount: activeListings ? activeListings.count : 0,
      verifiedNgosCount: verifiedNgos ? verifiedNgos.count : 0
    };
  }
}

module.exports = new AnalyticsService();
