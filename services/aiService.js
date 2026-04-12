// =============================================================
//  services/aiService.js — NewsMind.AI (Hybrid Edition v3)
//  ✅ Enhanced with Circuit Breaker & Retry Logic
//  ✅ Forensic Analysis: Groq Llama-3.3-70B-Versatile
//  ✅ Quick Summaries: Gemini-2.0-Flash (upgraded)
//  ✅ All Debates: Llama-3.3-70B (upgraded from 8B)
//  Updated: 2026 — Maximum Reliability Edition
// =============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const { AIRequestHandler, retryWithBackoff } = require('./aiErrorHandler');

// Initialize AI request handler with circuit breakers
const aiRequestHandler = new AIRequestHandler();

// ── Security Proxy: validates API keys at runtime ───────────────
class AISecurityProxy {
  static getGeminiKey() {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.length < 32) {
      console.warn('[AISecurityProxy] ⚠️ GEMINI_API_KEY is missing or too short.');
      throw new Error('CONFIG_ERROR: GEMINI_API_KEY is invalid or missing in .env');
    }
    return key;
  }
  static getGroqKey() {
    const key = process.env.GROQ_API_KEY;
    if (!key || key.includes('your_') || key.length < 10) {
      console.warn('[AISecurityProxy] ⚠️ GROQ_API_KEY is missing or a placeholder.');
      throw new Error('CONFIG_ERROR: GROQ_API_KEY is invalid or missing in .env');
    }
    return key;
  }
}

// ── System Personas ─────────────────────────────────────────────
const PERSONAS = {
  analyst: `You are SENTINEL, a senior intelligence analyst at NewsMind.AI. 
You have 20 years of experience in forensic journalism, geopolitical analysis, and media intelligence.
Your responses are always:
- Deeply analytical with multiple layers of insight
- Structured with clear sections and subpoints
- Evidence-based with specific references to the source material
- Balanced, presenting multiple perspectives before reaching conclusions
- Rich in context — you connect current events to historical patterns
You never give superficial or generic answers. Every response demonstrates expert-level depth.`,

  factChecker: `You are VERITAS, a senior fact-checking analyst at NewsMind.AI.
You specialize in cross-referencing claims against known databases, historical records, and verified reporting.
Your fact-checks are:
- Methodical, examining each component of a claim separately
- Transparent about confidence levels and reasoning
- Aware of common misinformation patterns and logical fallacies
- Clear about what is verifiable vs. what requires further investigation`,

  researcher: `You are ARCHIVIST, a senior research lead at NewsMind.AI.
You specialize in synthesizing vast amounts of information into coherent, actionable research reports.
Your reports are:
- Comprehensive, covering all facets of the requested topic
- Structured with executive summaries, detailed findings, and future implications
- Objective, citing diverse viewpoints and data sources
- Highly organized with clear headings and bulleted insights`,

  debater: `You are DIALECTIC, an expert debate moderator and argumentation analyst at NewsMind.AI.
You have deep expertise in rhetoric, logical reasoning, and structured argumentation.
Your analysis covers logical structure, evidence quality, rhetorical effectiveness, and intellectual honesty.`,

  chatAssistant: `You are NEXUS, an AI intelligence assistant at NewsMind.AI.
You are knowledgeable, articulate, and thorough. You provide well-structured responses with:
- Clear explanations backed by evidence
- Relevant context and background information
- Multiple perspectives when the topic is debatable
- Actionable insights and key takeaways
You format responses in clean Markdown for readability. You cite sources when available.`
};

class AIService {
  constructor() {
    this.genAI = null;
    this.gemini = null;
    this.groq = null;
  }

