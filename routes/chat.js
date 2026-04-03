const express = require('express');
const router = express.Router();
const { searchGoogle, scrapeWebPage } = require('../services/webSearch');
const Groq = require('groq-sdk');
require('dotenv').config();

let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// ── Expert System Prompt ────────────────────────────────────────
const NEXUS_PERSONA = `You are NEXUS, a senior AI intelligence assistant at NewsMind.AI.
You are knowledgeable, articulate, and thorough. Your responses are:
- Well-structured with clear sections using Markdown formatting (headers, bullets, bold)
- Backed by evidence and specific details from the provided sources
- Rich in context — you connect topics to broader trends and implications
- Balanced, presenting multiple perspectives when topics are debatable
- Actionable, ending with key takeaways or questions to explore further
When citing sources, mention them naturally (e.g., "According to [Source Name]...").
Never give one-line answers. Always provide depth and nuance.`;

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
        const isNewsQuery = /news|latest|update|recent|what happened|breaking|current|2024|2025|2026|trending|today|who|what|where|when|why|how|tell me about|explain/i.test(message);
        
        let response = null;
        let sources = [];
        
        if (isNewsQuery || message.length > 15) {
            // Search the web for relevant info
            console.log('🔍 Detected query - searching web for context...');
            
            const searchData = await searchGoogle(message);
            
            if (searchData && searchData.results) {
                sources = searchData.results.slice(0, 5);
                
                // Try to scrape the top 2 results for deeper context
                const topResults = searchData.results.slice(0, 2);
                let scrapedContent = '';
                
                for (const result of topResults) {
                    const content = await scrapeWebPage(result.link);
                    if (content) {
                        scrapedContent += `\n\n--- From ${result.title} ---\n${content.substring(0, 4000)}`;
                        break; // Use the first successful scrape
                    }
                }
                
                // Fallback to snippets if scraping failed
                if (!scrapedContent) {
                    scrapedContent = searchData.results
                        .slice(0, 5)
                        .map(r => `[${r.title}]: ${r.snippet}`)
                        .join('\n\n');
                }
                
                // Generate AI response with web content
                if (groq) {
                    const prompt = `The user asked: "${message}"

Here is the relevant information gathered from web sources:

SEARCH RESULTS:
${searchData.results.slice(0, 5).map((r, i) => `${i+1}. **${r.title}**\n   ${r.snippet}\n   Source: ${r.link}`).join('\n\n')}

DETAILED CONTENT:
${scrapedContent.substring(0, 8000)}

INSTRUCTIONS:
- Provide a comprehensive, well-structured answer using Markdown
- Start with a direct answer to the question
- Then expand with context, details, and analysis
- Cite sources naturally when referencing specific information
- End with key takeaways or related questions worth exploring
- If the information is time-sensitive, note the date context`;

                    const completion = await groq.chat.completions.create({
                        messages: [
                            { role: 'system', content: NEXUS_PERSONA },
                            { role: 'user', content: prompt }
                        ],
                        model: 'llama-3.3-70b-versatile',
                        max_tokens: 2048,
                        temperature: 0.4
                    });
                    
                    response = completion.choices[0]?.message?.content;
                }
            }
        }
        
        // Fallback: General AI chat without search
        if (!response && groq) {
            console.log('💭 General chat - using AI only');
            
            // Build conversation history with extended context
            const messages = [
                { role: 'system', content: NEXUS_PERSONA }
            ];
            
            // Add history (extended to 10 messages for better context)
            history.slice(-10).forEach(h => {
                messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
            });
            
            // Add current message
            messages.push({ role: 'user', content: message });
            
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: 'llama-3.3-70b-versatile',
                max_tokens: 1024,
                temperature: 0.4
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
