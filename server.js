require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const methodOverride = require('method-override');

const { db, Timestamp } = require('./config/firebase');
const { ensureBootstrap } = require('./scripts/bootstrap');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { formatCurrency, createId, getDocData } = require('./utils/helpers');

const app = express();

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'shimpi-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flashSuccess = req.flash('success');
  res.locals.flashError = req.flash('error');
  res.locals.formatCurrency = formatCurrency;
  next();
});

app.use(express.static('public'));

app.get('/', async (req, res) => {
  const productsSnap = await db.collection('products').where('active', '==', true).limit(6).get();
  const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.render('home', { title: 'SHIMPI | Tradition Meets Modern Fashion', products });
});

app.get('/shop', async (req, res) => {
  const snap = await db.collection('products').where('active', '==', true).get();
  const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.render('shop', { title: 'Shop | SHIMPI', products });
});

app.get('/product/:id', requireAuth, async (req, res) => {
  const product = await getDocData('products', req.params.id);
  if (!product) return res.status(404).render('not-found', { title: 'Not Found' });
  const measurementsSnap = await db.collection('measurements').where('userId', '==', req.session.user.uid).get();
  const measurements = measurementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.render('product', { title: product.name, product, measurements });
});

app.get('/register', (req, res) => res.render('register', { title: 'Register | SHIMPI' }));
app.get('/login', (req, res) => res.render('login', { title: 'Login | SHIMPI' }));

app.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) {
      req.flash('error', 'Name, email, and password are required.');
      return res.redirect('/register');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (!existing.empty) {
      req.flash('error', 'An account with this email already exists.');
      return res.redirect('/register');
    }
    const bcrypt = require('bcryptjs');
    const userId = createId('usr');
    const user = {
      uid: userId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : '',
      passwordHash: await bcrypt.hash(password, 10),
      role: role === 'admin' ? 'admin' : 'customer',
      address: '',
      createdAt: Timestamp.now()
    };
    await db.collection('users').doc(userId).set(user);
    req.session.user = { uid: userId, name: user.name, email: user.email, role: user.role };
    req.flash('success', 'Welcome to SHIMPI!');
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Registration failed.');
    res.redirect('/register');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const snap = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (snap.empty) {
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/login');
    }
    const userDoc = snap.docs[0];
    const user = userDoc.data();
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/login');
    }
    req.session.user = { uid: user.uid, name: user.name, email: user.email, role: user.role };
    req.flash('success', 'Login successful.');
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Login failed.');
    res.redirect('/login');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const userId = req.session.user.uid;
  const isAdmin = req.session.user.role === 'admin';

  const [measurementsSnap, ordersSnap, appointmentsSnap, productsSnap, usersSnap] = await Promise.all([
    db.collection('measurements').where('userId', '==', userId).get(),
    isAdmin ? db.collection('orders').get() : db.collection('orders').where('userId', '==', userId).get(),
    isAdmin ? db.collection('appointments').get() : db.collection('appointments').where('userId', '==', userId).get(),
    db.collection('products').get(),
    db.collection('users').get()
  ]);

  const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const recentOrders = orders.slice(0, 5);
  const measurements = measurementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const appointments = appointmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const stats = {
    orders: orders.length,
    measurements: measurements.length,
    appointments: appointments.length,
    products: products.length,
    customers: usersSnap.docs.filter(d => (d.data().role || 'customer') === 'customer').length
  };

  res.render('dashboard', { title: 'Dashboard | SHIMPI', stats, recentOrders, measurements, appointments, isAdmin });
});

app.get('/measurements', requireAuth, async (req, res) => {
  const snap = await db.collection('measurements').where('userId', '==', req.session.user.uid).get();
  const measurements = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  res.render('measurements', { title: 'Measurements | SHIMPI', measurements });
});

