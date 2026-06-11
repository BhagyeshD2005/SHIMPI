const { db, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function createId(prefix) {
  return `${prefix}_${uuidv4().split('-')[0]}`;
}

async function getDocData(collection, id) {
  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

module.exports = { formatCurrency, createId, getDocData, Timestamp };
