// Web Search Service using Serper.dev
const axios = require('axios');
const cheerio = require('cheerio');

const searchGoogle = async (query) => {
    try {
        console.log(`🔎 Searching web for: ${query}`);
        
        // Validate Serper Key
        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey || apiKey.includes('your_') || apiKey.length < 10) {
            console.warn('[webSearch] ⚠️ SERPER_API_KEY is missing or placeholder.');
            return null;
        }

        // Get Google Results from Serper.dev
        const response = await axios.post(
            'https://google.serper.dev/search',
            { q: query, num: 10 },
            { 
                headers: { 
                    'X-API-KEY': apiKey, 
                    'Content-Type': 'application/json' 
                } 
            }
        );

        if (!response.data.organic || response.data.organic.length === 0) {
            throw new Error("No search results found.");
        }

        console.log(`✅ Found ${response.data.organic.length} results`);
        
        return {
            results: response.data.organic.map(r => ({
                title: r.title,
                link: r.link,
                snippet: r.snippet
            }))
        };
    } catch (error) {
        console.error("Search Error:", error.message);
        return null;
    }
};

const scrapeWebPage = async (url) => {
    try {
        console.log(`🕷️ Scraping content from: ${url}`);
        
        const { data } = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(data);
        
        // Remove scripts, styles, nav, footer, ads
        $('script, style, nav, footer, iframe, ads, .ad, .advertisement, .sidebar, .comments').remove();
        
        // Get paragraph text
        const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
        const content = paragraphs
            .filter(p => p.length > 50) // Filter short texts
            .join(' ')
            .substring(0, 15000); // Limit to 15k chars
        
        console.log(`✅ Extracted ${content.length} characters`);
        
        return content || null;
    } catch (error) {
        console.error("Scrape Error:", error.message);
        return null;
    }
};

module.exports = { searchGoogle, scrapeWebPage };
