const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  dentistId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
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
    type: DataTypes.ENUM(
      'quote_asked',
      'quote_sent',
      'quote_validated',
      'in_production',
      'in_shipping',
      'delivered',
      'cancelled'
    ),
    allowNull: false,
    defaultValue: 'quote_asked'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  patientInfo: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  // Patient information
  patientName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  patientAge: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  patientGender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    allowNull: true
  },
  // Dental information
  toothNumbers: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  prosthesisType: {
    type: DataTypes.ENUM(
      'crown',
      'bridge',
      'implant',
      'denture',
      'veneer',
      'inlay',
      'onlay',
      'other'
    ),
    allowNull: true
  },
  material: {
    type: DataTypes.ENUM(
      'ceramic',
      'porcelain',
      'metal',
      'zirconia',
      'composite',
      'acrylic',
      'other'
    ),
    allowNull: true
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Urgency
  urgency: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  // Delivery information
  expectedDelivery: {
    type: DataTypes.DATE,
    allowNull: true
  },
  actualDelivery: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Pricing information
  originalQuote: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  adjustedQuote: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  pricingFactor: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 1.0
  },
  // Additional notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Tracking information
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  shippingCompany: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'orders',
  timestamps: true
});

// Generate order number
Order.beforeCreate(async (order) => {
  if (!order.orderNumber) {
    const count = await Order.count();
    order.orderNumber = `ORD-${String(count + 1).padStart(6, '0')}`;
  }
});

module.exports = Order;