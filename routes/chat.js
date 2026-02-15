const express = require('express');
const router = express.Router();
const { searchGoogle, scrapeWebPage } = require('../services/webSearch');
const Groq = require('groq-sdk');
require('dotenv').config();

let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * POST /api/chat
 * AI Chat - Ask anything, get intelligent answers with web search
 */
router.post('/', async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }
        
        console.log(`💬 AI Chat: ${message}`);
        
        // Check if it's a news/search query or general chat
        const isNewsQuery = /news|latest|update|recent|what happened|breaking|current|2024|2025|2026|trending|today/i.test(message);
        
        let response = null;
        let sources = [];
        
        if (isNewsQuery || message.length > 20) {
            // Search the web for relevant info
            console.log('🔍 Detected news/query - searching web...');
            
            const searchData = await searchGoogle(message);
            
            if (searchData && searchData.results) {
                sources = searchData.results.slice(0, 3);
                
                // Try to scrape top result
                const topResult = searchData.results[0];
                let content = await scrapeWebPage(topResult.link);
                
                if (!content) {
                    content = searchData.results.map(r => r.snippet).join('\n\n');
                }
                
                // Generate AI response with web content
                if (groq) {
                    const prompt = `You are a helpful AI assistant. The user asked: "${message}"

Relevant search results:
${searchData.results.slice(0, 3).map((r, i) => `${i+1}. ${r.title}: ${r.snippet}`).join('\n\n')}

Content from top source:
${content.substring(0, 6000)}

Task: Provide a helpful, informative response based on this information. Be conversational and friendly.`;

                    const completion = await groq.chat.completions.create({
                        messages: [
                            { role: 'system', content: 'You are a helpful AI assistant with access to web search.' },
                            { role: 'user', content: prompt }
                        ],
                        model: 'llama3-8b-8192',
                        max_tokens: 500,
                        temperature: 0.8
                    });
                    
                    response = completion.choices[0]?.message?.content;
                }
            }
        }
        
        // Fallback: General AI chat without search
        if (!response && groq) {
            console.log('💭 General chat - using AI only');
            
            // Build conversation history
            const messages = [
                { role: 'system', content: 'You are a helpful, friendly AI assistant. Be conversational and concise.' }
            ];
            
            // Add history
            history.slice(-5).forEach(h => {
                messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
            });
            
            // Add current message
            messages.push({ role: 'user', content: message });
            
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: 'llama3-8b-8192',
                max_tokens: 300,
                temperature: 0.8
            });
            
            response = completion.choices[0]?.message?.content;
        }
        
        // Final fallback
        if (!response) {
            response = "I'm thinking... but my brain (Groq API) might be taking a break. Try again in a moment!";
        }
        
        console.log('✅ AI Response generated');
        
        res.json({
            success: true,
            data: {
                response,
                sources: sources,
                isWebSearch: sources.length > 0
            }
        });
        
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            success: false,
            message: 'Chat failed: ' + error.message
        });
    }
});

module.exports = router;
