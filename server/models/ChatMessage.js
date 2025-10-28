const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  originalLanguage: {
    type: DataTypes.ENUM('fr', 'en', 'zh'),
    allowNull: false
  },
  // Translation fields
  translatedMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  targetLanguage: {
    type: DataTypes.ENUM('fr', 'en', 'zh'),
    allowNull: true
  },
  // Message type
  messageType: {
    type: DataTypes.ENUM('text', 'file', 'image', 'quote_update', 'status_change'),
    defaultValue: 'text'
  },
  // File attachments
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  fileType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Message status
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // System messages
  isSystemMessage: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  systemAction: {
    type: DataTypes.ENUM(
      'order_created',
      'quote_sent',
      'quote_accepted',
      'quote_rejected',
      'status_changed',
      'file_uploaded',
      'user_joined',
      'user_left'
    ),
    allowNull: true
  },
  // Translation status
  translationStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  translationError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Reply to another message
  replyToId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'chat_messages',
      key: 'id'
    }
  },
  // Message metadata
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: 'chat_messages',
  timestamps: true,
  indexes: [
    {
      fields: ['orderId', 'createdAt']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['translationStatus']
    }
  ]
});

// Mark message as read
ChatMessage.prototype.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Get display message (original or translated)
ChatMessage.prototype.getDisplayMessage = function(userLanguage) {
  if (this.originalLanguage === userLanguage) {
    return this.message;
  }
  return this.translatedMessage || this.message;
};

module.exports = ChatMessage;