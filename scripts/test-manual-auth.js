require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');

async function testManualToken() {
    console.log('--- Manual JWT Exchange Test ---');
    const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!envVar) return console.log('No env var');

    let sa;
    try {
        const raw = envVar.trim();
        const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        sa = JSON.parse(json);
        // Robust sanitize
        sa.private_key = sa.private_key.replace(/\\n/g, '\n').replace(/\r/g, '').trim();
    } catch (e) { return console.log('Parse fail:', e.message); }

    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: sa.client_email,
        sub: sa.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore'
    };

    const sHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const sPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const unsignedToken = `${sHeader}.${sPayload}`;

    try {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsignedToken);
        const signature = signer.sign(sa.private_key, 'base64url');
        const jwt = `${unsignedToken}.${signature}`;

        console.log('JWT Generated. Requesting token...');
        const params = new URLSearchParams();
        params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
        params.append('assertion', jwt);

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await res.json();
        if (data.access_token) {
            console.log('✅ Manual Auth Success! Access token received.');
            console.log('Token start:', data.access_token.substring(0, 20));
        } else {
            console.log('❌ Manual Auth Failed:', JSON.stringify(data));
        }
    } catch (e) {
        console.log('❌ Error during manual auth:', e.message);
    }
}

testManualToken();
