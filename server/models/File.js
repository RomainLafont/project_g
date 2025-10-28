const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const File = sequelize.define('File', {
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
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileType: {
    type: DataTypes.ENUM('stl', 'pdf', 'image', 'document', 'other'),
    allowNull: false
  },
  // File category
  category: {
    type: DataTypes.ENUM(
      'patient_scan',
      'dental_impression',
      'xray',
      'photo',
      'specification',
      'quote_document',
      'invoice',
      'other'
    ),
    allowNull: false
  },
  // File description
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Cloud storage information
  cloudProvider: {
    type: DataTypes.ENUM('cloudinary', 'aws', 'google', 'azure'),
    defaultValue: 'cloudinary'
  },
  cloudId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // File processing status
  processingStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  processingError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // File metadata
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  // Access control
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  accessToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Download tracking
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastDownloadedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'files',
  timestamps: true,
  indexes: [
    {
      fields: ['orderId']
    },
    {
      fields: ['uploadedBy']
    },
    {
      fields: ['fileType']
    },
    {
      fields: ['category']
    }
  ]
});

// Generate access token for private files
File.beforeCreate(async (file) => {
  if (!file.isPublic && !file.accessToken) {
    const crypto = require('crypto');
    file.accessToken = crypto.randomBytes(32).toString('hex');
  }
});

// Increment download count
File.prototype.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastDownloadedAt = new Date();
  return this.save();
};

// Check if file is accessible
File.prototype.isAccessible = function() {
  if (this.isPublic) return true;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

// Get file size in human readable format
File.prototype.getHumanReadableSize = function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.fileSize === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

module.exports = File;