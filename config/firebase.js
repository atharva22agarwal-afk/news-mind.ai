const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
    ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.join(__dirname, '..', 'firebase-key.json');

let db, auth;

try {
    const serviceAccount = require(serviceAccountPath);
    
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('🔥 Firebase Admin Initialized');
    }
    
    db = admin.firestore();
    auth = admin.auth();
} catch (error) {
    console.error('❌ Firebase Initialization Error:', error.message);
}

module.exports = { admin, db, auth };
