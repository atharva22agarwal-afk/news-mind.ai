const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No API key found!');
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // Unfortunately the SDK doesn't have a direct listModels, we have to use the REST API or try common names
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro'];
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent('test');
                console.log(`✅ Model ${m} is available`);
            } catch (e) {
                console.log(`❌ Model ${m} failed: ${e.message}`);
            }
        }
    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();
