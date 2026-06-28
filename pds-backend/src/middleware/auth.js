const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    logger.warn('Invalid token attempt', { ip: req.ip });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    logger.warn('Forbidden role', { role: req.user?.role, path: req.path });
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
};

module.exports = { verifyToken, requireRole };