app.post('/measurements', requireAuth, async (req, res) => {
  try {
    const id = createId('msr');
    const payload = {
      measurementId: id,
      userId: req.session.user.uid,
      profileName: req.body.profileName || 'Self',
      gender: req.body.gender || '',
      neck: Number(req.body.neck || 0),
      chest: Number(req.body.chest || 0),
      waist: Number(req.body.waist || 0),
      hip: Number(req.body.hip || 0),
      shoulder: Number(req.body.shoulder || 0),
      sleeveLength: Number(req.body.sleeveLength || 0),
      shirtLength: Number(req.body.shirtLength || 0),
      inseam: Number(req.body.inseam || 0),
      thigh: Number(req.body.thigh || 0),
      calf: Number(req.body.calf || 0),
      notes: req.body.notes || '',
      createdAt: Timestamp.now()
    };
    await db.collection('measurements').doc(id).set(payload);
    req.flash('success', 'Measurement profile saved.');
    res.redirect('/measurements');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Unable to save measurement.');
    res.redirect('/measurements');
  }
});

app.post('/measurements/:id/delete', requireAuth, async (req, res) => {
  const doc = await db.collection('measurements').doc(req.params.id).get();
  if (doc.exists && doc.data().userId === req.session.user.uid) {
    await db.collection('measurements').doc(req.params.id).delete();
    req.flash('success', 'Measurement profile deleted.');
  } else {
    req.flash('error', 'Measurement not found.');
  }
  res.redirect('/measurements');
});

app.get('/orders', requireAuth, async (req, res) => {
  const isAdmin = req.session.user.role === 'admin';
  const snap = isAdmin
    ? await db.collection('orders').get()
    : await db.collection('orders').where('userId', '==', req.session.user.uid).get();
  const orders = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const measurementSnap = await db.collection('measurements').where('userId', '==', req.session.user.uid).get();
  const measurements = measurementSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.render('orders', { title: 'Orders | SHIMPI', orders, measurements });
});

app.post('/orders', requireAuth, async (req, res) => {
  try {
    const id = createId('ord');
    const productDoc = await getDocData('products', req.body.productId);
    const measurementDoc = await getDocData('measurements', req.body.measurementId);
    if (!productDoc || !measurementDoc) {
      req.flash('error', 'Please select a valid product and measurement profile.');
      return res.redirect('/shop');
    }
    const base = Number(productDoc.basePrice || 0);
    const customizationPrice = Number(req.body.customizationPrice || 0);
    const amount = base + customizationPrice;
    const order = {
      orderId: id,
      userId: req.session.user.uid,
      productId: req.body.productId,
      measurementId: req.body.measurementId,
      productName: productDoc.name,
      measurementName: measurementDoc.profileName,
      customization: {
        fabric: req.body.fabric || '',
        color: req.body.color || '',
        collar: req.body.collar || '',
        sleeve: req.body.sleeve || '',
        embroidery: req.body.embroidery || '',
        monogram: req.body.monogram || ''
      },
      shippingAddress: {
        line1: req.body.addressLine1 || '',
        line2: req.body.addressLine2 || '',
        city: req.body.city || '',
        state: req.body.state || '',
        pincode: req.body.pincode || ''
      },
      amount,
      paymentStatus: 'Pending',
      orderStatus: 'Confirmed',
      timeline: [
        { status: 'Confirmed', at: Timestamp.now() }
      ],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    await db.collection('orders').doc(id).set(order);
    req.flash('success', 'Order placed successfully.');
    res.redirect('/orders');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Unable to create order.');
    res.redirect('/shop');
  }
});

app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await getDocData('orders', req.params.id);
  if (!order) return res.status(404).render('not-found', { title: 'Not Found' });
  if (req.session.user.role !== 'admin' && order.userId !== req.session.user.uid) {
    req.flash('error', 'Access denied.');
    return res.redirect('/orders');
  }
  res.render('order-detail', { title: 'Order Tracking | SHIMPI', order });
});

