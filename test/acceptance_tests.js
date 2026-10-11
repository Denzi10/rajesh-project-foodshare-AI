/**
 * FoodShare AI - Automated Acceptance Test Suite
 * Validates all Acceptance Criteria and Functional Requirements from Pages 1-7 of Specifications.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const { initDatabase } = require('../backend/database/connection');
const { runMigrations } = require('../backend/database/migrations');
const { seedAdmin } = require('../backend/database/seed');

const authService = require('../backend/services/authService');
const listingService = require('../backend/services/listingService');
const claimService = require('../backend/services/claimService');
const deliveryService = require('../backend/services/deliveryService');
const ngoService = require('../backend/services/ngoService');
const analyticsService = require('../backend/services/analyticsService');
const surplusPredictorService = require('../backend/services/surplusPredictorService');
const notificationService = require('../backend/services/notificationService');
const userRepository = require('../backend/repositories/userRepository');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        passedTests++;
        console.log(`  ✓ ${description}`);
      }).catch(err => {
        console.error(`  ✗ ${description}`);
        console.error(`    Error: ${err.message}`);
        throw err;
      });
    } else {
      passedTests++;
      console.log(`  ✓ ${description}`);
    }
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   FOODSHARE AI - AUTOMATED ACCEPTANCE TEST SUITE');
  console.log('======================================================\n');

  // Use a fresh in-memory database for clean test isolation
  const testDb = initDatabase(':memory:');
  await runMigrations(testDb);
  await seedAdmin(testDb);

  // --- Phase 1: Authentication & Security Requirements ---
  console.log('--- Phase 1: Authentication & Security (FR-1, Acceptance Criteria) ---');

  await it('Registration rejects public attempts to create an ADMIN role', async () => {
    try {
      await authService.register({
        name: 'Hacker',
        email: 'hacker@foodshare.org',
        password: 'Password123!',
        role: 'ADMIN'
      });
      assert.fail('Should have rejected ADMIN registration');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Public registration is permitted only for DONOR, NGO, or VOLUNTEER/);
    }
  });

  await it('Registration rejects duplicate emails', async () => {
    await authService.register({
      name: 'Donor One',
      email: 'donor1@foodshare.org',
      password: 'Password123!',
      role: 'DONOR'
    });

    try {
      await authService.register({
        name: 'Donor Duplicate',
        email: 'donor1@foodshare.org',
        password: 'Password123!',
        role: 'DONOR'
      });
      assert.fail('Should have rejected duplicate email');
    } catch (err) {
      assert.strictEqual(err.statusCode, 409);
      assert.match(err.message, /already exists/);
    }
  });

  await it('Passwords are saved as BCrypt hashes and never appear in responses', async () => {
    const donorUser = await userRepository.findByEmail('donor1@foodshare.org');
    assert.ok(donorUser.password_hash.startsWith('$2'), 'Password hash must be BCrypt format');
    assert.strictEqual(await bcrypt.compare('Password123!', donorUser.password_hash), true);

    const dto = authService.toUserDto(donorUser);
    assert.strictEqual(dto.password_hash, undefined, 'password_hash must never leak into user DTO');
  });

  // --- Phase 2: Honest Data & Empty Database States ---
  console.log('\n--- Phase 2: Honest Data & Dashboards (FR-8, FR-10) ---');

  await it('Empty system shows honest zeros and empty states without hardcoded sample data', async () => {
    const adminAnalytics = await analyticsService.getAdminAnalytics();
    assert.strictEqual(adminAnalytics.totalListings, 0, 'Total listings must be 0 initially');
    assert.strictEqual(adminAnalytics.totalKgRescued, 0, 'Total rescued kg must be 0 initially');
    assert.strictEqual(adminAnalytics.pendingNgosCount, 0, 'Pending NGOs must be 0 initially');

    const donorUser = await userRepository.findByEmail('donor1@foodshare.org');
    const donorDash = await analyticsService.getDonorDashboard(donorUser.id);
    assert.strictEqual(donorDash.totalListings, 0);
    assert.strictEqual(donorDash.totalKgRescued, 0);
    assert.strictEqual(donorDash.recentListings.length, 0);
  });

  // --- Phase 3: NGO Registration & Verification Gating ---
  console.log('\n--- Phase 3: NGO Verification & Gating (FR-2, FR-4) ---');

  let ngoUser1, ngoUser2;

  await it('NGO registration creates a PENDING verification profile', async () => {
    const ngoRes1 = await authService.register({
      name: 'Hope Shelter Leader',
      email: 'hope@ngo.org',
      password: 'Password123!',
      role: 'NGO',
      ngoData: {
        organisationName: 'Hope Food Bank',
        registrationNumber: 'NGO-2026-991',
        address: '100 Mission St, City Center'
      }
    });

    ngoUser1 = ngoRes1;
    assert.strictEqual(ngoRes1.ngoProfile.verificationStatus, 'PENDING');

    const ngoRes2 = await authService.register({
      name: 'Unity Kitchen Leader',
      email: 'unity@ngo.org',
      password: 'Password123!',
      role: 'NGO',
      ngoData: {
        organisationName: 'Unity Community Kitchen',
        registrationNumber: 'NGO-2026-554',
        address: '220 North Ave, City Center'
      }
    });
    ngoUser2 = ngoRes2;
  });

  let createdListing;

  await it('Donor creates surplus food listing with valid details', async () => {
    const donorUser = await userRepository.findByEmail('donor1@foodshare.org');
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    createdListing = await listingService.createListing(donorUser.id, {
      title: '50 Fresh Bento Boxes',
      category: 'Cooked Meals',
      quantity: 50,
      unit: 'portions',
      pickupAddress: '45 Bakery Road, Bay Square',
      pickupWindow: 'Today 17:00 - 19:00',
      expiresAt: futureDate
    });

    assert.strictEqual(createdListing.title, '50 Fresh Bento Boxes');
    assert.strictEqual(createdListing.status, 'AVAILABLE');
    assert.strictEqual(createdListing.version, 1);
  });

  await it('Unverified NGO is strictly BLOCKED from claiming food', async () => {
    try {
      await claimService.claimListing(createdListing.id, ngoUser1.id);
      assert.fail('Unverified NGO should not be allowed to claim food');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.match(err.message, /Only admin-verified NGOs can claim food listings/);
    }
  });

  await it('Admin verifies NGO and NGO receives an approval notification', async () => {
    const admin = await userRepository.findByEmail('admin@foodshare.org');
    const updatedNgo = await ngoService.reviewNgo(ngoUser1.ngoProfile.id, 'APPROVED', admin.id);
    assert.strictEqual(updatedNgo.verification_status, 'APPROVED');

    // Check in-app notification created for NGO (FR-7)
    const notifs = await notificationService.getUserNotifications(ngoUser1.id);
    assert.ok(notifs.notifications.length > 0);
    assert.match(notifs.notifications[0].message, /APPROVED/);
  });

  // --- Phase 4: Atomic Claims & Conflict Handling ---
  console.log('\n--- Phase 4: Atomic Claims & Concurrency (FR-5) ---');

  let activeClaim;

  await it('Verified NGO claims available listing; listing transitions to CLAIMED', async () => {
    activeClaim = await claimService.claimListing(createdListing.id, ngoUser1.id, 1);
    assert.strictEqual(activeClaim.listingId, createdListing.id);
    assert.strictEqual(activeClaim.status, 'ACTIVE');

    const updatedListing = await listingService.getListingById(createdListing.id);
    assert.strictEqual(updatedListing.status, 'CLAIMED');
    assert.strictEqual(updatedListing.version, 2);
  });

  await it('Second claim attempt on the same listing produces 409 Conflict', async () => {
    const admin = await userRepository.findByEmail('admin@foodshare.org');
    await ngoService.reviewNgo(ngoUser2.ngoProfile.id, 'APPROVED', admin.id);

    try {
      await claimService.claimListing(createdListing.id, ngoUser2.id);
      assert.fail('Second claim should have produced conflict');
    } catch (err) {
      assert.strictEqual(err.statusCode, 409);
      assert.match(err.message, /is no longer available|claimed by another/);
    }
  });

  await it('Donor cannot edit or cancel an already claimed listing', async () => {
    const donorUser = await userRepository.findByEmail('donor1@foodshare.org');
    try {
      await listingService.cancelListing(createdListing.id, donorUser.id);
      assert.fail('Should not be able to cancel claimed listing');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /already CLAIMED/);
    }
  });

  // --- Phase 5: Volunteer Delivery Workflow ---
  console.log('\n--- Phase 5: Volunteer Delivery Workflow & Gating (FR-6) ---');

  let volunteerUser1, volunteerUser2, activeDelivery;

  await it('Volunteer registers and views available unclaimed delivery tasks', async () => {
    volunteerUser1 = await authService.register({
      name: 'Alex Volunteer',
      email: 'alex@volunteers.org',
      password: 'Password123!',
      role: 'VOLUNTEER'
    });

    volunteerUser2 = await authService.register({
      name: 'Sam Volunteer',
      email: 'sam@volunteers.org',
      password: 'Password123!',
      role: 'VOLUNTEER'
    });

    const tasks = await deliveryService.getAvailableTasks();
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].claimId, activeClaim.id);
  });

  await it('Volunteer accepts pickup task; task transitions to ASSIGNED', async () => {
    activeDelivery = await deliveryService.acceptTask(activeClaim.id, volunteerUser1.id);
    assert.strictEqual(activeDelivery.status, 'ASSIGNED');
    assert.strictEqual(activeDelivery.volunteerId, volunteerUser1.id);
  });

  await it('Another volunteer cannot accept the already assigned task', async () => {
    try {
      await deliveryService.acceptTask(activeClaim.id, volunteerUser2.id);
      assert.fail('Task cannot be double assigned');
    } catch (err) {
      assert.strictEqual(err.statusCode, 409);
      assert.match(err.message, /already been accepted/);
    }
  });

  await it('Volunteer cannot skip steps (cannot mark delivered before picked up)', async () => {
    try {
      await deliveryService.markDelivered(activeDelivery.id, volunteerUser1.id);
      assert.fail('Cannot skip pickup step');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /must be 'PICKED_UP' first/);
    }
  });

  await it('Assigned volunteer marks picked up; listing and delivery advance to PICKED_UP', async () => {
    const pickedUp = await deliveryService.markPickedUp(activeDelivery.id, volunteerUser1.id);
    assert.strictEqual(pickedUp.status, 'PICKED_UP');
    assert.ok(pickedUp.pickedUpAt);

    const listing = await listingService.getListingById(createdListing.id);
    assert.strictEqual(listing.status, 'PICKED_UP');
  });

  await it('Assigned volunteer marks delivered; food listing completes as DELIVERED', async () => {
    const delivered = await deliveryService.markDelivered(activeDelivery.id, volunteerUser1.id);
    assert.strictEqual(delivered.status, 'DELIVERED');
    assert.ok(delivered.deliveredAt);

    const listing = await listingService.getListingById(createdListing.id);
    assert.strictEqual(listing.status, 'DELIVERED');
  });

  // --- Phase 6: SurplusPredictor Baseline Forecast ---
  console.log('\n--- Phase 6: SurplusPredictor Baseline (FR-11) ---');

  await it('SurplusPredictor returns baseline forecast labeled as estimate for donor', async () => {
    const donorUser = await userRepository.findByEmail('donor1@foodshare.org');
    const forecast = await surplusPredictorService.predictSurplus(donorUser.id);

    assert.strictEqual(forecast.isEstimate, true);
    assert.ok(forecast.disclaimer.includes('estimated AI baseline'));
    assert.strictEqual(forecast.hasHistoricalData, true);
    assert.strictEqual(forecast.predictedNextSurplus.recommendedCategory, 'Cooked Meals');
    assert.ok(forecast.predictedNextSurplus.confidenceScore > 0);
  });

  // --- Phase 7: Honest Statistics & Reporting ---
  console.log('\n--- Phase 7: Real Honest Analytics (FR-8, FR-10) ---');

  await it('Platform analytics reflect real completed donations', async () => {
    const adminAnalytics = await analyticsService.getAdminAnalytics();
    assert.strictEqual(adminAnalytics.totalListings, 1);
    assert.strictEqual(adminAnalytics.listingsByStatus.DELIVERED, 1);
    assert.strictEqual(adminAnalytics.totalPortionsRescued, 50);

    const donorUser = await userRepository.findByEmail('donor1@foodshare.org');
    const donorDash = await analyticsService.getDonorDashboard(donorUser.id);
    assert.strictEqual(donorDash.deliveredCount, 1);
    assert.strictEqual(donorDash.totalPortionsRescued, 50);
  });

  console.log('\n======================================================');
  console.log(`  ALL ${passedTests}/${totalTests} ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log('======================================================\n');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\nTests failed with error:', err);
  process.exit(1);
});
