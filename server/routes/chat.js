const express = require('express');
const { body, validationResult } = require('express-validator');
const { ChatMessage, Order, User } = require('../models');
const { authenticateToken, canAccessOrder } = require('../middleware/auth');

const router = express.Router();

// Get chat messages for an order
router.get('/order/:orderId', authenticateToken, canAccessOrder, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await ChatMessage.findAndCountAll({
      where: { orderId: req.params.orderId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'role', 'preferredLanguage'] }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'ASC']]
    });

    // Mark messages as read for current user
    await ChatMessage.update(
      { isRead: true, readAt: new Date() },
      { 
        where: { 
          orderId: req.params.orderId,
          userId: { [require('sequelize').Op.ne]: req.user.id },
          isRead: false
        }
      }
    );

    res.json({
      messages: messages.rows.map(message => ({
        ...message.toJSON(),
        displayMessage: message.getDisplayMessage(req.user.preferredLanguage || 'fr')
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: messages.count,
        pages: Math.ceil(messages.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ message: 'Failed to get chat messages' });
  }
});

// Send message
router.post('/order/:orderId', authenticateToken, canAccessOrder, [
  body('message').trim().isLength({ min: 1, max: 2000 }),
  body('messageType').optional().isIn(['text', 'file', 'image', 'quote_update', 'status_change']),
  body('fileUrl').optional().isURL(),
  body('fileName').optional().trim(),
  body('fileSize').optional().isInt({ min: 0 }),
  body('fileType').optional().isString(),
  body('replyToId').optional().isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { message, messageType = 'text', fileUrl, fileName, fileSize, fileType, replyToId } = req.body;
    const orderId = req.params.orderId;

    // Check if replying to existing message
    if (replyToId) {
      const replyToMessage = await ChatMessage.findByPk(replyToId);
      if (!replyToMessage || replyToMessage.orderId !== orderId) {
        return res.status(400).json({ message: 'Invalid reply message' });
      }
    }

    const messageData = {
      orderId,
      userId: req.user.id,
      message,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType,
      replyToId
    };

    // Add file information if provided
    if (fileUrl) {
      messageData.fileUrl = fileUrl;
      messageData.fileName = fileName;
      messageData.fileSize = fileSize;
      messageData.fileType = fileType;
    }

    const chatMessage = await ChatMessage.create(messageData);

    // TODO: Implement automatic translation service
    // For now, we'll just return the message without translation
    // In production, you would call a translation API here

    res.status(201).json({
      message: 'Message sent successfully',
      chatMessage: {
        ...chatMessage.toJSON(),
        displayMessage: chatMessage.getDisplayMessage(req.user.preferredLanguage || 'fr'),
        user: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
          preferredLanguage: req.user.preferredLanguage
        }
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// Mark messages as read
router.put('/order/:orderId/read', authenticateToken, canAccessOrder, async (req, res) => {
  try {
    await ChatMessage.update(
      { isRead: true, readAt: new Date() },
      { 
        where: { 
          orderId: req.params.orderId,
          userId: { [require('sequelize').Op.ne]: req.user.id },
          isRead: false
        }
      }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark messages read error:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
});

// Get unread message count for user
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    let whereClause = { isRead: false };
    
    if (req.user.role === 'dentist') {
      // Get unread messages from orders where user is dentist
      const dentistOrders = await Order.findAll({
        where: { dentistId: req.user.id },
        attributes: ['id']
      });
      whereClause.orderId = { [require('sequelize').Op.in]: dentistOrders.map(o => o.id) };
    } else if (req.user.role === 'supplier') {
      // Get unread messages from orders where user is supplier
      const supplierOrders = await Order.findAll({
        where: { supplierId: req.user.id },
        attributes: ['id']
      });
      whereClause.orderId = { [require('sequelize').Op.in]: supplierOrders.map(o => o.id) };
    }
    // Admin can see all unread messages

    whereClause.userId = { [require('sequelize').Op.ne]: req.user.id };

    const unreadCount = await ChatMessage.count({ where: whereClause });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

// Get recent conversations for user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    let whereClause = {};
    
    if (req.user.role === 'dentist') {
      whereClause.dentistId = req.user.id;
    } else if (req.user.role === 'supplier') {
      whereClause.supplierId = req.user.id;
    }

    const orders = await Order.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'dentist', attributes: ['id', 'firstName', 'lastName', 'practiceName'] },
        { model: User, as: 'supplier', attributes: ['id', 'firstName', 'lastName', 'companyName'] },
        {
          model: ChatMessage,
          as: 'messages',
          include: [
            { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName'] }
          ],
          limit: 1,
          order: [['createdAt', 'DESC']]
        }
      ],
      order: [['updatedAt', 'DESC']],
      limit: 20
    });

    const conversations = orders.map(order => {
      const lastMessage = order.messages[0];
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        title: order.title,
        status: order.status,
        dentist: order.dentist,
        supplier: order.supplier,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          message: lastMessage.getDisplayMessage(req.user.preferredLanguage || 'fr'),
          createdAt: lastMessage.createdAt,
          user: lastMessage.user,
          isRead: lastMessage.isRead
        } : null,
        updatedAt: order.updatedAt
      };
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Failed to get conversations' });
  }
});

// Delete message (only own messages)
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const message = await ChatMessage.findByPk(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.userId !== req.user.id) {
      return res.status(403).json({ message: 'Can only delete your own messages' });
    }

    // Don't allow deletion of system messages
    if (message.isSystemMessage) {
      return res.status(400).json({ message: 'Cannot delete system messages' });
    }

    await message.destroy();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

// Translation service endpoint (placeholder)
router.post('/translate', authenticateToken, [
  body('messageId').isUUID(),
  body('targetLanguage').isIn(['fr', 'en', 'zh'])
], async (req, res) => {
  try {
    const { messageId, targetLanguage } = req.body;
    
    const message = await ChatMessage.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // TODO: Implement actual translation service
    // For now, return the original message
    const translatedMessage = message.message; // In production, call translation API

    await message.update({
      translatedMessage,
      targetLanguage,
      translationStatus: 'completed'
    });

    res.json({
      message: 'Translation completed',
      translatedMessage,
      targetLanguage
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ message: 'Translation failed' });
  }
});

module.exports = router;