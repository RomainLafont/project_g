const express = require('express');
const { body, validationResult } = require('express-validator');
const { Quote, Order, User, PricingFactor } = require('../models');
const { authenticateToken, requireSupplierOrAdmin, canAccessOrder, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Create quote (supplier only)
router.post('/', authenticateToken, requireSupplierOrAdmin, [
  body('orderId').isUUID(),
  body('basePrice').isDecimal(),
  body('materialCost').optional().isDecimal(),
  body('laborCost').optional().isDecimal(),
  body('shippingCost').optional().isDecimal(),
  body('taxAmount').optional().isDecimal(),
  body('productionTime').optional().isInt({ min: 1 }),
  body('shippingTime').optional().isInt({ min: 1 }),
  body('notes').optional().trim(),
  body('specifications').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { orderId, basePrice, materialCost, laborCost, shippingCost, taxAmount, productionTime, shippingTime, notes, specifications } = req.body;

    // Verify order exists and supplier has access
    const order = await Order.findByPk(orderId, {
      include: [
        { model: User, as: 'dentist' },
        { model: User, as: 'supplier' }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if supplier can create quote for this order
    if (req.user.role === 'supplier' && order.supplierId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this order' });
    }

    // Check if order is in correct status
    if (order.status !== 'quote_asked') {
      return res.status(400).json({ 
        message: 'Cannot create quote for order in this status' 
      });
    }

    // Get applicable pricing factor
    const pricingFactor = await PricingFactor.getApplicableFactor({
      supplierId: order.supplierId,
      category: order.prosthesisType,
      material: order.material,
      urgency: order.urgency,
      orderValue: parseFloat(basePrice)
    });

    const quoteData = {
      orderId,
      supplierId: order.supplierId,
      basePrice: parseFloat(basePrice),
      materialCost: materialCost ? parseFloat(materialCost) : 0,
      laborCost: laborCost ? parseFloat(laborCost) : 0,
      shippingCost: shippingCost ? parseFloat(shippingCost) : 0,
      taxAmount: taxAmount ? parseFloat(taxAmount) : 0,
      productionTime,
      shippingTime,
      notes,
      specifications: specifications || {},
      pricingFactor: pricingFactor ? pricingFactor.factor : 1.0,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };

    const quote = await Quote.create(quoteData);

    // Update order status
    await order.update({ status: 'quote_sent' });

    // Create system message
    const { ChatMessage } = require('../models');
    await ChatMessage.create({
      orderId: order.id,
      userId: req.user.id,
      message: `Quote sent for ${order.title}`,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType: 'system',
      systemAction: 'quote_sent',
      isSystemMessage: true
    });

    res.status(201).json({
      message: 'Quote created successfully',
      quote: await Quote.findByPk(quote.id, {
        include: [
          { model: Order, as: 'order', attributes: ['id', 'title', 'orderNumber'] },
          { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
        ]
      })
    });
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ message: 'Failed to create quote' });
  }
});

// Get quotes for order
router.get('/order/:orderId', authenticateToken, canAccessOrder, async (req, res) => {
  try {
    const quotes = await Quote.findAll({
      where: { orderId: req.params.orderId },
      include: [
        { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ quotes });
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ message: 'Failed to get quotes' });
  }
});

// Get quote by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.id, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist', attributes: ['id', 'firstName', 'lastName', 'practiceName'] },
            { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
          ]
        },
        { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
      ]
    });

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Check access permissions
    const order = quote.order;
    if (req.user.role === 'dentist' && order.dentistId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this quote' });
    }
    if (req.user.role === 'supplier' && order.supplierId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this quote' });
    }

    res.json({ quote });
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ message: 'Failed to get quote' });
  }
});

