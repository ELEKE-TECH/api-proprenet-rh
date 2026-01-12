module.exports = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiration: 3600, // 1 hour
  jwtRefreshExpiration: 86400, // 24 hours
};
