const path = require('path');
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'foodshare-ai-default-dev-secret-key-change-in-prod',
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@foodshare.org',
    password: process.env.ADMIN_PASSWORD || 'AdminSecurePass123!',
    name: process.env.ADMIN_NAME || 'Platform Administrator'
  },
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/foodshare.db')
};
