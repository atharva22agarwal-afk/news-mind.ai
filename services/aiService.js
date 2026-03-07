// services/aiService.js — Gemini Free Version

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini with API key from environment
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables.');
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ── CORE CALLER ──────────────────────────────────────────────
async function callAI(system, userMessage, maxTokens = 1024) {
  try {
    const chat = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.3,
      }
    });

    // Gemini doesn't have a separate system role — prepend it to the message
    const fullMessage = `${system}\n\n${userMessage}`;
    const result = await chat.sendMessage(fullMessage);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API error:', error.message);
    throw error;
  }
}

// ── SAFE JSON PARSER ─────────────────────────────────────────
function parseAIResponse(text) {
  try {
    // Sometimes AI wraps in ```json blocks
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Sometimes it adds text before/after the JSON — extract it
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    return { success: true, data: JSON.parse(jsonMatch[0]) };
  } catch (e) {
    return { success: false, raw: text, error: 'Could not parse AI response' };
  }
}

// ── PROMPTS ──────────────────────────────────────────────────

const PROMPTS = {
  DEEP_SUMMARY: `You are a news analyst. You MUST respond with ONLY a JSON object. No text before or after. No markdown. Just raw JSON.

The JSON must have exactly these fields:
{
  "headline": "rewritten neutral headline as string",
  "tldr": "one sentence summary as string",
  "keyFacts": ["fact1", "fact2", "fact3"],
  "missingContext": "what the article leaves out as string",
  "biasScore": 0,
  "biasLabel": "Center",
  "sentiment": "positive or negative or neutral or mixed",
  "credibilityFlags": ["any red flags as strings"],
  "relatedQuestions": ["question1", "question2"]
}

biasScore must be a number from -5 (far left) to 5 (far right). 0 = center.
ONLY return the JSON object. Nothing else.`,

  ARGUMENT_JUDGE: `You are a debate judge. You MUST respond with ONLY a JSON object. No text before or after. No markdown. Just raw JSON.

The JSON must have exactly these fields:
{
  "strengthScore": 70,
  "verdict": "brief verdict as string",
  "strongPoints": ["strong point 1"],
  "weakPoints": ["weak point 1"],
  "bestCounterArgument": "strongest rebuttal as string",
  "evidenceQuality": "anecdotal or weak or moderate or strong",
  "emotionPercent": 40,
  "logicPercent": 60
}

strengthScore must be a number 0-100.
ONLY return the JSON object. Nothing else.`,

  FACT_CHECKER: `You are a fact-checker. You MUST respond with ONLY a JSON object. No text before or after. No markdown. Just raw JSON.

The JSON must have exactly these fields:
{
  "verdict": "True or Mostly True or Mixed or Mostly False or False or Unverifiable",
  "confidence": 80,
  "explanation": "clear explanation as string",
  "nuance": "important context as string",
  "checkThis": ["thing to verify 1", "thing to verify 2"]
}

confidence must be a number 0-100.
ONLY return the JSON object. Nothing else.`
};

// ── SEMANTIC GRAVITY ENGINE ──────────────────────────────────
/**
 * Calculates the Semantic Gravity (G) score.
 * Formula: G = (unique_claims / word_count) * 100
 */
function calculateSemanticGravity(text, keyFacts = []) {
  if (!text) return 0;
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount === 0) return 0;
  const uniqueClaims = keyFacts.length > 0 ? keyFacts.length : 1; // Fallback to 1 if no facts
  const gravity = (uniqueClaims / wordCount) * 100;
  return parseFloat(gravity.toFixed(2));
}

// ── EXPORTED FUNCTIONS ───────────────────────────────────────

async function deepSummarize(content, sourceUrl = '') {
  if (!content || content.length < 100) {
    throw new Error('Content too short');
  }

  const text = await callAI(
    PROMPTS.DEEP_SUMMARY,
    `Analyze this article.\nSource: ${sourceUrl}\n\nContent:\n${content.slice(0, 6000)}`
  );

  const result = parseAIResponse(text);
  if (!result.success) throw new Error('Summary failed: ' + result.error);

  // Calculate Semantic Gravity
  const gravityScore = calculateSemanticGravity(content, result.data.keyFacts);
  return {
    ...result.data,
    semanticGravity: gravityScore
  };
}

