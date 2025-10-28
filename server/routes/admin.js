const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Order, Quote, PricingFactor, ChatMessage, File } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

// Dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const dentists = await User.count({ where: { role: 'dentist', isActive: true } });
    const suppliers = await User.count({ where: { role: 'supplier', isActive: true } });

    // Get order statistics
    const totalOrders = await Order.count();
    const ordersByStatus = await Order.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status']
    });

    const statusCounts = {};
    ordersByStatus.forEach(item => {
      statusCounts[item.status] = parseInt(item.dataValues.count);
    });

    // Get quote statistics
    const totalQuotes = await Quote.count();
    const quotesByStatus = await Quote.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status']
    });

    const quoteStatusCounts = {};
    quotesByStatus.forEach(item => {
      quoteStatusCounts[item.status] = parseInt(item.dataValues.count);
    });

    // Get recent activity
    const recentOrders = await Order.findAll({
      include: [
        { model: User, as: 'dentist', attributes: ['firstName', 'lastName', 'practiceName'] },
        { model: User, as: 'supplier', attributes: ['firstName', 'lastName', 'companyName'] }
      ],
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    const recentQuotes = await Quote.findAll({
      include: [
        { 
          model: Order, 
          as: 'order',
          attributes: ['id', 'title', 'orderNumber'],
          include: [
            { model: User, as: 'dentist', attributes: ['firstName', 'lastName'] },
            { model: User, as: 'supplier', attributes: ['firstName', 'lastName'] }
          ]
        },
        { model: User, as: 'supplier', attributes: ['firstName', 'lastName', 'companyName'] }
      ],
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        dentists,
        suppliers
      },
      orders: {
        total: totalOrders,
        byStatus: statusCounts
      },
      quotes: {
        total: totalQuotes,
        byStatus: quoteStatusCounts
      },
      recentActivity: {
        orders: recentOrders,
        quotes: recentQuotes
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Failed to get dashboard data' });
  }
});

// Get all orders with full details
router.get('/orders', async (req, res) => {
  try {
    const { status, dentistId, supplierId, page = 1, limit = 20, search } = req.query;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (dentistId) whereClause.dentistId = dentistId;
    if (supplierId) whereClause.supplierId = supplierId;

    // Add search functionality
    if (search) {
      whereClause[require('sequelize').Op.or] = [
        { title: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { orderNumber: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { patientName: { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    const orders = await Order.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'dentist', attributes: ['id', 'firstName', 'lastName', 'practiceName', 'email', 'phone'] },
        { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName', 'email', 'phone'] },
        { 
          model: Quote, 
          as: 'quotes',
          include: [
            { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
          ],
          order: [['createdAt', 'DESC']]
        }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      orders: orders.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: orders.count,
        pages: Math.ceil(orders.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
});

// Get order details with all quotes
router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: [
        { model: User, as: 'dentist', attributes: ['id', 'firstName', 'lastName', 'practiceName', 'email', 'phone', 'address', 'city', 'country'] },
        { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName', 'email', 'phone', 'address', 'city', 'country'] },
        { 
          model: Quote, 
          as: 'quotes',
          include: [
            { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
          ],
          order: [['createdAt', 'DESC']]
        },
        { 
          model: File, 
          as: 'files',
          include: [
            { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] }
          ],
          order: [['createdAt', 'DESC']]
        },
        {
          model: ChatMessage,
          as: 'messages',
          include: [
            { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'role'] }
          ],
          limit: 10,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get admin order details error:', error);
    res.status(500).json({ message: 'Failed to get order details' });
  }
});

// Assign supplier to dentist
router.post('/assign-supplier', [
  body('dentistId').isUUID(),
  body('supplierId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { dentistId, supplierId } = req.body;

    // Verify users exist and have correct roles
    const dentist = await User.findByPk(dentistId);
    const supplier = await User.findByPk(supplierId);

    if (!dentist || dentist.role !== 'dentist' || !dentist.isActive) {
      return res.status(400).json({ message: 'Invalid dentist selected' });
    }

    if (!supplier || supplier.role !== 'supplier' || !supplier.isActive) {
      return res.status(400).json({ message: 'Invalid supplier selected' });
    }

    // TODO: Implement supplier-dentist assignment logic
    // This could be a separate table to track relationships
    // For now, we'll just return success

    res.json({
      message: 'Supplier assigned to dentist successfully',
      dentist: dentist.toJSON(),
      supplier: supplier.toJSON()
    });
  } catch (error) {
    console.error('Assign supplier error:', error);
    res.status(500).json({ message: 'Failed to assign supplier' });
  }
});

// Get all quotes with admin view
router.get('/quotes', async (req, res) => {
  try {
    const { status, supplierId, orderId, page = 1, limit = 20 } = req.query;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (supplierId) whereClause.supplierId = supplierId;
    if (orderId) whereClause.orderId = orderId;

    const quotes = await Quote.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: Order, 
          as: 'order',
          attributes: ['id', 'title', 'orderNumber', 'status', 'patientName', 'prosthesisType'],
          include: [
            { model: User, as: 'dentist', attributes: ['id', 'firstName', 'lastName', 'practiceName'] },
            { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
          ]
        },
        { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      quotes: quotes.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: quotes.count,
        pages: Math.ceil(quotes.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin quotes error:', error);
    res.status(500).json({ message: 'Failed to get quotes' });
  }
});

// Create pricing factor
router.post('/pricing-factors', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('factor').isDecimal({ min: 1.0, max: 10.0 }),
  body('description').optional().trim(),
  body('category').optional().isIn(['crown', 'bridge', 'implant', 'denture', 'veneer', 'inlay', 'onlay', 'general']),
  body('material').optional().isIn(['ceramic', 'porcelain', 'metal', 'zirconia', 'composite', 'acrylic', 'general']),
  body('urgency').optional().isIn(['low', 'medium', 'high', 'urgent', 'general']),
  body('supplierId').optional().isUUID(),
  body('isDefault').optional().isBoolean(),
  body('minOrderValue').optional().isDecimal({ min: 0 }),
  body('maxOrderValue').optional().isDecimal({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const pricingFactorData = {
      ...req.body,
      createdBy: req.user.id,
      factor: parseFloat(req.body.factor),
      minOrderValue: req.body.minOrderValue ? parseFloat(req.body.minOrderValue) : null,
      maxOrderValue: req.body.maxOrderValue ? parseFloat(req.body.maxOrderValue) : null
    };

    const pricingFactor = await PricingFactor.create(pricingFactorData);

    res.status(201).json({
      message: 'Pricing factor created successfully',
      pricingFactor
    });
  } catch (error) {
    console.error('Create pricing factor error:', error);
    res.status(500).json({ message: 'Failed to create pricing factor' });
  }
});

// Get pricing factors
router.get('/pricing-factors', async (req, res) => {
  try {
    const { supplierId, isActive, page = 1, limit = 20 } = req.query;
    
    const whereClause = {};
    if (supplierId) whereClause.supplierId = supplierId;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';

    const pricingFactors = await PricingFactor.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      pricingFactors: pricingFactors.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: pricingFactors.count,
        pages: Math.ceil(pricingFactors.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get pricing factors error:', error);
    res.status(500).json({ message: 'Failed to get pricing factors' });
  }
});

// Update pricing factor
router.put('/pricing-factors/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('factor').optional().isDecimal({ min: 1.0, max: 10.0 }),
  body('description').optional().trim(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const pricingFactor = await PricingFactor.findByPk(req.params.id);
    if (!pricingFactor) {
      return res.status(404).json({ message: 'Pricing factor not found' });
    }

    const updateData = {};
    const allowedFields = ['name', 'factor', 'description', 'isActive'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (updateData.factor) {
      updateData.factor = parseFloat(updateData.factor);
    }

    await pricingFactor.update(updateData);

    res.json({
      message: 'Pricing factor updated successfully',
      pricingFactor
    });
  } catch (error) {
    console.error('Update pricing factor error:', error);
    res.status(500).json({ message: 'Failed to update pricing factor' });
  }
});

// Delete pricing factor
router.delete('/pricing-factors/:id', async (req, res) => {
  try {
    const pricingFactor = await PricingFactor.findByPk(req.params.id);
    if (!pricingFactor) {
      return res.status(404).json({ message: 'Pricing factor not found' });
    }

    await pricingFactor.destroy();

    res.json({ message: 'Pricing factor deleted successfully' });
  } catch (error) {
    console.error('Delete pricing factor error:', error);
    res.status(500).json({ message: 'Failed to delete pricing factor' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7d':
        dateFilter = { [require('sequelize').Op.gte]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { [require('sequelize').Op.gte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { [require('sequelize').Op.gte]: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case '1y':
        dateFilter = { [require('sequelize').Op.gte]: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
        break;
    }

    // Orders created in period
    const ordersInPeriod = await Order.count({
      where: { createdAt: dateFilter }
    });

    // Quotes created in period
    const quotesInPeriod = await Quote.count({
      where: { createdAt: dateFilter }
    });

    // Revenue calculation (sum of accepted quotes)
    const revenueResult = await Quote.findOne({
      where: { 
        status: 'accepted',
        createdAt: dateFilter
      },
      attributes: [
        [require('sequelize').fn('SUM', require('sequelize').col('totalPrice')), 'totalRevenue']
      ]
    });

    const totalRevenue = revenueResult ? parseFloat(revenueResult.dataValues.totalRevenue) || 0 : 0;

    // Average order value
    const avgOrderValue = ordersInPeriod > 0 ? totalRevenue / ordersInPeriod : 0;

    res.json({
      period,
      orders: ordersInPeriod,
      quotes: quotesInPeriod,
      revenue: totalRevenue,
      averageOrderValue: avgOrderValue
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to get statistics' });
  }
});

module.exports = router;