  // ── Initializer ───────────────────────────────────────────────
  _init() {
    // Init Gemini (UPGRADED to 2.0 Flash)
    if (!this.gemini) {
      try {
        const key = AISecurityProxy.getGeminiKey();
        this.genAI = new GoogleGenerativeAI(key);
        this.gemini = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('[AIService] ✨ Gemini 2.0 Flash ready.');
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

  // ── COMPARE: Forensic News Comparison (Powered by GROQ 70B) ────────
  async compareArticles(url1, url2) {
    this._init();
    if (!this.groq && !this.gemini) {
      return this._compareFallbackGemini(url1, url2);
    }

    const urlScraper = require('./urlScraper');
    
    // Primary function using Groq
    const groqCompare = async () => {
      console.log(`[AIService] 🔬 Groq Analysis for:\n  A: ${url1}\n  B: ${url2}`);

      const [data1, data2] = await Promise.all([
        urlScraper.scrapeURL(url1),
        urlScraper.scrapeURL(url2),
      ]);

      const prompt = `
${PERSONAS.analyst}

You are comparing two news articles. Produce a comprehensive forensic intelligence report.

Target A: ${url1}
Target B: ${url2}

## Required Analysis Sections

### 1. 🔴 Conflicting Truths (Forensic Delta)
Direct contradictions between the articles. Quote specific passages that conflict.

### 2. 🟡 Omission Analysis
Facts present in one article but deliberately or accidentally missing from the other. Analyze WHY these omissions matter.

### 3. 📊 Propositional Density
Count and compare factual claims per paragraph. Which article is more information-dense?

### 4. 🧠 Entropy Assessment (1-10)
Rate the information value of each article. Higher entropy = more unique, non-obvious information.

### 5. 🔍 Narrative Framing Analysis
How does each article frame the story? What emotional language is used? What perspective is centered?

### 6. ⚖️ Source Credibility Assessment
What sources does each article cite? Are they primary or secondary? Named or anonymous?

### 7. 📅 Timeline Consistency
Do the articles agree on the sequence of events? Note any discrepancies.

### 8. 🏁 Final Verdict
Overall trustworthiness comparison with confidence percentage.

SOURCE A CONTENT:
${data1.content.slice(0, 10000)}

SOURCE B CONTENT:
${data2.content.slice(0, 10000)}

Be surgical, analytical, and thorough. Use specific quotes and data points from both articles.
      `.trim();

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 4096,
      });

      return completion.choices[0]?.message?.content || 'Comparison failed.';
    };

    // Fallback to Gemini
    const geminiCompare = async () => {
      console.log('[AIService] 🔄 Falling back to Gemini for comparison');
      return await this._compareFallbackGemini(url1, url2);
    };

    // Execute with circuit breaker and automatic fallback
    return await aiRequestHandler.execute(groqCompare, geminiCompare, {
      provider: 'groq',
      timeout: 45000,
      useFallback: true
    });
  }

  // ── DEBATE: Judge Argument (Powered by GROQ 70B) ──────────────
  async judgeArgument(content, topic, side) {
    this._init();
    if (!this.groq && !this.gemini) {
      return { strengthScore: 50, verdict: 'No AI service available' };
    }

    const prompt = `
${PERSONAS.debater}

Analyze this debate argument with expert-level depth.

TOPIC: "${topic}"
SIDE: ${side}
ARGUMENT: ${content}

Evaluate across these dimensions and return ONLY valid JSON:
{
  "strengthScore": (0-100, be precise — 70+ requires strong evidence),
  "verdict": "Detailed 2-3 sentence assessment of the argument's effectiveness",
  "strongPoints": ["List each strong point with a brief explanation of WHY it's effective"],
  "weakPoints": ["List each weak point with suggestion for improvement"],
  "evidenceQuality": (0-100, based on specificity, sourcing, and verifiability),
  "emotionPercent": (0-100, how much relies on emotional appeal),
  "logicPercent": (0-100, how much relies on logical reasoning),
  "fallacies": ["Any logical fallacies detected, e.g. strawman, ad hominem"],
  "counterArguments": ["Top 2 counter-arguments that could defeat this position"]
}
    `.trim();

    const groqJudge = async () => {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        max_tokens: 2048,
      });
      return JSON.parse(completion.choices[0].message.content);
    };

    const geminiJudge = async () => {
      const result = await this.gemini.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    };