async function judgeArgument(argument, topic, side) {
  const text = await callAI(
    PROMPTS.ARGUMENT_JUDGE,
    `Debate Topic: "${topic}"\nSide: ${side.toUpperCase()}\nArgument: "${argument}"`
  );

  const result = parseAIResponse(text);
  if (!result.success) throw new Error('Analysis failed: ' + result.error);
  return result.data;
}

async function factCheck(claim) {
  const text = await callAI(
    PROMPTS.FACT_CHECKER,
    `Fact-check this claim: "${claim}"`
  );

  const result = parseAIResponse(text);
  if (!result.success) throw new Error('Fact check failed: ' + result.error);
  return result.data;
}

async function researchChat(userMessage, conversationHistory = []) {
  const messages = [
    {
      role: 'user',
      parts: [{
        text: `You are a research assistant helping users understand news and debates.
Always distinguish facts from opinions. Flag uncertainty. Be concise and clear.` }]
    },
    ...conversationHistory,
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role,
      parts: m.parts || [{ text: m.content || m }]
    })),
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    }
  });

  const result = await chat.sendMessage(userMessage);
  const reply = result.response.text();

  return {
    reply,
    updatedHistory: [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: reply }
    ]
  };
}

// ── DEBATE MODERATOR ─────────────────────────────────────────
async function moderateDebate(topic, arguments_) {
  const prompt = `You are a debate moderator analyzing a discussion about: "${topic}"

Analyze the arguments and provide:
1. forStrength: Score 0-100 for the "for" side
2. againstStrength: Score 0-100 for the "against" side  
3. dominantThemes: Array of main themes discussed
4. observation: Brief note about the discussion quality

Return ONLY JSON with these fields.`;

  const argsText = arguments_.map(a => `${a.sender || a.side}: ${a.content}`).join('\n\n');

  const text = await callAI(prompt, argsText, 500);
  const result = parseAIResponse(text);

  if (!result.success) {
    return {
      forStrength: 50,
      againstStrength: 50,
      dominantThemes: [],
      observation: 'Discussion in progress'
    };
  }

  return result.data;
}

// Legacy function for backwards compatibility
async function summarizeText(text, depth = 'medium') {
  // Use simple extractive summarization as fallback
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const sentenceCount = { brief: 2, medium: 4, detailed: 6 };
  const selected = sentences.slice(0, sentenceCount[depth] || 4);

  return {
    title: text.substring(0, 50) + '...',
    summary: selected.join(' '),
    keyPoints: selected.map(s => s.trim()),
    wordCount: text.split(/\s+/).length,
    readingTime: Math.ceil(text.split(/\s+/).length / 200)
  };
}

// Legacy debate response
async function generateDebateResponse(topic, userMessage, conversationHistory = []) {
  const response = await researchChat(`Debate about "${topic}": ${userMessage}`, conversationHistory);
  return response.reply;
}

// Legacy moderation  
async function moderateDebateLegacy(topic, messages) {
  const messageText = messages.map(m => `${m.senderName}: ${m.content}`).join('\n');
  const response = await researchChat(`Moderate this debate on "${topic}":\n\n${messageText}`, []);
  return response.reply;
}

// ── ARTICLE COMPARISON ───────────────────────────────────────
async function compareArticles(url1, url2) {
  const { urlScraper } = require('./urlScraper');

  try {
    const content1 = await urlScraper(url1);
    const content2 = await urlScraper(url2);

    const prompt = `You are a forensic news analyst. Compare these two articles and identify:
1. Mutual facts agreed upon by both.
2. Contradictions or differing perspectives.
3. Unique information present in only one source.
4. Overall divergence score (0-100%).

Respond in clear Markdown format with headers.

Article A (${url1}):
${content1.slice(0, 4000)}

Article B (${url2}):
${content2.slice(0, 4000)}`;

    const response = await callAI("You are a comparative analyst.", prompt, 2048);
    return response;
  } catch (error) {
    console.error('Comparison Error:', error.message);
    return `### Comparison Failed\n\nCould not analyze sources: ${error.message}`;
  }
}

module.exports = {
  deepSummarize,
  judgeArgument,
  factCheck,
  researchChat,
  moderateDebate,
  summarizeText,
  generateDebateResponse,
  compareArticles
};
