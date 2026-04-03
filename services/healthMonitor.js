const http = require('http');

/**
 * Health Check & Monitoring Service
 * Provides comprehensive system health monitoring
 */

class HealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.aiRequests = {
      groq: { success: 0, failure: 0, latency: [] },
      gemini: { success: 0, failure: 0, latency: [] }
    };
    this.dbStatus = { connected: false, lastCheck: null };
    this.memoryUsage = [];
  }

  /**
   * Record AI request metrics
   */
  recordAIRequest(provider, success, latencyMs) {
    const aiStat = this.aiRequests[provider];
    if (!aiStat) return;

    if (success) {
      aiStat.success++;
    } else {
      aiStat.failure++;
      this.errorCount++;
    }

    // Track latency (keep last 100)
    aiStat.latency.push(latencyMs);
    if (aiStat.latency.length > 100) {
      aiStat.latency.shift();
    }
  }

  /**
   * Record general request
   */
  recordRequest() {
    this.requestCount++;
  }

  /**
   * Record error
   */
  recordError() {
    this.errorCount++;
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(db) {
    try {
      const startTime = Date.now();
      // Check existing 'users' collection instead of creating _health_check
      await db.collection('users').limit(1).get();
      const latency = Date.now() - startTime;
      
      this.dbStatus = {
        connected: true,
        lastCheck: Date.now(),
        latency
      };
      
      return true;
    } catch (error) {
      this.dbStatus = {
        connected: false,
        lastCheck: Date.now(),
        error: error.message
      };
      
      this.errorCount++;
      return false;
    }
  }

  /**
   * Check AI service health
   */
  async checkAIServices(aiService) {
    const health = {};
    
    // Check Groq
    try {
      const startTime = Date.now();
      // Simple test prompt
      await aiService.deepSummarize('Test content for health check', 'health-check');
      const latency = Date.now() - startTime;
      
      health.groq = {
        status: 'healthy',
        latency,
        lastCheck: Date.now()
      };
    } catch (error) {
      health.groq = {
        status: 'unhealthy',
        error: error.message,
        lastCheck: Date.now()
      };
    }

    // Check Gemini (if available)
    try {
      const startTime = Date.now();
      await aiService.deepSummarize('Test content for health check', 'health-check');
      const latency = Date.now() - startTime;
      
      health.gemini = {
        status: 'healthy',
        latency,
        lastCheck: Date.now()
      };
    } catch (error) {
      health.gemini = {
        status: 'unhealthy',
        error: error.message,
        lastCheck: Date.now()
      };
    }

    return health;
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    const memoryInfo = {
      rss: Math.round(usage.rss / 1024 / 1024), // Resident Set Size
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };

    // Track history (keep last 60)
    this.memoryUsage.push({
      timestamp: Date.now(),
      ...memoryInfo
    });

    if (this.memoryUsage.length > 60) {
      this.memoryUsage.shift();
    }

    return memoryInfo;
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus(db, aiService) {
    const uptime = Date.now() - this.startTime;
    const memoryInfo = this.getMemoryUsage();
    
    // Check database connection
    await this.checkDatabase(db);

    // Calculate averages
    const avgLatency = {};
    for (const [provider, stats] of Object.entries(this.aiRequests)) {
      if (stats.latency.length > 0) {
        const sum = stats.latency.reduce((a, b) => a + b, 0);
        avgLatency[provider] = Math.round(sum / stats.latency.length);
      }
    }

    // Calculate error rate
    const totalRequests = this.requestCount || 1;
    const errorRate = ((this.errorCount / totalRequests) * 100).toFixed(2);

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: {
        milliseconds: uptime,
        seconds: Math.round(uptime / 1000),
        minutes: Math.round(uptime / 60000),
        hours: (uptime / 3600000).toFixed(2)
      },
      version: '1.1.0',
      environment: process.env.NODE_ENV || 'development',

      database: {
        type: 'Firebase Firestore',
        ...this.dbStatus
      },
      
      aiServices: {
        groq: {
          ...this.aiRequests.groq,
          avgLatency: avgLatency.groq || 0
        },
        gemini: {
          ...this.aiRequests.gemini,
          avgLatency: avgLatency.gemini || 0
        }
      },
      
      performance: {
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        errorRate: `${errorRate}%`,
        requestsPerMinute: Math.round((this.requestCount / (uptime / 60000)) * 100) / 100
      },
      
      memory: memoryInfo,
      
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        cpus: require('os').cpus().length
      }
    };
  }

  /**
   * Get simplified status for load balancers
   */
  getStatus() {
    const isHealthy = this.dbStatus.connected && 
                      (Date.now() - this.startTime < 86400000); // 24 hours
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: Date.now()
    };
  }

  /**
   * Get detailed metrics for monitoring dashboards
   */
  getMetrics() {
    return {
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        successRate: ((this.requestCount - this.errorCount) / this.requestCount * 100).toFixed(2)
      },
      ai: this.aiRequests,
      memory: this.memoryUsage[this.memoryUsage.length - 1],
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.aiRequests = {
      groq: { success: 0, failure: 0, latency: [] },
      gemini: { success: 0, failure: 0, latency: [] }
    };
    this.memoryUsage = [];
  }
}

// Create singleton instance
const healthMonitor = new HealthMonitor();

/**
 * Express middleware to record requests
 */
function healthMiddleware(req, res, next) {
  healthMonitor.recordRequest();
  
  // Record response time
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log slow requests
    if (duration > 5000) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
}

/**
 * Health check endpoint handler
 */
async function healthCheckHandler(req, res) {
  try {
    const { db, aiService } = req.app.locals;
    
    const health = await healthMonitor.getHealthStatus(db, aiService);
    
    // Determine overall status
    const isHealthy = health.database.connected;
    
    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Simple readiness check (for Kubernetes/load balancers)
 */
async function readinessHandler(req, res) {
  const { db } = req.app.locals || {};
  
  // Check database connectivity
  if (db) {
    await healthMonitor.checkDatabase(db);
  }
  
  const status = healthMonitor.getStatus();
  res.status(status.status === 'healthy' ? 200 : 503).json(status);
}

/**
 * Liveness check (is the process alive?)
 */
function livenessHandler(req, res) {
  res.json({
    status: 'alive',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
}

/**
 * Metrics endpoint (Prometheus-compatible format)
 */
function metricsHandler(req, res) {
  const metrics = healthMonitor.getMetrics();
  
  // Format as Prometheus metrics
  const prometheusMetrics = `
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.requests.total}

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.requests.errors}

# HELP ai_requests_total Total AI requests by provider
# TYPE ai_requests_total counter
ai_requests_total{provider="groq"} ${metrics.ai.groq.success + metrics.ai.groq.failure}
ai_requests_total{provider="gemini"} ${metrics.ai.gemini.success + metrics.ai.gemini.failure}

# HELP ai_request_errors_total Total AI request errors by provider
# TYPE ai_request_errors_total counter
ai_request_errors_total{provider="groq"} ${metrics.ai.groq.failure}
ai_request_errors_total{provider="gemini"} ${metrics.ai.gemini.failure}

# HELP process_memory_bytes Memory usage in bytes
# TYPE process_memory_bytes gauge
process_memory_bytes{type="rss"} ${metrics.memory?.rss * 1024 * 1024 || 0}
process_memory_bytes{type="heap_used"} ${metrics.memory?.heapUsed * 1024 * 1024 || 0}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${Math.floor((Date.now() - healthMonitor.startTime) / 1000)}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
}

module.exports = {
  healthMonitor,
  healthMiddleware,
  healthCheckHandler,
  readinessHandler,
  livenessHandler,
  metricsHandler
};
