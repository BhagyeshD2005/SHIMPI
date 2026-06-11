const admin = require('firebase-admin');

let app;
function initFirebase() {
  if (app) return app;
  if (admin.apps.length) {
    app = admin.app();
    return app;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase credentials are missing. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.');
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

module.exports = { admin, db, Timestamp };
