const axios = require('axios');

async function runSmokeTest() {
    console.log('🚀 Starting Smoke Test on http://localhost:5000');

    try {
        // 1. Health Check
        console.log('\n--- 1. Health Check ---');
        const health = await axios.get('http://localhost:5000/');
        console.log('Status:', health.data.status);
        console.log('Database:', health.data.database);

        // 2. Auth Test (Register/Login)
        console.log('\n--- 2. Auth Test ---');
        const login = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'test@example.com',
            name: 'Test User'
        });
        console.log('Login Success:', login.data.success);
        const userId = login.data.data.userId;
        console.log('User ID:', userId);

        // 3. Trending Summaries (Read)
        console.log('\n--- 3. Trending Summaries ---');
        const trending = await axios.get('http://localhost:5000/api/summary/trending');
        console.log('Trending Count:', trending.data.summaries.length);

        // 4. History Test
        console.log('\n--- 4. History Test ---');
        const history = await axios.get(`http://localhost:5000/api/history/summaries?userId=${userId}`);
        console.log('History Success:', history.data.success);

        console.log('\n✅ Smoke Test Passed!');
    } catch (error) {
        console.error('\n❌ Smoke Test Failed!');
        if (error.response) {
            console.error('Response Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

runSmokeTest();