// Update quote (supplier only)
router.put('/:id', authenticateToken, requireSupplierOrAdmin, [
  body('basePrice').optional().isDecimal(),
  body('materialCost').optional().isDecimal(),
  body('laborCost').optional().isDecimal(),
  body('shippingCost').optional().isDecimal(),
  body('taxAmount').optional().isDecimal(),
  body('productionTime').optional().isInt({ min: 1 }),
  body('shippingTime').optional().isInt({ min: 1 }),
  body('notes').optional().trim(),
  body('specifications').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const quote = await Quote.findByPk(req.params.id, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist' },
            { model: User, as: 'supplier' }
          ]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Check if supplier can update this quote
    if (req.user.role === 'supplier' && quote.supplierId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this quote' });
    }

    // Only allow updates if quote is not accepted
    if (quote.status === 'accepted') {
      return res.status(400).json({ 
        message: 'Cannot update accepted quote' 
      });
    }

    const allowedFields = [
      'basePrice', 'materialCost', 'laborCost', 'shippingCost', 'taxAmount',
      'productionTime', 'shippingTime', 'notes', 'specifications'
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Increment revision number
    updateData.revisionNumber = quote.revisionNumber + 1;
    updateData.status = 'modified';

    await quote.update(updateData);

    // Create system message
    const { ChatMessage } = require('../models');
    await ChatMessage.create({
      orderId: quote.orderId,
      userId: req.user.id,
      message: `Quote updated (Revision ${updateData.revisionNumber})`,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType: 'system',
      systemAction: 'quote_update',
      isSystemMessage: true
    });

    res.json({
      message: 'Quote updated successfully',
      quote: await Quote.findByPk(quote.id, {
        include: [
          { model: Order, as: 'order', attributes: ['id', 'title', 'orderNumber'] },
          { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
        ]
      })
    });
  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ message: 'Failed to update quote' });
  }
});

// Accept quote (dentist only)
router.post('/:id/accept', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'dentist' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only dentists can accept quotes' });
    }

    const quote = await Quote.findByPk(req.params.id, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist' },
            { model: User, as: 'supplier' }
          ]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Check if dentist can accept this quote
    if (req.user.role === 'dentist' && quote.order.dentistId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this quote' });
    }

    if (quote.status !== 'sent' && quote.status !== 'modified') {
      return res.status(400).json({ 
        message: 'Only sent or modified quotes can be accepted' 
      });
    }

    // Update quote status
    await quote.update({
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedBy: req.user.id
    });

    // Update order status
    await quote.order.update({ 
      status: 'quote_validated',
      originalQuote: quote.totalPrice,
      adjustedQuote: quote.adjustedPrice,
      pricingFactor: quote.pricingFactor
    });

    // Create system message
    const { ChatMessage } = require('../models');
    await ChatMessage.create({
      orderId: quote.orderId,
      userId: req.user.id,
      message: `Quote accepted for ${quote.order.title}`,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType: 'system',
      systemAction: 'quote_accepted',
      isSystemMessage: true
    });

    res.json({
      message: 'Quote accepted successfully',
      quote: await Quote.findByPk(quote.id, {
        include: [
          { model: Order, as: 'order', attributes: ['id', 'title', 'orderNumber'] },
          { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
        ]
      })
    });
  } catch (error) {
    console.error('Accept quote error:', error);
    res.status(500).json({ message: 'Failed to accept quote' });
  }
});

// Reject quote (dentist only)
router.post('/:id/reject', authenticateToken, [
  body('rejectionReason').optional().trim()
], async (req, res) => {
  try {
    if (req.user.role !== 'dentist' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only dentists can reject quotes' });
    }

    const quote = await Quote.findByPk(req.params.id, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist' },
            { model: User, as: 'supplier' }
          ]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Check if dentist can reject this quote
    if (req.user.role === 'dentist' && quote.order.dentistId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this quote' });
    }

    if (quote.status !== 'sent' && quote.status !== 'modified') {
      return res.status(400).json({ 
        message: 'Only sent or modified quotes can be rejected' 
      });
    }

    // Update quote status
    await quote.update({
      status: 'rejected',
      rejectionReason: req.body.rejectionReason
    });

    // Reset order status
    await quote.order.update({ status: 'quote_asked' });

    // Create system message
    const { ChatMessage } = require('../models');
    await ChatMessage.create({
      orderId: quote.orderId,
      userId: req.user.id,
      message: `Quote rejected for ${quote.order.title}`,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType: 'system',
      systemAction: 'quote_rejected',
      isSystemMessage: true
    });

    res.json({
      message: 'Quote rejected successfully',
      quote: await Quote.findByPk(quote.id, {
        include: [
          { model: Order, as: 'order', attributes: ['id', 'title', 'orderNumber'] },
          { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] }
        ]
      })
    });
  } catch (error) {
    console.error('Reject quote error:', error);
    res.status(500).json({ message: 'Failed to reject quote' });
  }
});

// Get all quotes (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, supplierId, orderId, page = 1, limit = 10 } = req.query;
    
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
          attributes: ['id', 'title', 'orderNumber', 'status'],
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
    console.error('Get quotes error:', error);
    res.status(500).json({ message: 'Failed to get quotes' });
  }
});

module.exports = router;