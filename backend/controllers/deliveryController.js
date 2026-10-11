const deliveryService = require('../services/deliveryService');

class DeliveryController {
  async getAvailableTasks(req, res, next) {
    try {
      const tasks = await deliveryService.getAvailableTasks();
      res.json({
        success: true,
        data: tasks
      });
    } catch (err) {
      next(err);
    }
  }

  async getMyDeliveries(req, res, next) {
    try {
      const deliveries = await deliveryService.getVolunteerDeliveries(req.user.id);
      res.json({
        success: true,
        data: deliveries
      });
    } catch (err) {
      next(err);
    }
  }

  async acceptTask(req, res, next) {
    try {
      const claimId = parseInt(req.params.claimId, 10);
      const delivery = await deliveryService.acceptTask(claimId, req.user.id);
      res.status(201).json({
        success: true,
        message: 'Delivery pickup task accepted successfully',
        data: delivery
      });
    } catch (err) {
      next(err);
    }
  }

  async markPickedUp(req, res, next) {
    try {
      const deliveryId = parseInt(req.params.id, 10);
      const delivery = await deliveryService.markPickedUp(deliveryId, req.user.id);
      res.json({
        success: true,
        message: 'Status updated: Food has been marked as PICKED UP',
        data: delivery
      });
    } catch (err) {
      next(err);
    }
  }

  async markDelivered(req, res, next) {
    try {
      const deliveryId = parseInt(req.params.id, 10);
      const delivery = await deliveryService.markDelivered(deliveryId, req.user.id);
      res.json({
        success: true,
        message: 'Status updated: Food donation has been successfully DELIVERED',
        data: delivery
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DeliveryController();
