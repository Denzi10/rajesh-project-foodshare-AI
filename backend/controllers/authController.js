const authService = require('../services/authService');

class AuthController {
  async register(req, res, next) {
    try {
      const { name, email, password, role, ngoData } = req.body;
      const user = await authService.register({ name, email, password, role, ngoData });

      // Automatically establish session upon registration
      req.session.userId = user.id;

      res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await authService.login(email, password);

      req.session.userId = user.id;

      res.json({
        success: true,
        message: 'Logged in successfully',
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      req.session.destroy((err) => {
        if (err) {
          return next(err);
        }
        res.clearCookie('connect.sid');
        res.json({
          success: true,
          message: 'Logged out successfully'
        });
      });
    } catch (err) {
      next(err);
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      if (!req.user) {
        return res.json({
          success: true,
          data: null
        });
      }
      const userDto = await authService.getCurrentUser(req.user.id);
      res.json({
        success: true,
        data: userDto
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
