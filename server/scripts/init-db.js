const { sequelize, User, Order, Quote, ChatMessage, File, PricingFactor } = require('../models');
require('dotenv').config();

const initDatabase = async () => {
  try {
    console.log('🔄 Initializing database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync all models
    await sequelize.sync({ force: true });
    console.log('✅ Database synchronized successfully.');

    // Create default admin user
    const adminUser = await User.create({
      email: process.env.ADMIN_EMAIL || 'admin@paradigmlab.com',
      password: process.env.ADMIN_PASSWORD || 'admin123456',
      firstName: 'Paradigm',
      lastName: 'Laboratory',
      role: 'admin',
      isActive: true,
      isVerified: true,
      preferredLanguage: 'fr'
    });
    console.log('✅ Admin user created:', adminUser.email);

    // Create sample dentist
    const dentist = await User.create({
      email: 'dentist@example.com',
      password: 'password123',
      firstName: 'Dr. Jean',
      lastName: 'Martin',
      role: 'dentist',
      phone: '+33123456789',
      address: '123 Rue de la Dent',
      city: 'Paris',
      country: 'France',
      postalCode: '75001',
      practiceName: 'Cabinet Dentaire Martin',
      licenseNumber: 'DENT123456',
      isActive: true,
      isVerified: true,
      preferredLanguage: 'fr'
    });
    console.log('✅ Sample dentist created:', dentist.email);

    // Create sample supplier
    const supplier = await User.create({
      email: 'supplier@example.com',
      password: 'password123',
      firstName: 'Pierre',
      lastName: 'Dubois',
      role: 'supplier',
      phone: '+33987654321',
      address: '456 Avenue de la Prothèse',
      city: 'Lyon',
      country: 'France',
      postalCode: '69001',
      companyName: 'Prothèses Dubois SARL',
      businessRegistration: 'SIRET123456789',
      isActive: true,
      isVerified: true,
      preferredLanguage: 'fr'
    });
    console.log('✅ Sample supplier created:', supplier.email);

    // Create default pricing factors
    const defaultPricingFactor = await PricingFactor.create({
      name: 'Default Pricing Factor',
      factor: parseFloat(process.env.DEFAULT_PRICING_FACTOR) || 1.5,
      description: 'Default pricing factor for all orders',
      isDefault: true,
      isActive: true,
      createdBy: adminUser.id
    });
    console.log('✅ Default pricing factor created');

    // Create category-specific pricing factors
    const crownFactor = await PricingFactor.create({
      name: 'Crown Pricing Factor',
      factor: 1.6,
      description: 'Pricing factor for crown prostheses',
      category: 'crown',
      isActive: true,
      createdBy: adminUser.id
    });

    const bridgeFactor = await PricingFactor.create({
      name: 'Bridge Pricing Factor',
      factor: 1.7,
      description: 'Pricing factor for bridge prostheses',
      category: 'bridge',
      isActive: true,
      createdBy: adminUser.id
    });

    const implantFactor = await PricingFactor.create({
      name: 'Implant Pricing Factor',
      factor: 2.0,
      description: 'Pricing factor for implant prostheses',
      category: 'implant',
      isActive: true,
      createdBy: adminUser.id
    });

    console.log('✅ Category-specific pricing factors created');

    // Create sample order
    const sampleOrder = await Order.create({
      dentistId: dentist.id,
      supplierId: supplier.id,
      title: 'Couronne céramique - Incisive centrale',
      description: 'Couronne en céramique pour incisive centrale supérieure droite',
      patientName: 'Marie Dupont',
      patientAge: 45,
      patientGender: 'female',
      toothNumbers: [11],
      prosthesisType: 'crown',
      material: 'ceramic',
      color: 'A2',
      urgency: 'medium',
      expectedDelivery: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: 'Patient allergique au nickel'
    });
    console.log('✅ Sample order created:', sampleOrder.orderNumber);

    // Create sample quote
    const sampleQuote = await Quote.create({
      orderId: sampleOrder.id,
      supplierId: supplier.id,
      basePrice: 150.00,
      materialCost: 80.00,
      laborCost: 50.00,
      shippingCost: 10.00,
      taxAmount: 30.00,
      productionTime: 10,
      shippingTime: 3,
      notes: 'Livraison express incluse',
      specifications: {
        material: 'Zirconia',
        color: 'A2',
        finish: 'Glazed'
      }
    });
    console.log('✅ Sample quote created');

    // Create sample chat message
    const sampleMessage = await ChatMessage.create({
      orderId: sampleOrder.id,
      userId: dentist.id,
      message: 'Bonjour, j\'aimerais confirmer la couleur A2 pour cette couronne.',
      originalLanguage: 'fr',
      messageType: 'text'
    });
    console.log('✅ Sample chat message created');

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📋 Sample accounts created:');
    console.log(`   Admin: ${adminUser.email} / ${process.env.ADMIN_PASSWORD || 'admin123456'}`);
    console.log(`   Dentist: ${dentist.email} / password123`);
    console.log(`   Supplier: ${supplier.email} / password123`);
    console.log('\n🚀 You can now start the server with: npm run server');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

// Run initialization
initDatabase().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Initialization error:', error);
  process.exit(1);
});