app.post('/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const status = req.body.orderStatus || 'Confirmed';
  await db.collection('orders').doc(req.params.id).set({
    orderStatus: status,
    updatedAt: Timestamp.now()
  }, { merge: true });
  req.flash('success', 'Order status updated.');
  res.redirect('/admin/orders');
});

app.get('/appointments', requireAuth, async (req, res) => {
  const isAdmin = req.session.user.role === 'admin';
  const snap = isAdmin
    ? await db.collection('appointments').get()
    : await db.collection('appointments').where('userId', '==', req.session.user.uid).get();
  const appointments = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  res.render('appointments', { title: 'Appointments | SHIMPI', appointments });
});

app.post('/appointments', requireAuth, async (req, res) => {
  try {
    const id = createId('apt');
    const appointment = {
      appointmentId: id,
      userId: req.session.user.uid,
      type: req.body.type || 'Home Measurement Visit',
      date: req.body.date || '',
      time: req.body.time || '',
      address: req.body.address || '',
      notes: req.body.notes || '',
      status: 'Pending',
      createdAt: Timestamp.now()
    };
    await db.collection('appointments').doc(id).set(appointment);
    req.flash('success', 'Appointment booked.');
    res.redirect('/appointments');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Unable to book appointment.');
    res.redirect('/appointments');
  }
});

app.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  const [usersSnap, productsSnap, ordersSnap, appointmentsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('products').get(),
    db.collection('orders').get(),
    db.collection('appointments').get()
  ]);
  const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const appointments = appointmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.render('admin/index', {
    title: 'Admin Dashboard | SHIMPI',
    users,
    products,
    orders,
    appointments
  });
});

app.get('/admin/products', requireAuth, requireAdmin, async (req, res) => {
  const snap = await db.collection('products').get();
  const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  res.render('admin/products', { title: 'Admin Products | SHIMPI', products });
});

app.post('/admin/products', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = createId('prd');
    const product = {
      productId: id,
      name: req.body.name,
      category: req.body.category,
      style: req.body.style,
      basePrice: Number(req.body.basePrice || 0),
      description: req.body.description || '',
      images: (req.body.images || '').split(',').map(s => s.trim()).filter(Boolean),
      fabricOptions: (req.body.fabricOptions || '').split(',').map(s => s.trim()).filter(Boolean),
      customizationOptions: (req.body.customizationOptions || '').split(',').map(s => s.trim()).filter(Boolean),
      active: req.body.active === 'on',
      createdAt: Timestamp.now()
    };
    await db.collection('products').doc(id).set(product);
    req.flash('success', 'Product added.');
    res.redirect('/admin/products');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Unable to add product.');
    res.redirect('/admin/products');
  }
});

app.post('/admin/products/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
  const doc = await db.collection('products').doc(req.params.id).get();
  if (doc.exists) {
    await db.collection('products').doc(req.params.id).set({
      active: !doc.data().active
    }, { merge: true });
    req.flash('success', 'Product updated.');
  }
  res.redirect('/admin/products');
});

app.get('/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  const snap = await db.collection('orders').get();
  const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  res.render('admin/orders', { title: 'Admin Orders | SHIMPI', orders });
});

app.get('/admin/customers', requireAuth, requireAdmin, async (req, res) => {
  const snap = await db.collection('users').get();
  const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  res.render('admin/customers', { title: 'Admin Customers | SHIMPI', users });
});

app.post('/admin/bootstrap', requireAuth, requireAdmin, async (req, res) => {
  await ensureBootstrap(true);
  req.flash('success', 'Bootstrap data refreshed.');
  res.redirect('/admin');
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => {
  res.status(404).render('not-found', { title: 'Not Found' });
});

const port = process.env.PORT || 3000;
ensureBootstrap(false)
  .then(() => app.listen(port, () => console.log(`SHIMPI running on http://localhost:${port}`)))
  .catch((err) => {
    console.error('Bootstrap failed', err);
    process.exit(1);
  });
