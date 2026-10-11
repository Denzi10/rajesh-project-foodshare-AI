const userRepository = require('../repositories/userRepository');

async function attachUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await userRepository.findById(req.session.userId);
      if (user && user.enabled) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          enabled: Boolean(user.enabled)
        };
      } else {
        // Destroy session if user was disabled or removed
        req.session.destroy();
        req.user = null;
      }
    }
  } catch (err) {
    console.error('attachUser middleware error:', err);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to continue.'
    });
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${req.user.role}' is not authorized for this action.`
      });
    }

    next();
  };
}

module.exports = {
  attachUser,
  requireAuth,
  requireRole
};
