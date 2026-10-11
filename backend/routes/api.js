const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const listingController = require('../controllers/listingController');
const claimController = require('../controllers/claimController');
const deliveryController = require('../controllers/deliveryController');
const predictorController = require('../controllers/predictorController');
const notificationController = require('../controllers/notificationController');
const adminController = require('../controllers/adminController');
const dashboardController = require('../controllers/dashboardController');

const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

// --- Auth Routes ---
router.post('/auth/register', (req, res, next) => authController.register(req, res, next));
router.post('/auth/login', (req, res, next) => authController.login(req, res, next));
router.post('/auth/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));
router.get('/auth/me', (req, res, next) => authController.getCurrentUser(req, res, next));

// --- Role Dashboard Route (FR-8) ---
router.get('/dashboard', requireAuth, (req, res, next) => dashboardController.getDashboard(req, res, next));

// --- Public Platform Impact Metrics ---
router.get('/stats/public', async (req, res, next) => {
  try {
    const analyticsService = require('../services/analyticsService');
    const stats = await analyticsService.getPublicStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// --- Listings Routes (FR-3, FR-4) ---
// Available listings (public / NGOs)
router.get('/listings', (req, res, next) => listingController.getAllAvailable(req, res, next));
router.get('/listings/my', requireAuth, requireRole('DONOR'), (req, res, next) => listingController.getMyListings(req, res, next));
router.get('/listings/:id', (req, res, next) => listingController.getById(req, res, next));
router.post('/listings', requireAuth, requireRole('DONOR'), (req, res, next) => listingController.create(req, res, next));
router.put('/listings/:id', requireAuth, requireRole('DONOR'), (req, res, next) => listingController.update(req, res, next));
router.delete('/listings/:id', requireAuth, requireRole('DONOR'), (req, res, next) => listingController.cancel(req, res, next));

// --- Surplus Predictor (FR-11) ---
router.get('/predictor/forecast', requireAuth, requireRole('DONOR'), (req, res, next) => predictorController.getForecast(req, res, next));

// --- Claims Routes (FR-5) ---
router.post('/claims', requireAuth, requireRole('NGO'), (req, res, next) => claimController.claim(req, res, next));
router.get('/claims/my', requireAuth, requireRole('NGO'), (req, res, next) => claimController.getMyClaims(req, res, next));
router.get('/claims/:id', requireAuth, (req, res, next) => claimController.getById(req, res, next));

// --- Deliveries Routes (FR-6) ---
router.get('/deliveries/available', requireAuth, requireRole('VOLUNTEER'), (req, res, next) => deliveryController.getAvailableTasks(req, res, next));
router.get('/deliveries/my', requireAuth, requireRole('VOLUNTEER'), (req, res, next) => deliveryController.getMyDeliveries(req, res, next));
router.post('/deliveries/accept/:claimId', requireAuth, requireRole('VOLUNTEER'), (req, res, next) => deliveryController.acceptTask(req, res, next));
router.post('/deliveries/:id/pickup', requireAuth, requireRole('VOLUNTEER'), (req, res, next) => deliveryController.markPickedUp(req, res, next));
router.post('/deliveries/:id/deliver', requireAuth, requireRole('VOLUNTEER'), (req, res, next) => deliveryController.markDelivered(req, res, next));

// --- Notifications Routes (FR-7) ---
router.get('/notifications', requireAuth, (req, res, next) => notificationController.getMyNotifications(req, res, next));
router.put('/notifications/:id/read', requireAuth, (req, res, next) => notificationController.markAsRead(req, res, next));
router.put('/notifications/read-all', requireAuth, (req, res, next) => notificationController.markAllAsRead(req, res, next));

// --- Admin Routes (FR-9, FR-10) ---
router.get('/admin/users', requireAuth, requireRole('ADMIN'), (req, res, next) => adminController.getUsers(req, res, next));
router.put('/admin/users/:id/status', requireAuth, requireRole('ADMIN'), (req, res, next) => adminController.setUserStatus(req, res, next));
router.get('/admin/ngos', requireAuth, requireRole('ADMIN'), (req, res, next) => adminController.getNgos(req, res, next));
router.put('/admin/ngos/:id/verify', requireAuth, requireRole('ADMIN'), (req, res, next) => adminController.reviewNgo(req, res, next));
router.get('/admin/analytics', requireAuth, requireRole('ADMIN'), (req, res, next) => adminController.getAnalytics(req, res, next));

module.exports = router;
