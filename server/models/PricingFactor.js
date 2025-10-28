const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PricingFactor = sequelize.define('PricingFactor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Supplier-specific pricing factor
  supplierId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Global default pricing factor
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Pricing factor value (e.g., 1.5 = 50% markup)
  factor: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    validate: {
      min: 1.0,
      max: 10.0
    }
  },
  // Factor name/description
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Validity period
  validFrom: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Category-based pricing
  category: {
    type: DataTypes.ENUM(
      'crown',
      'bridge',
      'implant',
      'denture',
      'veneer',
      'inlay',
      'onlay',
      'general'
    ),
    allowNull: true,
    defaultValue: 'general'
  },
  // Material-based pricing
  material: {
    type: DataTypes.ENUM(
      'ceramic',
      'porcelain',
      'metal',
      'zirconia',
      'composite',
      'acrylic',
      'general'
    ),
    allowNull: true,
    defaultValue: 'general'
  },
  // Urgency-based pricing
  urgency: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent', 'general'),
    allowNull: true,
    defaultValue: 'general'
  },
  // Minimum order value for this factor to apply
  minOrderValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  // Maximum order value for this factor to apply
  maxOrderValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  // Status
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Created by admin
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Additional metadata
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: 'pricing_factors',
  timestamps: true,
  indexes: [
    {
      fields: ['supplierId']
    },
    {
      fields: ['isDefault']
    },
    {
      fields: ['category']
    },
    {
      fields: ['material']
    },
    {
      fields: ['isActive']
    }
  ]
});

// Get applicable pricing factor for an order
PricingFactor.getApplicableFactor = async function(orderData) {
  const { supplierId, category, material, urgency, orderValue } = orderData;
  
  // First try to find supplier-specific factor
  let factor = await this.findOne({
    where: {
      supplierId,
      isActive: true,
      validFrom: { [sequelize.Op.lte]: new Date() },
      validUntil: { [sequelize.Op.or]: [null, { [sequelize.Op.gte]: new Date() }] },
      category: [category, 'general'],
      material: [material, 'general'],
      urgency: [urgency, 'general'],
      minOrderValue: { [sequelize.Op.or]: [null, { [sequelize.Op.lte]: orderValue }] },
      maxOrderValue: { [sequelize.Op.or]: [null, { [sequelize.Op.gte]: orderValue }] }
    },
    order: [
      ['category', 'DESC'], // Prefer specific category over general
      ['material', 'DESC'], // Prefer specific material over general
      ['urgency', 'DESC'], // Prefer specific urgency over general
      ['createdAt', 'DESC'] // Most recent if multiple matches
    ]
  });

  // If no supplier-specific factor found, use default
  if (!factor) {
    factor = await this.findOne({
      where: {
        isDefault: true,
        isActive: true,
        validFrom: { [sequelize.Op.lte]: new Date() },
        validUntil: { [sequelize.Op.or]: [null, { [sequelize.Op.gte]: new Date() }] },
        category: [category, 'general'],
        material: [material, 'general'],
        urgency: [urgency, 'general'],
        minOrderValue: { [sequelize.Op.or]: [null, { [sequelize.Op.lte]: orderValue }] },
        maxOrderValue: { [sequelize.Op.or]: [null, { [sequelize.Op.gte]: orderValue }] }
      },
      order: [
        ['category', 'DESC'],
        ['material', 'DESC'],
        ['urgency', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
  }

  return factor;
};

module.exports = PricingFactor;