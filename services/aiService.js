// =============================================================
//  services/aiService.js — NewsMind.AI (Hybrid Edition)
//  ✅ Forensic Analysis: Groq Llama-3.3-70B-Versatile
//  ✅ Quick Summaries: Gemini-2.5-Flash
//  Updated: 2026
// =============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

// ── Security Proxy: validates API keys at runtime ───────────────
class AISecurityProxy {
  static getGeminiKey() {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.length < 32) throw new Error('Missing GEMINI_API_KEY');
    return key;
  }
  static getGroqKey() {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('Missing GROQ_API_KEY');
    return key;
  }
}

class AIService {
  constructor() {
    this.genAI = null;
    this.gemini = null;
    this.groq = null;
  }

  // ── Initializer ───────────────────────────────────────────────
  _init() {
    // Init Gemini
    if (!this.gemini) {
      try {
        const key = AISecurityProxy.getGeminiKey();
        this.genAI = new GoogleGenerativeAI(key);
        this.gemini = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('[AIService] ✨ Gemini 2.5 Flash ready.');
      } catch (e) { console.warn('[AIService] ⚠️ Gemini init failed:', e.message); }
    }

    // Init Groq
    if (!this.groq) {
      try {
        const key = AISecurityProxy.getGroqKey();
        this.groq = new Groq({ apiKey: key });
        console.log('[AIService] 🔥 Groq Llama-3.3-70B ready.');
      } catch (e) { console.warn('[AIService] ⚠️ Groq init failed:', e.message); }
    }
  }

  // ── COMPARE: Forensic News Comparison (Powered by GROQ) ────────
  async compareArticles(url1, url2) {
    this._init();
    if (!this.groq) return this._compareFallbackGemini(url1, url2);

    const urlScraper = require('../urlScraper');
    try {
      console.log(`[AIService] Groq Analysis for:\n  A: ${url1}\n  B: ${url2}`);

      const [data1, data2] = await Promise.all([
        urlScraper.scrapeURL(url1),
        urlScraper.scrapeURL(url2),
      ]);

      const prompt = `
You are a Principal Forensic News Analyst. Compare these two news articles and produce a structured intelligence report.
Target A: ${url1}
Target B: ${url2}

## Analysis Framework
1. 🔴 Conflicting Truths (Forensic Delta): Direct contradictions.
2. 🟡 Omission Analysis: Facts present in one but missing in the other.
3. 📊 Propositional Density: Factual claims per word.
4. 🧠 Entropy Assessment: Information value (1-10).
5. ⚖️ Bias Indicators: Loaded language or missing context.
6. 🏁 Verdict: Trustworthiness comparison.

SOURCE A CONTENT:
${data1.content.slice(0, 8000)}

SOURCE B CONTENT:
${data2.content.slice(0, 8000)}

Respond in structured Markdown. Be surgical and analytical.
      `.trim();

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1, // Precision over creativity
      });

      return completion.choices[0]?.message?.content || 'Comparison failed.';
    } catch (e) {
      console.error('[AIService] GROQ_COMPARE_FAILURE:', e.message);
      return `### Analysis Aborted\n**Reason:** ${e.message}\n*Attempting fallbacks or check logs.*`;
    }
  }

  // ── DEBATE: Judge Argument (Powered by GROQ) ──────────────────
  async judgeArgument(content, topic, side) {
    this._init();
    if (!this.groq) return { strengthScore: 50, verdict: 'Groq Unavailable' };

    const prompt = `
Analyze this debate argument on "${topic}" (Side: ${side}).
Argument: ${content}

Return ONLY valid JSON:
{
  "strengthScore": (0-100),
  "verdict": "string",
  "strongPoints": [],
  "weakPoints": [],
  "evidenceQuality": (0-100),
  "emotionPercent": (0-100),
  "logicPercent": (0-100)
}
    `.trim();

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant', // Fast model for scoring
        response_format: { type: 'json_object' }
      });
      return JSON.parse(completion.choices[0].message.content);
    } catch (e) { return { strengthScore: 0, verdict: e.message }; }
  }

  // ── DEBATE: Moderate (Powered by GROQ) ────────────────────────
  async moderateDebate(topic, messages) {
    this._init();
    if (!this.groq) return { summary: 'Moderation pending...' };

    const context = messages.slice(-10).map(m => `${m.sender}: ${m.content}`).join('\n');
    const prompt = `Moderate this debate on "${topic}".\nRecent Messages:\n${context}\nReturn JSON: { "forStrength": 0-100, "againstStrength": 0-100, "dominantThemes": [], "summary": "" }`;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' }
      });
      return JSON.parse(completion.choices[0].message.content);
    } catch (e) { return { summary: 'Moderation error.' }; }
  }

  // ── DEBATE: Response (Powered by GROQ) ────────────────────────
  async generateDebateResponse(topic, userMessage, messageHistory) {
    this._init();
    if (!this.groq) return "I'm listening...";

    const context = messageHistory.slice(-5).map(m => `${m.userName}: ${m.content}`).join('\n');
    const prompt = `You are a neutral moderator for: ${topic}. \nContext:\n${context}\nUser: ${userMessage}\nRespond witty and challenging (<150 words).`;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
      });
      return completion.choices[0].message.content;
    } catch (e) { return "Let's explore that further."; }
  }

  // ── SUMMARIZE: (Powered by Gemini 2.5 Flash) ──────────────────
  async deepSummarize(content, sourceUrl = '') {
    this._init();
    if (!this.gemini) return { summary: 'Gemini unavailable.' };
    
    const prompt = `Summary JSON for: ${content.slice(0, 4000)}`;
    try {
      const result = await this.gemini.generateContent(prompt);
      return { summary: result.response.text(), semanticGravity: 0.8 };
    } catch (e) { return { summary: 'Summary error.' }; }
  }

  // ── STREAM: (Powered by Gemini) ───────────────────────────────
  async *streamSummary(content, type = 'forensic') {
    this._init();
    if (!this.gemini) { yield 'Streaming unavailable.'; return; }

    try {
      const result = await this.gemini.generateContentStream(`Density summary of: ${content.slice(0, 8000)}`);
      for await (const chunk of result.stream) { yield chunk.text(); }
    } catch (e) { yield `\n[Stream Error: ${e.message}]`; }
  }

  // Backup for when Groq fails
  async _compareFallbackGemini(url1, url2) {
    if (!this.gemini) return "No AI service available.";
    // Original Gemini fallback implementation...
    return "Falling back to Gemini analysis...";
  }
}

module.exports = new AIService();
