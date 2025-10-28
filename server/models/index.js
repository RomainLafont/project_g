const { sequelize } = require('../config/database');
const User = require('./User');
const Order = require('./Order');
const Quote = require('./Quote');
const ChatMessage = require('./ChatMessage');
const File = require('./File');
const PricingFactor = require('./PricingFactor');

// Define associations
const defineAssociations = () => {
  // User associations
  User.hasMany(Order, { foreignKey: 'dentistId', as: 'orders' });
  User.hasMany(Order, { foreignKey: 'supplierId', as: 'supplierOrders' });
  User.hasMany(ChatMessage, { foreignKey: 'userId', as: 'messages' });

  // Order associations
  Order.belongsTo(User, { foreignKey: 'dentistId', as: 'dentist' });
  Order.belongsTo(User, { foreignKey: 'supplierId', as: 'supplier' });
  Order.hasMany(Quote, { foreignKey: 'orderId', as: 'quotes' });
  Order.hasMany(ChatMessage, { foreignKey: 'orderId', as: 'messages' });
  Order.hasMany(File, { foreignKey: 'orderId', as: 'files' });

  // Quote associations
  Quote.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  Quote.belongsTo(User, { foreignKey: 'supplierId', as: 'supplier' });

  // ChatMessage associations
  ChatMessage.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  ChatMessage.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

  // File associations
  File.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  File.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
};

// Initialize associations
defineAssociations();

module.exports = {
  sequelize,
  User,
  Order,
  Quote,
  ChatMessage,
  File,
  PricingFactor
};