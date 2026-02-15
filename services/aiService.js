// AI Service - Now with Groq AI for Debate!
const Groq = require('groq-sdk');
require('dotenv').config();

let groq = null;

// Initialize Groq if API key is available
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('🤖 AI Service: Groq AI Connected!');
} else {
  console.log('🤖 AI Service: Local Algorithm Mode');
}

class AIService {
  constructor() {
    if (groq) {
      console.log('✅ Using Groq Llama 3 for debate!');
    } else {
      console.log('✅ Using local algorithm (no API key)');
    }
  }

  // Generate a title from text
  generateTitle(text) {
    const cleanText = text.trim();
    const firstSentence = cleanText.split(/[.!?]/)[0];
    const title = firstSentence.length > 50 
      ? firstSentence.substring(0, 50) + '...' 
      : firstSentence;
    return title || 'Document Summary';
  }

  // Calculate reading time
  calculateReadingTime(wordCount) {
    return Math.ceil(wordCount / 200);
  }

  // Calculate sentence importance score
  calculateSentenceScore(sentence, allWords) {
    const words = sentence.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    const wordFreq = {};
    allWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    let score = 0;
    words.forEach(word => {
      score += wordFreq[word] || 0;
    });

    const positionBonus = sentence.length > 20 ? 1 : 0;
    return score + positionBonus;
  }

  async summarizeText(text, depth = 'medium') {
    try {
      console.log('📝 Generating extractive summary...');

      const cleanText = text.trim();
      
      if (!cleanText || cleanText.length < 10) {
        throw new Error('Text is too short to summarize');
      }
      
      const wordCount = cleanText.split(/\s+/).length;
      const title = this.generateTitle(cleanText);
      const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
      
      const allWords = cleanText
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

      const scoredSentences = sentences.map((sentence, index) => ({
        text: sentence.trim(),
        score: this.calculateSentenceScore(sentence, allWords),
        position: index
      }));

      scoredSentences.sort((a, b) => b.score - a.score);

      const sentenceCount = {
        brief: Math.min(2, sentences.length),
        medium: Math.min(4, sentences.length),
        detailed: Math.min(6, sentences.length)
      };

      const topSentences = scoredSentences
        .slice(0, sentenceCount[depth] || sentenceCount.medium)
        .sort((a, b) => a.position - b.position);

      const summary = topSentences
        .map(s => s.text)
        .join(' ')
        .trim();

      const keyPoints = scoredSentences
        .slice(0, 5)
        .sort((a, b) => a.position - b.position)
        .map(s => s.text.replace(/[.!?]+$/, '').trim())
        .filter(s => s.length > 20 && s.length < 200);

      return {
        title: title,
        summary: summary || cleanText.substring(0, 500) + '...',
        keyPoints: keyPoints.length > 0 ? keyPoints : [
          'Main content analyzed and processed',
          'Key information successfully extracted',
          'Summary generated from source text'
        ],
        model: 'extractive-summarization-v1',
        provider: 'Built-in Algorithm',
        wordCount: wordCount,
        readingTime: this.calculateReadingTime(wordCount),
        sentenceCount: sentences.length
      };
    } catch (error) {
      console.error('❌ Summary Error:', error.message);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  // GROQ AI DEBATE RESPONSE GENERATOR
  async generateDebateResponse(topic, userMessage, conversationHistory = []) {
    try {
      console.log('💬 Generating Groq AI debate response...');

      if (!userMessage || userMessage.trim().length === 0) {
        return 'Please share your thoughts so we can have a meaningful discussion.';
      }

      // If Groq is available, use it
      if (groq) {
        const systemPrompt = `You are a witty, intelligent debate moderator. 
You're having a debate about: "${topic}"
Keep your responses short (max 2 sentences), witty, and challenging.
Play Devil's Advocate - question assumptions and push back on arguments.
Make the debate engaging and fun.`;

        // Build conversation messages
        const messages = [
          { role: 'system', content: systemPrompt }
        ];

        // Add conversation history
        conversationHistory.slice(-6).forEach(msg => {
          if (msg.sender !== 'ai') {
            messages.push({
              role: msg.sender === 'system' ? 'system' : 'user',
              content: `${msg.senderName}: ${msg.content}`
            });
          }
        });

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        const completion = await groq.chat.completions.create({
          messages: messages,
          model: 'llama3-8b-8192',
          max_tokens: 150,
          temperature: 0.9
        });

        const response = completion.choices[0]?.message?.content;
        console.log('✅ Groq AI response generated');
        return response || 'Interesting point! Tell me more.';
      }

      // Fallback to local algorithm
      return this.localDebateResponse(topic, userMessage, conversationHistory);

    } catch (error) {
      console.error('❌ Groq Debate Error:', error.message);
      // Fallback to local on error
      return this.localDebateResponse(topic, userMessage, conversationHistory);
    }
  }

  // Local fallback debate response
  localDebateResponse(topic, userMessage, conversationHistory) {
    const isQuestion = /\?/.test(userMessage);
    const isOpinion = /(think|believe|feel|opinion)/i.test(userMessage);
    
    if (isQuestion) {
      return `Great question about "${topic}". I'd argue there are multiple perspectives worth considering here. What evidence supports your view?`;
    } else if (isOpinion) {
      return `That's an interesting take on "${topic}". I see it differently - let's explore why we disagree.`;
    } else {
      return `You make a fair point about "${topic}". But have you considered the counterargument? Let's dig deeper.`;
    }
  }

  // GROQ AI MODERATION
  async moderateDebate(topic, messages) {
    try {
      console.log('⚖️ Generating Groq AI moderation...');

      const recentMessages = messages
        .filter(msg => msg.sender !== 'system' && msg.sender !== 'ai')
        .slice(-10);

      if (recentMessages.length === 0) {
        return 'Welcome to this debate! I\'ll be moderating our discussion. Please share your perspectives, ask questions, and engage thoughtfully with different viewpoints. Let\'s have a productive conversation.';
      }

      // If Groq is available, use it
      if (groq) {
        const conversationText = recentMessages
          .map(m => `${m.senderName}: ${m.content}`)
          .join('\n');

        const prompt = `You are a debate moderator. Analyze this debate about "${topic}" and provide a brief moderation summary.

Recent messages:
${conversationText}

Provide:
1. A brief observation about the discussion
2. Key themes emerging
3. A prompt to move the discussion forward

Keep it under 3 sentences and be engaging.`;

        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful debate moderator.' },
            { role: 'user', content: prompt }
          ],
          model: 'llama3-8b-8192',
          max_tokens: 200,
          temperature: 0.7
        });

        const moderation = completion.choices[0]?.message?.content;
        console.log('✅ Groq moderation generated');
        return moderation || this.localModeration(topic, messages);
      }

      // Fallback
      return this.localModeration(topic, messages);

    } catch (error) {
      console.error('❌ Groq Moderation Error:', error.message);
      return this.localModeration(topic, messages);
    }
  }

  // Local fallback moderation
  localModeration(topic, messages) {
    const messageCount = messages.filter(m => m.sender !== 'system' && m.sender !== 'ai').length;
    
    if (messageCount < 3) {
      return `The debate on "${topic}" is just getting started. Share your views and let's get the conversation going!`;
    } else if (messageCount < 10) {
      return `Good discussion forming on "${topic}". Consider addressing counterarguments to deepen the debate.`;
    } else {
      return `Excellent engagement on "${topic}"! Let's summarize the key points of agreement and disagreement.`;
    }
  }
}

module.exports = new AIService();
