// COMPLETE AI Service - Improved Local Intelligence
// No External APIs Required - 100% Self-Contained

class AIService {
  constructor() {
    console.log('🤖 AI Service: Smart Local Algorithm');
    console.log('✅ No API keys required!');
    console.log('✅ Works 100% offline!');
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

  // IMPROVED DEBATE RESPONSE GENERATOR
  async generateDebateResponse(topic, userMessage, conversationHistory = []) {
    try {
      console.log('💬 Generating intelligent debate response...');

      if (!userMessage || userMessage.trim().length === 0) {
        return 'Please share your thoughts so we can have a meaningful discussion.';
      }

      // Analyze user message
      const userWords = userMessage.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

      // Extract key terms (most important words)
      const keyTerms = this.extractKeyTerms(userWords).slice(0, 3);

      // Detect question type
      const isQuestion = /\?/.test(userMessage);
      const isOpinion = /(think|believe|feel|opinion|view)/i.test(userMessage);
      const isFactual = /(what|how|when|where|who|why)/i.test(userMessage);

      // Build contextual response
      let response = '';

      if (isQuestion && isFactual) {
        response = this.generateFactualResponse(topic, keyTerms, userMessage);
      } else if (isOpinion) {
        response = this.generateOpinionResponse(topic, keyTerms, userMessage);
      } else {
        response = this.generateAnalyticalResponse(topic, keyTerms, userMessage);
      }

      console.log('✅ Intelligent response generated');
      return response;

    } catch (error) {
      console.error('❌ Debate Error:', error.message);
      return 'That\'s an interesting perspective. Let me provide some insights based on the available context.';
    }
  }

  // Extract most important terms from words
  extractKeyTerms(words) {
    const commonWords = new Set([
      'this', 'that', 'these', 'those', 'what', 'which', 'have', 
      'been', 'were', 'their', 'there', 'would', 'could', 'should'
    ]);

    return words
      .filter(w => !commonWords.has(w) && w.length > 4)
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
  }

  // Generate factual-style response
  generateFactualResponse(topic, keyTerms, userMessage) {
    const terms = Object.keys(keyTerms).join(', ');
    
    const responses = [
      `Regarding ${terms} in the context of "${topic}": This is a multifaceted issue. The key factors to consider include historical precedents, current research findings, and practical implications. Based on available information, there are several important perspectives worth examining.`,
      
      `That's an excellent question about ${terms}. When we analyze "${topic}", we need to consider both the theoretical framework and real-world applications. Research suggests that ${terms} plays a significant role in understanding the broader implications of this topic.`,
      
      `To address your question about ${terms}: The relationship to "${topic}" is quite intricate. Current evidence points to several interconnected factors, including societal impact, technological advancement, and policy considerations that all contribute to our understanding.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Generate opinion-based response
  generateOpinionResponse(topic, keyTerms, userMessage) {
    const terms = Object.keys(keyTerms).join(' and ');
    
    const responses = [
      `I appreciate your perspective on ${terms}. When examining "${topic}", I think it's valuable to consider multiple viewpoints. Your observation raises important questions about how we balance different priorities and values in this discussion.`,
      
      `Your thoughts on ${terms} are thought-provoking. In the context of "${topic}", opinions vary significantly, and that's what makes this discussion rich. I'd argue that we should also consider the counterarguments and alternative interpretations that others might present.`,
      
      `That's an interesting stance regarding ${terms}. Looking at "${topic}" from various angles, I believe the debate centers on fundamental questions about values, priorities, and long-term consequences. Your view represents one valid interpretation among several.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Generate analytical response
  generateAnalyticalResponse(topic, keyTerms, userMessage) {
    const terms = Object.keys(keyTerms).slice(0, 2).join(' and ');
    
    const responses = [
      `Your point about ${terms} adds an important dimension to our discussion of "${topic}". Let me build on that: We should examine not only the immediate implications but also the systemic effects. This involves analyzing cause-and-effect relationships, stakeholder interests, and potential unintended consequences.`,
      
      `Building on your observation regarding ${terms}: When we dissect "${topic}", several layers emerge. The surface-level discussion often misses deeper complexities involving economic factors, social dynamics, and ethical considerations. Your comment touches on what might be the most crucial aspect of this debate.`,
      
      `That's a significant point about ${terms} in relation to "${topic}". The analysis becomes more interesting when we consider historical patterns, current trends, and future projections. What you've highlighted suggests we need to examine both micro and macro perspectives to fully understand the implications.`,
      
      `Excellent observation regarding ${terms}. The nuances of "${topic}" require us to think critically about assumptions, evidence, and logical consistency. Your comment invites us to question prevailing narratives and consider alternative frameworks for understanding these issues.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  // IMPROVED MODERATION
  async moderateDebate(topic, messages) {
    try {
      console.log('⚖️ Generating intelligent moderation...');

      const recentMessages = messages
        .filter(msg => msg.sender !== 'system' && msg.sender !== 'ai')
        .slice(-10);

      if (recentMessages.length === 0) {
        return 'Welcome to this debate! I\'ll be moderating our discussion. Please share your perspectives, ask questions, and engage thoughtfully with different viewpoints. Let\'s have a productive conversation.';
      }

      // Analyze discussion patterns
      const participants = {};
      const allWords = [];
      
      recentMessages.forEach(msg => {
        participants[msg.senderName] = (participants[msg.senderName] || 0) + 1;
        const words = msg.content.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 4);
        allWords.push(...words);
      });

      const participantList = Object.keys(participants);
      const messageCount = recentMessages.length;

      // Find common themes
      const wordFreq = {};
      allWords.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });

      const topThemes = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);

      // Generate contextual moderation
      const moderation = `📊 **Moderation Summary**

Our debate on "${topic}" has generated ${messageCount} messages from ${participantList.join(', ')}.

**Key Themes Emerging:** The discussion has particularly focused on ${topThemes.join(', ')}, showing diverse perspectives.

**Observation:** ${this.generateModerationInsight(messageCount, participantList.length)}

**Moving Forward:** Let's continue building on these ideas. Consider supporting your points with examples, addressing counterarguments, and asking clarifying questions to deepen our understanding.`;

      console.log('✅ Moderation generated');
      return moderation;

    } catch (error) {
      console.error('❌ Moderation Error:', error.message);
      return 'The discussion is progressing well. Please continue sharing your thoughts respectfully and thoughtfully.';
    }
  }

  // Generate contextual moderation insight
  generateModerationInsight(messageCount, participantCount) {
    if (participantCount === 1) {
      return 'We have one active participant so far. Others are welcome to join and share their perspectives to enrich this discussion.';
    } else if (messageCount < 5) {
      return 'The discussion is just beginning. This is a great time to introduce key arguments and establish different viewpoints.';
    } else if (messageCount < 15) {
      return 'The conversation is developing nicely with multiple viewpoints emerging. This is an excellent opportunity to explore deeper implications and challenge assumptions.';
    } else {
      return 'We\'ve had a substantial discussion! At this stage, it might be helpful to synthesize the main arguments, identify areas of agreement/disagreement, and explore potential resolutions.';
    }
  }
}

module.exports = new AIService();