    // Execute with retry logic
    return await aiRequestHandler.execute(groqJudge, geminiJudge, {
      provider: 'groq',
      timeout: 30000,
      useFallback: true
    });
  }

  // ── DEBATE: Moderate (Powered by GROQ 70B) ────────────────────
  async moderateDebate(topic, messages) {
    this._init();
    if (!this.groq) return { summary: 'Moderation pending...' };

    const context = messages.slice(-15).map(m => `${m.sender}: ${m.content}`).join('\n');
    const prompt = `
${PERSONAS.debater}

Moderate this debate on "${topic}" with expert-level analysis.

Recent Messages:
${context}

Return JSON with deep analysis:
{
  "forStrength": 0-100,
  "againstStrength": 0-100,
  "dominantThemes": ["List the key themes that have emerged"],
  "summary": "A comprehensive 3-4 sentence summary of the debate's current state, highlighting the strongest arguments on each side",
  "turningPoints": ["Key moments that shifted the debate"],
  "missingPerspectives": ["Important viewpoints not yet represented"]
}`;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        max_tokens: 2048,
      });
      return JSON.parse(completion.choices[0].message.content);
    } catch (e) { return { summary: 'Moderation error.' }; }
  }

  // ── DEBATE: Response (Powered by GROQ 70B) ────────────────────
  async generateDebateResponse(topic, userMessage, messageHistory) {
    this._init();
    if (!this.groq) return "I'm listening...";

    const context = messageHistory.slice(-10).map(m => `${m.userName}: ${m.content}`).join('\n');
    const prompt = `
${PERSONAS.debater}

You are moderating a live debate on: "${topic}"

Recent context:
${context}

Latest message from user: "${userMessage}"

Respond as a sharp, intellectually rigorous moderator. Your response should:
- Challenge the user's assumptions with Socratic questioning
- Introduce a counter-perspective they haven't considered
- Reference specific claims from the conversation history
- Be engaging, witty, and thought-provoking
- Keep it under 200 words but make every word count`;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
      });
      return completion.choices[0].message.content;
    } catch (e) { return "Let's explore that further."; }
  }

  // ── DEBATE: Full Analysis Engine (Enhanced) ───────────────────
  async generateDebateAnalysis(topic, debateArguments) {
    this._init();
    if (!this.groq && !this.gemini) {
      return { error: 'No AI service available' };
    }

    const forArgs = debateArguments.filter(a => a.side === 'for').map(a => a.content).join('\n---\n');
    const againstArgs = debateArguments.filter(a => a.side === 'against').map(a => a.content).join('\n---\n');

    const prompt = `
${PERSONAS.debater}

You are performing a COMPREHENSIVE DEBATE ANALYSIS on the topic: "${topic}"

ARGUMENTS FOR:
${forArgs || '[No arguments submitted yet]'}

ARGUMENTS AGAINST:
${againstArgs || '[No arguments submitted yet]'}

Produce a thorough, high-utility analysis. Return ONLY valid JSON with this EXACT structure:
{
  "keyArguments": {
    "for": [
      { "pillar": "Core thesis of this argument cluster", "evidence": "Specific evidence or claims cited", "strength": 0-100 }
    ],
    "against": [
      { "pillar": "Core thesis of this argument cluster", "evidence": "Specific evidence or claims cited", "strength": 0-100 }
    ]
  },
  "publicSentiment": {
    "summary": "2-3 sentence synthesis of what 'the people' are saying — what are the dominant opinions, fears, and hopes expressed?",
    "toneProfile": { "analytical": 0-100, "emotional": 0-100, "combative": 0-100 },
    "dominantNarrative": "The single overarching story emerging from all arguments"
  },
  "contradictionMap": [
    {
      "topic": "The specific point of conflict",
      "forClaim": "What the FOR side asserts",
      "againstClaim": "What the AGAINST side asserts",
      "resolution": "Is this resolvable? What data would settle it?"
    }
  ],
  "momentum": {
    "leading": "for or against",
    "confidence": 0-100,
    "turningPoints": ["Key moments or arguments that shifted the balance"]
  },
  "moderatorVerdict": "A fair, balanced 3-4 sentence verdict on the current state of the debate. Who has the stronger case and why? What would change the outcome?",
  "suggestedQuestions": ["2-3 questions that would deepen or improve the debate"],
  "overallQuality": {
    "evidenceRichness": 0-100,
    "intellectualDepth": 0-100,
    "civilityScore": 0-100
  }
}

Be precise, forensic, and intellectually honest. Score strictly — 70+ should require substantial evidence.
    `.trim();

    const groqAnalysis = async () => {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        max_tokens: 4096,
      });
      return JSON.parse(completion.choices[0].message.content);
    };

    const geminiAnalysis = async () => {
      const result = await this.gemini.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    };

    try {
      return await aiRequestHandler.execute(groqAnalysis, geminiAnalysis, {
        provider: 'groq',
        timeout: 45000,
        useFallback: true
      });
    } catch (error) {
      console.error('[AIService] Debate Analysis Failed:', error.message);
      return {
        error: 'Analysis failed: ' + error.message,
        keyArguments: { for: [], against: [] },
        publicSentiment: { summary: 'Analysis unavailable', toneProfile: {}, dominantNarrative: '' },
        contradictionMap: [],
        momentum: { leading: 'neutral', confidence: 0, turningPoints: [] },
        moderatorVerdict: 'Unable to generate verdict at this time.',
        suggestedQuestions: []
      };
    }
  }

  // ── SUMMARIZE: Deep Forensic Analysis (Powered by GROQ/Gemini Hybrid) ──
  async deepSummarize(content, sourceUrl = '') {
    this._init();

    const prompt = `
${PERSONAS.analyst}

Perform a comprehensive forensic intelligence analysis on the following content.

CONTENT TO ANALYZE:
${content.slice(0, 12000)}

${sourceUrl ? `SOURCE URL: ${sourceUrl}` : ''}

Return ONLY a JSON object with these fields:
{
  "headline": "A compelling, journalistic headline that captures the core story (10-15 words)",
  "tldr": "A precise 2-3 sentence executive summary covering WHO, WHAT, WHERE, WHEN, and WHY",
  "summary": "Format as BULLET POINTS for easy reading. Use this structure:\n• **Core Event**: What happened in 1-2 sentences\n• **Key Players**: Who is involved and their roles\n• **Context**: Why this matters — historical or geopolitical background\n• **Impact**: Immediate consequences and who is affected\n• **What's Next**: Future implications or developments to watch\n• **Critical Detail**: One surprising or underreported fact\nEach bullet should be a concise, punchy insight. Use bold for key terms.",
  "keyFacts": ["5-7 critical facts extracted from the content, each as a specific, verifiable claim"],
  "sentiment": "Positive/Negative/Neutral/Conflictual/Mixed",
  "biasScore": 0-100,
  "biasLabel": "Left/Right/Corporate/Government/Neutral/Activist/etc",
  "missingContext": "2-3 sentences identifying what crucial information is absent from this report and why it matters",
  "credibilityFlags": ["List any red flags: unverified claims, anonymous sources, emotional language, logical gaps"],
  "implications": ["3 potential real-world implications or consequences of this story"],
  "relatedTopics": ["3-5 related topics the reader should investigate for deeper understanding"]
}
    `.trim();

    const groqSummarize = async () => {
      console.log('[AIService] Attempting GROQ Analysis...');
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });
      const analysis = JSON.parse(completion.choices[0].message.content);
      return { ...analysis, summary: analysis.summary || analysis.tldr, semanticGravity: 0.82 };
    };

    const geminiSummarize = async () => {
      console.log('[AIService] Attempting Gemini Analysis (Fallback)...');
      const result = await this.gemini.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(jsonStr);
      return { ...analysis, summary: analysis.summary || analysis.tldr, semanticGravity: 0.82 };
    };

    // Execute with retry logic and automatic fallback
    try {
      return await aiRequestHandler.execute(groqSummarize, geminiSummarize, {
        provider: 'groq',
        timeout: 45000,
        useFallback: true
      });
    } catch (error) {
      // Both providers failed - return graceful error
      console.error('[AIService] Complete Failure (Groq & Gemini):', error.message);
      return {
        summary: 'Analysis interrupted by multi-system failure.',
        headline: 'Service Disruption',
        tldr: 'The AI brain is currently experiencing high latency or credential issues. (Error: ' + error.message + ')',
        keyFacts: ['Groq Error', 'Gemini Fallback Failed', 'Check API Keys in .env'],
        errorDetails: error.details
      };
    }
  }

  // ── RESEARCH: Deep Intelligence Report (Powered by GROQ/GEMINI) ──
  async generateResearchReport(topic, searchData, scrapedContent) {
    this._init();

    const prompt = `
${PERSONAS.analyst}

Produce a publication-quality intelligence report on this topic.

TOPIC: "${topic}"

SEARCH RESULTS (${searchData.length} sources found):
${searchData.slice(0, 5).map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   Source: ${r.link}`).join('\n\n')}

