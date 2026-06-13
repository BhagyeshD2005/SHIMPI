const admin = require('firebase-admin');
require('dotenv').config();

let app;

function initFirebase() {
  if (app) return app;

  if (admin.apps.length) {
    app = admin.app();
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase credentials are missing. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env'
    );
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    })
  });

  return app;
}

initFirebase();

const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

module.exports = {
  admin,
  db,
  Timestamp
};
