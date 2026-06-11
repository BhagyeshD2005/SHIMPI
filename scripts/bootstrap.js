const { db, Timestamp } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const { createId } = require('../utils/helpers');

const SCHEMA_DOC = {
  users: {
    collection: 'users',
    fields: ['uid', 'name', 'email', 'phone', 'passwordHash', 'role', 'address', 'createdAt']
  },
  measurements: {
    collection: 'measurements',
    fields: ['measurementId', 'userId', 'profileName', 'gender', 'neck', 'chest', 'waist', 'hip', 'shoulder', 'sleeveLength', 'shirtLength', 'inseam', 'thigh', 'calf', 'notes', 'createdAt']
  },
  products: {
    collection: 'products',
    fields: ['productId', 'name', 'category', 'style', 'basePrice', 'description', 'images', 'fabricOptions', 'customizationOptions', 'active', 'createdAt']
  },
  orders: {
    collection: 'orders',
    fields: ['orderId', 'userId', 'productId', 'measurementId', 'productName', 'measurementName', 'customization', 'shippingAddress', 'amount', 'paymentStatus', 'orderStatus', 'timeline', 'createdAt', 'updatedAt']
  },
  appointments: {
    collection: 'appointments',
    fields: ['appointmentId', 'userId', 'type', 'date', 'time', 'address', 'notes', 'status', 'createdAt']
  }
};

const DEFAULT_PRODUCTS = [
  {
    productId: 'prd_formal_shirt',
    name: 'Royal Formal Shirt',
    category: 'Formal Wear',
    style: 'Contemporary Slim Fit',
    basePrice: 2499,
    description: 'Premium cotton shirt crafted for executive and office wear.',
    images: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=80'],
    fabricOptions: ['Egyptian Cotton', 'Oxford Cotton', 'Linen Blend'],
    customizationOptions: ['Collar', 'Cuff', 'Monogram', 'Contrast Button'],
    active: true
  },
  {
    productId: 'prd_kurta',
    name: 'Heritage Kurta',
    category: 'Ethnic Wear',
    style: 'Classic Traditional',
    basePrice: 1899,
    description: 'Elegant kurta blending traditional charm with premium stitching.',
    images: ['https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=1200&q=80'],
    fabricOptions: ['Khadi', 'Silk Blend', 'Cotton Silk'],
    customizationOptions: ['Neckline', 'Sleeve', 'Embroidery', 'Buttons'],
    active: true
  },
  {
    productId: 'prd_suit',
    name: 'Modern Tailored Suit',
    category: 'Modern Formal',
    style: 'Sharp Premium Fit',
    basePrice: 7999,
    description: 'Tailored suit for weddings, meetings, and special occasions.',
    images: ['https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80'],
    fabricOptions: ['Wool Blend', 'Tweed', 'Italian Fabric'],
    customizationOptions: ['Lapels', 'Buttons', 'Lining', 'Monogram'],
    active: true
  },
  {
    productId: 'prd_saree_blouse',
    name: 'Designer Saree Blouse',
    category: 'Women’s Couture',
    style: 'Elegant Custom Fit',
    basePrice: 2199,
    description: 'Modern blouse tailoring with traditional elegance.',
    images: ['https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80'],
    fabricOptions: ['Silk', 'Brocade', 'Velvet'],
    customizationOptions: ['Sleeves', 'Neckline', 'Back Design', 'Embroidery'],
    active: true
  }
];

async function ensureBootstrap(force = false) {
  const stateRef = db.collection('site_config').doc('bootstrap');
  const stateSnap = await stateRef.get();
  if (stateSnap.exists && !force) return;

  await db.collection('site_config').doc('schema').set({
    updatedAt: Timestamp.now(),
    collections: SCHEMA_DOC
  }, { merge: true });

  for (const product of DEFAULT_PRODUCTS) {
    await db.collection('products').doc(product.productId).set({
      ...product,
      createdAt: Timestamp.now()
    }, { merge: true });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@shimpi.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const existingAdmin = await db.collection('users').where('email', '==', adminEmail).limit(1).get();
  if (existingAdmin.empty) {
    const adminId = createId('usr');
    await db.collection('users').doc(adminId).set({
      uid: adminId,
      name: 'SHIMPI Admin',
      email: adminEmail,
      phone: '',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'admin',
      address: '',
      createdAt: Timestamp.now()
    });
  }

  await stateRef.set({
    updatedAt: Timestamp.now(),
    seeded: true
  }, { merge: true });
}

module.exports = { ensureBootstrap };
