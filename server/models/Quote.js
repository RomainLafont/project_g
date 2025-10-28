const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Quote = sequelize.define('Quote', {
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
  supplierId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'accepted', 'rejected', 'modified'),
    allowNull: false,
    defaultValue: 'draft'
  },
  // Pricing details
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  materialCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  laborCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  shippingCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  // Adjusted price for dentist (with admin margin)
  adjustedPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  pricingFactor: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 1.0
  },
  // Quote details
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  productionTime: {
    type: DataTypes.INTEGER, // in days
    allowNull: true
  },
  shippingTime: {
    type: DataTypes.INTEGER, // in days
    allowNull: true
  },
  // Additional information
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  specifications: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  // Revision tracking
  revisionNumber: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  parentQuoteId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'quotes',
      key: 'id'
    }
  },
  // Acceptance tracking
  acceptedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  acceptedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Rejection reason
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'quotes',
  timestamps: true
});

// Calculate total price before save
Quote.beforeSave(async (quote) => {
  if (quote.changed(['basePrice', 'materialCost', 'laborCost', 'shippingCost', 'taxAmount'])) {
    const basePrice = parseFloat(quote.basePrice) || 0;
    const materialCost = parseFloat(quote.materialCost) || 0;
    const laborCost = parseFloat(quote.laborCost) || 0;
    const shippingCost = parseFloat(quote.shippingCost) || 0;
    const taxAmount = parseFloat(quote.taxAmount) || 0;
    
    quote.totalPrice = basePrice + materialCost + laborCost + shippingCost + taxAmount;
  }
});

// Calculate adjusted price with pricing factor
Quote.beforeSave(async (quote) => {
  if (quote.changed(['totalPrice', 'pricingFactor'])) {
    const totalPrice = parseFloat(quote.totalPrice) || 0;
    const factor = parseFloat(quote.pricingFactor) || 1.0;
    quote.adjustedPrice = totalPrice * factor;
  }
});

module.exports = Quote;