DETAILED SOURCE CONTENT:
${scrapedContent.substring(0, 12000)}

## REQUIRED STRUCTURE:

## 📰 [Compelling Headline]

### Executive Summary
A 3-4 sentence overview capturing the essential story.

### Background & Context  
Historical context and background necessary to understand this topic (3-4 sentences).

### Key Findings
- **Finding 1**: [Detailed explanation with specific facts]
- **Finding 2**: [Detailed explanation with specific facts]
- **Finding 3**: [Detailed explanation with specific facts]
- **Finding 4**: [Detailed explanation with specific facts]
- **Finding 5**: [Detailed explanation with specific facts]

### Key Players & Stakeholders
Identify the main actors and their roles/motivations.

### Analysis & Implications
What does this mean? What are the potential consequences? Connect to broader trends.

### What to Watch Next
2-3 developments to monitor going forward.

### Sources
List the sources used with brief credibility notes.

Write in an authoritative, professional intelligence briefing style. Use clean Markdown formatting.
    `.trim();

    const groqResearch = async () => {
      console.log('[AIService] 🧪 Generating Research Report with GROQ...');
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 4096,
      });
      return completion.choices[0].message.content;
    };

    const geminiResearch = async () => {
      console.log('[AIService] 🔄 Gemini Fallback for Research...');
      const result = await this.gemini.generateContent(prompt);
      return result.response.text();
    };

    // Execute with circuit breaker
    try {
      return await aiRequestHandler.execute(groqResearch, geminiResearch, {
        provider: 'groq',
        timeout: 60000,
        useFallback: true
      });
    } catch (error) {
      console.error('[AIService] Research Core Failure:', error.message);
      return `### ⚠️ Intelligence Core Disruption\n\n**Reason:** ${error.message}\n\nPlease verify your API keys in .env.`;
    }
  }

  // ── STREAM: (Powered by GROQ/Gemini Hybrid) ───────────────────
  async *streamSummary(content, type = 'forensic') {
    this._init();
    const streamPrompt = `
${PERSONAS.analyst}
Provide a detailed, structured analysis of the following content. Use clear sections with headers.
Include key findings, implications, and missing context.

Content: ${content.slice(0, 10000)}`;

    // 1. Try GROQ Streaming
    if (this.groq) {
      try {
        const stream = await this.groq.chat.completions.create({
          messages: [{ role: 'user', content: streamPrompt }],
          model: 'llama-3.3-70b-versatile',
          stream: true,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) yield content;
        }
        return;
      } catch (e) {
        console.warn('[AIService] Groq Stream Error, trying Gemini:', e.message);
      }
    }

    // 2. Fallback to Gemini
    if (this.gemini) {
      try {
        const result = await this.gemini.generateContentStream(streamPrompt);
        for await (const chunk of result.stream) { yield chunk.text(); }
      } catch (e) { yield `\n[Stream Error: ${e.message}]`; }
    } else {
      yield 'Streaming unavailable. Check API keys.';
    }
  }

  // ── FACT CHECK: Claim Verification (Powered by GROQ/GEMINI) ──
  async factCheck(claim) {
    this._init();
    
    const prompt = `
${PERSONAS.factChecker}

Perform a thorough fact-check on the following claim. Examine every component of the claim individually.

CLAIM: "${claim}"

Your analysis process:
1. Break the claim into individual verifiable components
2. For each component, assess what is known from reliable sources
3. Look for common misinformation patterns
4. Consider the context in which this claim is typically made
5. Synthesize your findings into a verdict

Return ONLY a JSON object:
{
  "verdict": "True / Mostly True / Partially True / Misleading / Mostly False / False / Unverifiable",
  "confidence": 0-100,
  "explanation": "A detailed 3-5 sentence forensic explanation breaking down WHY this verdict was reached. Reference specific facts and reasoning.",
  "claimComponents": [
    {"component": "Individual part of the claim", "status": "Verified/Unverified/False", "detail": "Brief explanation"}
  ],
  "sources": ["List of credible sources, databases, or historical records that inform this verdict"],
  "historicalContext": "1-2 sentences placing this claim in broader historical or media context",
  "misinformationPattern": "If applicable, what common misinformation pattern does this claim follow (e.g., cherry-picking, false equivalence, outdated data)",
  "analyticalNote": "Additional technical detail for the intelligence report"
}
    `.trim();

    try {
      if (this.groq) {
        const completion = await this.groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });
        return JSON.parse(completion.choices[0].message.content);
      } else if (this.gemini) {
        const result = await this.gemini.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
      } else {
        throw new Error('No AI service available for fact-checking');
      }
    } catch (e) {
      console.error('[AIService] Fact Check Error:', e.message);
      return { 
        verdict: 'Unverifiable', 
        confidence: 0, 
        explanation: 'The AI core failed to process this claim. Forensic analysis aborted.' 
      };
    }
  }

  // ── Gemini Fallback for Comparison ────────────────────────────
  async _compareFallbackGemini(url1, url2) {
    if (!this.gemini) return "No AI service available.";
    
    const urlScraper = require('./urlScraper');
    try {
      const [data1, data2] = await Promise.all([
        urlScraper.scrapeURL(url1),
        urlScraper.scrapeURL(url2),
      ]);

      const prompt = `Compare these two news articles and provide a structured analysis:
Article A (${url1}): ${data1.content.slice(0, 6000)}
Article B (${url2}): ${data2.content.slice(0, 6000)}

Provide: Key differences, bias indicators, missing context, and a trustworthiness verdict.`;

      const result = await this.gemini.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      return `### Fallback Analysis Failed\n**Reason:** ${e.message}`;
    }
  }
}

module.exports = new AIService();
