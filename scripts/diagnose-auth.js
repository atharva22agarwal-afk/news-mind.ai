require('dotenv').config();
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

async function diagnose() {
    console.log('--- Firebase Auth Diagnostics ---');
    console.log('Node Version:', process.version);
    
    const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!envVar) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
        return;
    }

    let serviceAccount;
    try {
        if (envVar.trim().startsWith('{')) {
            serviceAccount = JSON.parse(envVar);
            console.log('✅ Found raw JSON in environment variable.');
        } else {
            serviceAccount = JSON.parse(Buffer.from(envVar, 'base64').toString('utf8'));
            console.log('✅ Found Base64 JSON in environment variable.');
        }
    } catch (e) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
        return;
    }

    console.log('Project ID:', serviceAccount.project_id);
    console.log('Client Email:', serviceAccount.client_email);
    console.log('Private Key Start:', serviceAccount.private_key?.substring(0, 30));
    console.log('Private Key End:', serviceAccount.private_key?.substring(serviceAccount.private_key.length - 30));

    // Test 1: Manual Signing using google-auth-library
    console.log('\n--- Test 1: Manual Signing (google-auth-library) ---');
    try {
        const auth = new GoogleAuth({
            credentials: {
                client_email: serviceAccount.client_email,
                private_key: serviceAccount.private_key,
                project_id: serviceAccount.project_id
            },
            scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore']
        });

        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        console.log('✅ Success! Obtained Access Token.');
        console.log('Token Start:', tokenResponse.token.substring(0, 20) + '...');
    } catch (error) {
        console.error('❌ Test 1 Failed:', error.message);
        if (error.stack) console.error(error.stack);
    }

    // Test 2: File-based ADC simulation
    console.log('\n--- Test 2: File-based ADC simulation ---');
    const tempPath = path.join(process.cwd(), '.diag-key.json');
    try {
        fs.writeFileSync(tempPath, JSON.stringify(serviceAccount));
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tempPath;
        
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        await client.getAccessToken();
        console.log('✅ Success! ADC (via file) worked.');
    } catch (error) {
        console.error('❌ Test 2 Failed:', error.message);
    } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
}

diagnose();
