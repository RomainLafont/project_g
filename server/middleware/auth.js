const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(500).json({ message: 'Authentication error' });
  }
};

// Check if user has specific role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${userRoles.join(' or ')}` 
      });
    }

    next();
  };
};

// Check if user is admin
const requireAdmin = requireRole('admin');

// Check if user is dentist or admin
const requireDentistOrAdmin = requireRole(['dentist', 'admin']);

// Check if user is supplier or admin
const requireSupplierOrAdmin = requireRole(['supplier', 'admin']);

// Check if user can access order (dentist, supplier, or admin)
const canAccessOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { Order } = require('../models');
    
    const order = await Order.findByPk(orderId, {
      include: [
        { model: User, as: 'dentist' },
        { model: User, as: 'supplier' }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Admin can access all orders
    if (req.user.role === 'admin') {
      req.order = order;
      return next();
    }

    // Dentist can access their own orders
    if (req.user.role === 'dentist' && order.dentistId === req.user.id) {
      req.order = order;
      return next();
    }

    // Supplier can access orders assigned to them
    if (req.user.role === 'supplier' && order.supplierId === req.user.id) {
      req.order = order;
      return next();
    }

    return res.status(403).json({ message: 'Access denied to this order' });
  } catch (error) {
    return res.status(500).json({ message: 'Error checking order access' });
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireDentistOrAdmin,
  requireSupplierOrAdmin,
  canAccessOrder,
  generateToken
};