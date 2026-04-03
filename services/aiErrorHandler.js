/**
 * AI Service Error Handler with Retry Logic
 * Implements exponential backoff, circuit breaker, and fallback strategies
 */

const CircuitState = {
  CLOSED: 'CLOSED',      // Normal operation
  OPEN: 'OPEN',          // Failing, reject requests
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

class CircuitBreaker {
  constructor(failureThreshold = 5, resetTimeout = 60000, monitoringWindow = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.monitoringWindow = monitoringWindow;
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  recordSuccess() {
    this.successCount++;
    if (this.state === CircuitState.HALF_OPEN) {
      // Service recovered, close circuit
      this.state = CircuitState.CLOSED;
      this.failures = [];
      console.log('✅ Circuit breaker CLOSED - service recovered');
    }
  }

  recordFailure() {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;

    // Remove old failures outside monitoring window
    this.failures = this.failures.filter(
      time => now - time < this.monitoringWindow
    );

    if (this.failures.length >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.error(`🚨 Circuit breaker OPEN - ${this.failures.length} failures detected`);
      
      // Auto-reset after timeout
      setTimeout(() => {
        this.state = CircuitState.HALF_OPEN;
        console.warn('⚠️ Circuit breaker HALF_OPEN - testing recovery');
      }, this.resetTimeout);
    }
  }

  canExecute() {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN) return false;
    if (this.state === CircuitState.HALF_OPEN) return true;
    return false;
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures.length,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

/**
 * Retry with Exponential Backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    shouldRetry = (error) => true,
    onRetry = (error, attempt) => { }
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      attempt++;
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!shouldRetry(error) || attempt > maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelay * Math.pow(factor, attempt - 1) + Math.random() * 1000,
        maxDelay
      );

      onRetry(error, attempt);
      console.warn(`⚠️ Retry ${attempt}/${maxRetries} after ${delay}ms - ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * AI Provider Health Checker
 */
class ProviderHealthChecker {
  constructor() {
    this.providers = {
      groq: { healthy: true, lastCheck: null, errors: 0, latency: [] },
      gemini: { healthy: true, lastCheck: null, errors: 0, latency: [] }
    };
  }

  recordLatency(provider, latencyMs) {
    const providerData = this.providers[provider];
    if (!providerData) return;

    providerData.latency.push(latencyMs);
    // Keep only last 10 measurements
    if (providerData.latency.length > 10) {
      providerData.latency.shift();
    }
  }

  recordError(provider) {
    const providerData = this.providers[provider];
    if (!providerData) return;

    providerData.errors++;
    providerData.lastCheck = Date.now();

    // Mark unhealthy after 3 consecutive errors
    if (providerData.errors >= 3) {
      providerData.healthy = false;
      console.warn(`⚠️ Provider ${provider} marked as UNHEALTHY`);
    }
  }

  recordSuccess(provider) {
    const providerData = this.providers[provider];
    if (!providerData) return;

    // Reset error count on success
    providerData.errors = 0;
    providerData.healthy = true;
    providerData.lastCheck = Date.now();
  }

  getHealthyProvider() {
    for (const [name, data] of Object.entries(this.providers)) {
      if (data.healthy) return name;
    }
    return null;
  }

  getStatus() {
    return this.providers;
  }
}

/**
 * Smart AI Request Handler
 * Automatically handles retries, fallbacks, and provider switching
 */
class AIRequestHandler {
  constructor() {
    this.groqBreaker = new CircuitBreaker(5, 60000);
    this.geminiBreaker = new CircuitBreaker(5, 60000);
    this.healthChecker = new ProviderHealthChecker();
  }

  /**
   * Execute AI request with automatic retry and fallback
   */
  async execute(primaryFn, fallbackFn, options = {}) {
    const {
      provider = 'unknown',
      timeout = 30000,
      useFallback = true
    } = options;

    const startTime = Date.now();

    // Check circuit breaker
    const breaker = provider === 'groq' ? this.groqBreaker : this.geminiBreaker;
    
    if (!breaker.canExecute()) {
      console.warn(`⚠️ Circuit breaker OPEN for ${provider}, skipping request`);
      
      if (useFallback && fallbackFn) {
        console.log('🔄 Attempting fallback provider...');
        return await fallbackFn();
      }
      
      throw new Error(`Service ${provider} unavailable (circuit breaker open)`);
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        primaryFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);

      // Success - record metrics
      const latency = Date.now() - startTime;
      breaker.recordSuccess();
      this.healthChecker.recordSuccess(provider);
      this.healthChecker.recordLatency(provider, latency);

      return result;

    } catch (error) {
      // Record failure
      breaker.recordFailure();
      this.healthChecker.recordError(provider);

      // Determine if we should retry
      const shouldRetry = this._shouldRetryError(error);

      if (shouldRetry) {
        console.warn(`🔄 Retrying ${provider} request...`);
        
        try {
          // Retry once with backoff
          await new Promise(resolve => setTimeout(resolve, 2000));
          const result = await primaryFn();
          
          breaker.recordSuccess();
          this.healthChecker.recordSuccess(provider);
          return result;
        } catch (retryError) {
          console.error('❌ Retry failed');
        }
      }

      // Try fallback if available
      if (useFallback && fallbackFn) {
        console.log('🔄 Switching to fallback provider...');
        try {
          return await fallbackFn();
        } catch (fallbackError) {
          console.error('❌ Fallback also failed');
        }
      }

      // All options exhausted
      throw this._createDetailedError(error, provider);
    }
  }

  /**
   * Determine if error is retryable
   */
  _shouldRetryError(error) {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.code;

    // Retry on these conditions
    const retryableConditions = [
      status === 429,  // Rate limit
      status === 503,  // Service unavailable
      status === 504,  // Gateway timeout
      message.includes('timeout'),
      message.includes('network'),
      message.includes('rate limit'),
      message.includes('temporarily unavailable')
    ];

    // Don't retry on these
    const nonRetryableConditions = [
      status === 400,  // Bad request
      status === 401,  // Unauthorized
      status === 403,  // Forbidden
      message.includes('invalid api key'),
      message.includes('authentication')
    ];

    if (nonRetryableConditions.some(cond => cond)) return false;
    return retryableConditions.some(cond => cond);
  }

  /**
   * Create detailed error with troubleshooting info
   */
  _createDetailedError(originalError, provider) {
    const errorDetails = {
      message: `AI service ${provider} failed`,
      originalError: originalError.message,
      provider,
      circuitState: provider === 'groq' 
        ? this.groqBreaker.getState() 
        : this.geminiBreaker.getState(),
      providerHealth: this.healthChecker.getStatus()[provider],
      suggestions: []
    };

    // Add troubleshooting suggestions
    if (originalError.status === 429) {
      errorDetails.suggestions.push('Rate limit exceeded. Wait before retrying.');
    }
    if (originalError.status === 401) {
      errorDetails.suggestions.push('Check API key configuration.');
    }
    if (originalError.message.includes('timeout')) {
      errorDetails.suggestions.push('Request timed out. Try smaller input.');
    }

    const detailedError = new Error(JSON.stringify(errorDetails, null, 2));
    detailedError.details = errorDetails;
    return detailedError;
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    return {
      groq: {
        circuit: this.groqBreaker.getState(),
        health: this.healthChecker.getStatus().groq
      },
      gemini: {
        circuit: this.geminiBreaker.getState(),
        health: this.healthChecker.getStatus().gemini
      }
    };
  }
}

module.exports = {
  CircuitBreaker,
  retryWithBackoff,
  ProviderHealthChecker,
  AIRequestHandler
};
