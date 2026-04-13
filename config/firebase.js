const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let db, auth;

/**
 * Robustly sanitizes a private key for Google Cloud authentication
 */
function sanitizeKey(key) {
    if (!key) return key;
    return key
        .replace(/\\n/g, '\n')      // Convert literal \n to actual newlines
        .replace(/\r/g, '')         // Remove carriage returns (Windows artifact)
        .trim();                    // Remove accidental leading/trailing spaces
}

try {
    if (!admin.apps.length) {
        let credential;
        let serviceAccountData;

        // Priority 1: FIREBASE_SERVICE_ACCOUNT (JSON or Base64)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                const rawValue = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
                let jsonString = rawValue;

                if (!rawValue.startsWith('{')) {
                    // Try Base64 decoding
                    jsonString = Buffer.from(rawValue, 'base64').toString('utf8');
                    console.log('🔥 Firebase Admin: Decoded Base64 credentials');
                }

                serviceAccountData = JSON.parse(jsonString);
                serviceAccountData.private_key = sanitizeKey(serviceAccountData.private_key);
                
                // Write to temp file for ADC fallback compatibility
                const tempKeyPath = path.join(process.cwd(), '.temp-firebase-key.json');
                fs.writeFileSync(tempKeyPath, JSON.stringify(serviceAccountData));
                process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
                
                credential = admin.credential.cert(serviceAccountData);
                console.log('🔥 Firebase Admin: Successfully loaded credentials from Environment');
            } catch (err) {
                console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT:', err.message);
            }
        }

        // Priority 2: Local Service Account File
        if (!credential) {
            const localKeyPath = path.join(process.cwd(), 'firebase-key.json');
            if (fs.existsSync(localKeyPath)) {
                serviceAccountData = require(localKeyPath);
                serviceAccountData.private_key = sanitizeKey(serviceAccountData.private_key);
                credential = admin.credential.cert(serviceAccountData);
                console.log('🔥 Firebase Admin: Using local key file');
            }
        }

        // Initialize Admin SDK
        if (credential) {
            admin.initializeApp({
                credential,
                projectId: serviceAccountData.project_id
            });
            console.log('🔥 Firebase Admin: Initialized for project', serviceAccountData.project_id);
        } else {
            console.log('🔥 Firebase Admin: No explicit credentials, attempting ADC...');
            admin.initializeApp();
        }
    }

    // Initialize Firestore & Auth
    db = admin.firestore();
    try {
        db.settings({ preferRest: true });
        console.log('🔥 Firestore: Configured to use REST protocol');
    } catch (e) {}
    
    auth = admin.auth();
} catch (error) {
    console.error('❌ Firebase Critical Initialization Error:', error.message);
}

module.exports = { admin, db, auth };
