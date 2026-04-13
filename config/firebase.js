const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

let db, auth;

try {
    if (!admin.apps.length) {
        let credential;

        if (credential === undefined) {
            // Priority 1: JSON string from env var (Cloud Functions / production)
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                try {
                    let rawValue = process.env.FIREBASE_SERVICE_ACCOUNT;
                    let serviceAccount;

                    // Try raw JSON first
                    try {
                        serviceAccount = JSON.parse(rawValue);
                    } catch (parseError) {
                        try {
                            const decoded = Buffer.from(rawValue, 'base64').toString('utf8');
                            serviceAccount = JSON.parse(decoded);
                            console.log('🔥 Firebase Admin: Decoded Base64 credentials');
                        } catch (b64Error) {
                            const fixed = rawValue.replace(/\n/g, '\\n');
                            serviceAccount = JSON.parse(fixed);
                        }
                    }
                    
                    // Normalize newlines in private key
                    if (serviceAccount.private_key) {
                        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
                    }
                    
                    // Write to disk to avoid any memory space encoding issues
                    const fs = require('fs');
                    const path = require('path');
                    const tempKeyPath = path.join(process.cwd(), '.temp-firebase-key.json');
                    fs.writeFileSync(tempKeyPath, JSON.stringify(serviceAccount));
                    
                    credential = admin.credential.cert(tempKeyPath);
                    console.log('🔥 Firebase Admin: Successfully loaded credentials from generated file');
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
        }

        if (credential) {
            const initOptions = { credential };
            
            // Explicitly pass projectId to prevent environment variable mixups
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                try {
                    const rawValue = process.env.FIREBASE_SERVICE_ACCOUNT;
                    let sa;
                    try { sa = JSON.parse(rawValue); } 
                    catch(e) { sa = JSON.parse(Buffer.from(rawValue, 'base64').toString('utf8')); }
                    if (sa && sa.project_id) initOptions.projectId = sa.project_id;
                } catch(e) {}
            }
            
            admin.initializeApp(initOptions);
            console.log('🔥 Firebase Admin Initialized with credentials');
        } else {
            console.log('⚠️ No credential object formed, attempting default initialization...');
            throw new Error('No credentials provided'); // Force jump to catch block for ADC fallback
        }
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
