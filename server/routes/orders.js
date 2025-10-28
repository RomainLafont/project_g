const express = require('express');
const { body, validationResult } = require('express-validator');
const { Order, User, Quote, File, ChatMessage } = require('../models');
const { authenticateToken, requireDentistOrAdmin, requireSupplierOrAdmin, canAccessOrder, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Create new order (dentist only)
router.post('/', authenticateToken, requireDentistOrAdmin, [
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim(),
  body('patientName').optional().trim(),
  body('patientAge').optional().isInt({ min: 0, max: 150 }),
  body('patientGender').optional().isIn(['male', 'female', 'other']),
  body('toothNumbers').optional().isArray(),
  body('prosthesisType').isIn(['crown', 'bridge', 'implant', 'denture', 'veneer', 'inlay', 'onlay', 'other']),
  body('material').isIn(['ceramic', 'porcelain', 'metal', 'zirconia', 'composite', 'acrylic', 'other']),
  body('color').optional().trim(),
  body('urgency').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('expectedDelivery').optional().isISO8601(),
  body('notes').optional().trim(),
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

    const orderData = {
      ...req.body,
      dentistId: req.user.role === 'admin' ? req.body.dentistId : req.user.id,
      status: 'quote_asked'
    };

    // Verify supplier exists and is active
    const supplier = await User.findByPk(req.body.supplierId);
    if (!supplier || supplier.role !== 'supplier' || !supplier.isActive) {
      return res.status(400).json({ message: 'Invalid supplier selected' });
    }

    const order = await Order.create(orderData);

    // Create initial chat message
    await ChatMessage.create({
      orderId: order.id,
      userId: req.user.id,
      message: `New order created: ${order.title}`,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType: 'system',
      systemAction: 'order_created',
      isSystemMessage: true
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: await Order.findByPk(order.id, {
        include: [
          { model: User, as: 'dentist', attributes: ['id', 'firstName', 'lastName', 'practiceName'] },
          { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
        ]
      })
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Get orders for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    
    let whereClause = {};
    
    if (req.user.role === 'dentist') {
      whereClause.dentistId = req.user.id;
    } else if (req.user.role === 'supplier') {
      whereClause.supplierId = req.user.id;
    }
    // Admin can see all orders

    if (status) whereClause.status = status;
    
    const includeOptions = [
      { model: User, as: 'dentist', attributes: ['id', 'firstName', 'lastName', 'practiceName'] },
      { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
    ];

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
      include: includeOptions,
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
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
});

// Get order by ID
router.get('/:id', authenticateToken, canAccessOrder, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
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
        },
        { 
          model: File, 
          as: 'files',
          include: [
            { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] }
          ],
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Failed to get order' });
  }
});

// Update order status (supplier or admin)
router.put('/:id/status', authenticateToken, requireSupplierOrAdmin, canAccessOrder, [
  body('status').isIn(['quote_asked', 'quote_sent', 'quote_validated', 'in_production', 'in_shipping', 'delivered', 'cancelled']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { status, notes, trackingNumber, shippingCompany } = req.body;
    const order = req.order;

    // Validate status transition
    const validTransitions = {
      'quote_asked': ['quote_sent', 'cancelled'],
      'quote_sent': ['quote_validated', 'cancelled'],
      'quote_validated': ['in_production', 'cancelled'],
      'in_production': ['in_shipping', 'cancelled'],
      'in_shipping': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${order.status} to ${status}` 
      });
    }

    const updateData = { status };
    if (notes) updateData.notes = notes;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (shippingCompany) updateData.shippingCompany = shippingCompany;

    // Set delivery dates
    if (status === 'in_production') {
      updateData.expectedDelivery = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
    } else if (status === 'delivered') {
      updateData.actualDelivery = new Date();
    }

    await order.update(updateData);

    // Create system message for status change
    await ChatMessage.create({
      orderId: order.id,
      userId: req.user.id,
      message: `Order status changed to: ${status}`,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType: 'system',
      systemAction: 'status_changed',
      isSystemMessage: true
    });

    res.json({
      message: 'Order status updated successfully',
      order: await Order.findByPk(order.id, {
        include: [
          { model: User, as: 'dentist' },
          { model: User, as: 'supplier' }
        ]
      })
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// Update order details (dentist or admin)
router.put('/:id', authenticateToken, requireDentistOrAdmin, canAccessOrder, [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim(),
  body('patientName').optional().trim(),
  body('patientAge').optional().isInt({ min: 0, max: 150 }),
  body('patientGender').optional().isIn(['male', 'female', 'other']),
  body('toothNumbers').optional().isArray(),
  body('prosthesisType').optional().isIn(['crown', 'bridge', 'implant', 'denture', 'veneer', 'inlay', 'onlay', 'other']),
  body('material').optional().isIn(['ceramic', 'porcelain', 'metal', 'zirconia', 'composite', 'acrylic', 'other']),
  body('color').optional().trim(),
  body('urgency').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('expectedDelivery').optional().isISO8601(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const order = req.order;

    // Only allow updates if order is not in production or beyond
    if (['in_production', 'in_shipping', 'delivered'].includes(order.status)) {
      return res.status(400).json({ 
        message: 'Cannot update order that is in production or beyond' 
      });
    }

    const allowedFields = [
      'title', 'description', 'patientName', 'patientAge', 'patientGender',
      'toothNumbers', 'prosthesisType', 'material', 'color', 'urgency',
      'expectedDelivery', 'notes'
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    await order.update(updateData);

    res.json({
      message: 'Order updated successfully',
      order: await Order.findByPk(order.id, {
        include: [
          { model: User, as: 'dentist' },
          { model: User, as: 'supplier' }
        ]
      })
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

// Get order statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    let whereClause = {};
    
    if (req.user.role === 'dentist') {
      whereClause.dentistId = req.user.id;
    } else if (req.user.role === 'supplier') {
      whereClause.supplierId = req.user.id;
    }

    const totalOrders = await Order.count({ where: whereClause });
    const ordersByStatus = await Order.findAll({
      where: whereClause,
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

    res.json({
      totalOrders,
      statusCounts,
      recentOrders: await Order.findAll({
        where: whereClause,
        include: [
          { model: User, as: 'dentist', attributes: ['firstName', 'lastName'] },
          { model: User, as: 'supplier', attributes: ['firstName', 'lastName'] }
        ],
        limit: 5,
        order: [['createdAt', 'DESC']]
      })
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ message: 'Failed to get order statistics' });
  }
});

module.exports = router;