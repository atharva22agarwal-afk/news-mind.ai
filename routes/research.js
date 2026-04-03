const express = require('express');
const router = express.Router();
const { searchGoogle, scrapeWebPage } = require('../services/webSearch');
const aiService = require('../services/aiService');

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
        
        // 1. Search Google (expanded results)
        const searchData = await searchGoogle(topic);
        
        if (!searchData || !searchData.results) {
            return res.status(500).json({
                success: false,
                message: 'Search failed. Please verify your SERPER_API_KEY in .env'
            });
        }
        
        // 2. Try to scrape the top 3 results for deep context
        let scrapedContent = '';
        for (const result of searchData.results.slice(0, 3)) {
            try {
                const content = await scrapeWebPage(result.link);
                if (content) {
                    scrapedContent += `\n\n--- From: ${result.title} (${result.link}) ---\n${content.substring(0, 5000)}`;
                    if (scrapedContent.length > 10000) break;
                }
            } catch (err) {
                console.warn(`⚠️ Scraping failed for ${result.link}:`, err.message);
            }
        }
        
        // 3. Fallback to snippets if scraping failed
        if (!scrapedContent) {
            console.log("⚠️ Using Google snippets as fallback");
            scrapedContent = searchData.results
                .map(r => `[${r.title}]: ${r.snippet}`)
                .join('\n\n');
        }
        
        // 4. Generate AI Report using standardized aiService
        let summary = await aiService.generateResearchReport(topic, searchData.results, scrapedContent);
        
        console.log('✅ Research report generated via aiService');
        
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
            message: 'Research failed: ' + error.message,
            code: error.message.includes('CONFIG_ERROR') ? 'CONFIG_ERROR' : 'SERVER_ERROR'
        });
    }
});

module.exports = router;
