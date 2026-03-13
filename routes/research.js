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
 * POST /api/research
 * Search the web and generate AI report
 */
router.post('/', async (req, res) => {
    try {
        const { topic } = req.body;
        
        if (!topic) {
            return res.status(400).json({
                success: false,
                message: 'Topic is required'
            });
        }
        
        console.log(`📊 Research request: ${topic}`);
        
        // 1. Search Google
        const searchData = await searchGoogle(topic);
        
        if (!searchData || !searchData.results) {
            return res.status(500).json({
                success: false,
                message: 'Search failed. Please try again.'
            });
        }
        
        const topResult = searchData.results[0];
        
        // 2. Try to scrape the top result
        let pageContent = await scrapeWebPage(topResult.link);
        
        // 3. Fallback to snippets if scraping failed
        if (!pageContent) {
            console.log("⚠️ Using Google snippets as fallback");
            pageContent = searchData.results
                .map(r => r.snippet)
                .join('\n\n');
        }
        
        // 4. Generate AI Summary using Groq
        let summary = null;
        
        if (groq) {
            console.log('🤖 Generating AI report with Groq...');
            
            const prompt = `You are an expert news reporter and analyst.

TOPIC: "${topic}"

SEARCH RESULTS:
${searchData.results.slice(0, 3).map((r, i) => `${i+1}. ${r.title}\n${r.snippet}`).join('\n\n')}

CONTENT FROM TOP SOURCE:
${pageContent.substring(0, 8000)}

Task: Write a comprehensive, well-structured news report on this topic based ONLY on the provided information. 

Format:
- A catchy headline
- Brief intro (2-3 sentences)
- Key points (3-5 bullet points)
- Conclusion

Write in a professional news article style.`;

            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are a professional news reporter.' },
                    { role: 'user', content: prompt }
                ],
                model: 'llama-3.3-70b-versatile',
                max_tokens: 1000,
                temperature: 0.7
            });
            
            summary = completion.choices[0]?.message?.content;
        }
        
        // Fallback if no Groq
        if (!summary) {
            summary = `📰 **Report on: ${topic}**\n\n`;
            summary += `**Top Sources:**\n`;
            searchData.results.slice(0, 3).forEach((r, i) => {
                summary += `${i+1}. [${r.title}](${r.link})\n`;
            });
            summary += `\n\n**Summary:**\n${pageContent.substring(0, 2000)}...`;
        }
        
        console.log('✅ Research report generated');
        
        res.json({
            success: true,
            data: {
                topic,
                report: summary,
                sources: searchData.results.map(r => ({
                    title: r.title,
                    link: r.link,
                    snippet: r.snippet
                }))
            }
        });
        
    } catch (error) {
        console.error('Research Error:', error);
        res.status(500).json({
            success: false,
            message: 'Research failed: ' + error.message
        });
    }
});

module.exports = router;
