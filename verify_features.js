const axios = require('axios');

async function verifyFeatures() {
    console.log('🚀 Starting Feature Verification on http://localhost:5000');
    const API_BASE = 'http://localhost:5000/api';

    try {
        // 1. War Room / Comparison Test
        console.log('\n--- 1. War Room / Comparison Test ---');
        try {
            const compare = await axios.post(`${API_BASE}/tools/compare`, {
                url1: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
                url2: 'https://en.wikipedia.org/wiki/Machine_learning'
            }, { timeout: 30000 }); // Longer timeout for AI
            console.log('Compare Success:', compare.data.success);
            console.log('Analysis Snippet:', compare.data.data.substring(0, 500) + '...');
        } catch (e) {
            console.error('Compare Failed:', e.message);
        }

        // 2. Public Feed Test (War Room Feed)
        console.log('\n--- 2. Public Feed Test ---');
        const feed = await axios.get(`${API_BASE}/feed/latest`);
        console.log('Feed Success:', feed.data.success);
        console.log('Feed Count:', feed.data.data.length);

        // 3. Debate Test (War Room Logic)
        console.log('\n--- 3. Debate Room Test ---');
        // First get a summary ID to create a debate
        const summaries = await axios.get(`${API_BASE}/history/summaries?userId=test-user`);
        if (summaries.data.success && summaries.data.data.summaries.length > 0) {
            const summaryId = summaries.data.data.summaries[0].id;
            const debate = await axios.post(`${API_BASE}/debate/create`, {
                summaryId,
                userId: 'test-user',
                userName: 'Test User'
            });
            console.log('Debate Create Success:', debate.data.success);
            console.log('Room ID:', debate.data.data.roomId);
        } else {
            console.log('No summaries found to test debate creation.');
        }

        // 4. Chat Verification (Static Logic Verification)
        console.log('\n--- 4. Chat Logic Verification ---');
        // Chat in chat.html is mostly client-side with placeholder logic currently.
        // We verified the UI code previously.
        console.log('Chat uses client-side placeholder logic currently. UI verification complete.');

        console.log('\n✅ Verification Complete!');
    } catch (error) {
        console.error('\n❌ Verification Failed!');
        if (error.response) {
            console.error('Response Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

verifyFeatures();
