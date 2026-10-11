const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes/api');
const { attachUser } = require('./middlewares/authMiddleware');
const { errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with HttpOnly cookies (Page 4 Security requirements)
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'foodshare.sid',
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

// Attach authenticated user to request
app.use(attachUser);

// Static frontend resources (FR-Frontend separation)
app.use(express.static(path.join(__dirname, '../frontend')));

// Mount API routes
app.use('/api', apiRoutes);

// SPA fallback for HTML frontend
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
  next();
});

// Global error handler
app.use(errorHandler);

module.exports = app;
