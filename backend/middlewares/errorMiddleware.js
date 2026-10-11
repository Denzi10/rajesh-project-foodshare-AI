function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Security check: ensure passwords and internal secrets never leak in error response
  const sanitizedMessage = (err.message || 'An internal server error occurred')
    .replace(/password_hash[^\s]*/gi, '')
    .replace(/bcrypt[^\s]*/gi, '');

  console.error(`[Error] [${req.method}] ${req.originalUrl}:`, err.message);

  res.status(statusCode).json({
    success: false,
    error: sanitizedMessage,
    statusCode
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    statusCode: 404
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
