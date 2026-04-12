const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

let db, auth;

try {
    if (!admin.apps.length) {
        let credential;

        // Priority 1: JSON string from env var (Cloud Functions / production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                let serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                
                // Fix for copy-paste escaping issues with private_key
                if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
                    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
                }
                
                credential = admin.credential.cert(serviceAccount);
                console.log('🔥 Firebase Admin: Successfully parsed env var credentials');
                console.log('🔥 Project ID:', serviceAccount.project_id);
            } catch (jsonError) {
                console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT env var:', jsonError.message);
                throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON format');
            }
        }
        // Priority 2: File path (local development)
        else {
            const fs = require('fs');
            const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
                ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
                : path.join(__dirname, '..', 'firebase-key.json');
            
            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = require(serviceAccountPath);
                credential = admin.credential.cert(serviceAccount);
                console.log('🔥 Firebase Admin: Using key file');
            } else {
                console.log('🔥 Firebase Admin: No credentials provided, falling back to ADC');
                // No credentials set here, will fall back to default in the next step
            }
        }

        admin.initializeApp({ credential });
        console.log('🔥 Firebase Admin Initialized');
    }

    db = admin.firestore();
    auth = admin.auth();
} catch (error) {
    console.error('❌ Firebase Initialization Error:', error.message);
    // Attempt Application Default Credentials as last resort
    try {
        if (!admin.apps.length) {
            admin.initializeApp();
            console.log('🔥 Firebase Admin: Using Application Default Credentials');
        }
        db = admin.firestore();
        auth = admin.auth();
    } catch (fallbackError) {
        console.error('❌ Firebase ADC Fallback also failed:', fallbackError.message);
    }
}

module.exports = { admin, db, auth };
