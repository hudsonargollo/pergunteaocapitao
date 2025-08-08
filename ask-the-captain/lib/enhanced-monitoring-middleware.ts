/**
 * Enhanced Monitoring Middleware
 * Integrates performance monitoring, usage analytics, and error tracking
 * for comprehensive system observability
 */

import { metricsCollector, createRequestMetric } from './performance-monitoring'
import { usageAnalytics } from './usage-analytics'
import { errorTracker } from './error-tracking'

export interface MonitoringConfig {
  enablePerformanceTracking: boolean
  enableUsageAnalytics: boolean
  enableErrorTracking: boolean
  enableDetailedLogging: boolean
  sampleRate: number // 0-1, percentage of requests to track
}

export interface RequestContext {
  requestId: string
  startTime: number
  endpoint: string
  method: string
  userAgent?: string
  country?: string
  colo?: string
  userId?: string
  sessionId?: string
}

/**
 * Enhanced Monitoring Middleware for Cloudflare Workers
 */
export class EnhancedMonitoringMiddleware {
  private config: MonitoringConfig
  private memoryUsageTracker: MemoryUsageTracker

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enablePerformanceTracking: true,
      enableUsageAnalytics: true,
      enableErrorTracking: true,
      enableDetailedLogging: process.env.NODE_ENV === 'development',
      sampleRate: 1.0,
      ...config
    }

    this.memoryUsageTracker = new MemoryUsageTracker()
  }

  /**
   * Middleware function for request monitoring
   */
  async monitor<T>(
    request: Request,
    handler: (request: Request, context: RequestContext) => Promise<T>,
    env?: CloudflareEnv
  ): Promise<T> {
    // Check if we should sample this request
    if (Math.random() > this.config.sampleRate) {
      return handler(request, this.createBasicContext(request))
    }

    const context = this.createRequestContext(request)
    
    try {
      // Track request start
      if (this.config.enableUsageAnalytics) {
        this.trackRequestStart(request, context)
      }

      if (this.config.enableErrorTracking) {
        errorTracker.trackRequest()
      }

      // Execute handler
      const result = await handler(request, context)

      // Track successful completion
      await this.trackRequestSuccess(request, context, result)

      return result

    } catch (error) {
      // Track error
      await this.trackRequestError(request, context, error)
      throw error
    }
  }

  /**
   * Monitor API endpoint specifically
   */
  async monitorAPIEndpoint<T>(
    request: Request,
    endpoint: string,
    handler: () => Promise<T>,
    options?: {
      userId?: string
      sessionId?: string
      metadata?: Record<string, any>
    }
  ): Promise<T> {
    const context = this.createRequestContext(request)
    context.endpoint = endpoint
    
    if (options?.userId) context.userId = options.userId
    if (options?.sessionId) context.sessionId = options.sessionId

    const startTime = performance.now()

    try {
      // Track API call start
      if (this.config.enableUsageAnalytics) {
        usageAnalytics.trackEvent(
          'page_view',
          'api',
          'request_start',
          {
            path: endpoint,
            userAgent: context.userAgent,
            country: context.country,
            colo: context.colo
          },
          {
            userId: context.userId,
            sessionId: context.sessionId,
            metadata: options?.metadata
          }
        )
      }

      const result = await handler()
      const responseTime = performance.now() - startTime

      // Track successful API call
      if (this.config.enableUsageAnalytics) {
        usageAnalytics.trackEvent(
          'feature_usage',
          'api',
          'request_success',
          {
            path: endpoint,
            userAgent: context.userAgent,
            country: context.country,
            colo: context.colo
          },
          {
            value: responseTime,
            userId: context.userId,
            sessionId: context.sessionId,
            metadata: {
              ...options?.metadata,
              responseTime,
              success: true
            }
          }
        )
      }

      // Track performance metrics
      if (this.config.enablePerformanceTracking) {
        const memoryUsage = this.memoryUsageTracker.getCurrentUsage()
        metricsCollector.recordRequest({
          requestId: context.requestId,
          endpoint: context.endpoint,
          method: context.method,
          responseTime,
          statusCode: 200,
          memoryUsage,
          cacheHit: false, // Would need to be determined by the handler
          userAgent: context.userAgent,
          country: context.country,
          colo: context.colo
        })
      }

      return result

    } catch (error) {
      const responseTime = performance.now() - startTime

      // Track API error
      if (this.config.enableErrorTracking) {
        errorTracker.trackError(
          'error',
          'api',
          `API endpoint ${endpoint} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined,
          {
            requestId: context.requestId,
            endpoint: context.endpoint,
            method: context.method,
            userAgent: context.userAgent,
            country: context.country,
            colo: context.colo,
            environment: process.env.NODE_ENV || 'unknown'
          },
          {
            responseTime,
            userId: context.userId,
            sessionId: context.sessionId,
            ...options?.metadata
          }
        )
      }

      // Track failed API call in analytics
      if (this.config.enableUsageAnalytics) {
        usageAnalytics.trackEvent(
          'error',
          'api',
          'request_failure',
          {
            path: endpoint,
            userAgent: context.userAgent,
            country: context.country,
            colo: context.colo
          },
          {
            value: responseTime,
            userId: context.userId,
            sessionId: context.sessionId,
            metadata: {
              ...options?.metadata,
              responseTime,
              error: error instanceof Error ? error.message : 'Unknown error',
              success: false
            }
          }
        )
      }

      throw error
    }
  }

  /**
   * Monitor chat interactions specifically
   */
  async monitorChatInteraction(
    request: Request,
    messageType: 'user' | 'assistant',
    handler: () => Promise<{
      response: string
      imageUrl?: string
      conversationId: string
      responseTime: number
      topics?: string[]
      sentiment?: string
    }>,
    options?: {
      userId?: string
      sessionId?: string
      userMessage?: string
    }
  ): Promise<ReturnType<typeof handler>> {
    const context = this.createRequestContext(request)
    context.endpoint = '/api/chat'
    
    if (options?.userId) context.userId = options.userId
    if (options?.sessionId) context.sessionId = options.sessionId

    try {
      const result = await handler()

      // Track chat message in analytics
      if (this.config.enableUsageAnalytics) {
        usageAnalytics.trackChatMessage(
          messageType,
          result.responseTime,
          {
            path: '/api/chat',
            userAgent: context.userAgent,
            country: context.country,
            colo: context.colo
          },
          {
            userId: context.userId,
            sessionId: context.sessionId,
            topics: result.topics,
            sentiment: result.sentiment
          }
        )
      }

      // Track performance
      if (this.config.enablePerformanceTracking) {
        const memoryUsage = this.memoryUsageTracker.getCurrentUsage()
        metricsCollector.recordRequest({
          requestId: context.requestId,
          endpoint: context.endpoint,
          method: context.method,
          responseTime: result.responseTime,
          statusCode: 200,
          memoryUsage,
          cacheHit: false,
          userAgent: context.userAgent,
          country: context.country,
          colo: context.colo
        })
      }

      return result

    } catch (error) {
      // Track chat error
      if (this.config.enableErrorTracking) {
        errorTracker.trackError(
          'error',
          'api',
          `Chat interaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined,
          {
            requestId: context.requestId,
            endpoint: context.endpoint,
            method: context.method,
            userId: context.userId,
            userAgent: context.userAgent,
            country: context.country,
            environment: process.env.NODE_ENV || 'unknown'
          },
          {
            messageType,
            userMessage: options?.userMessage,
            sessionId: context.sessionId
          }
        )
      }

      throw error
    }
  }

  /**
   * Monitor image generation specifically
   */
  async monitorImageGeneration(
    request: Request,
    handler: () => Promise<{
      imageUrl: string
      imageId: string
      generationTime: number
      promptParameters: Record<string, any>
    }>,
    options?: {
      userId?: string
      sessionId?: string
      responseContent?: string
      context?: Record<string, any>
    }
  ): Promise<ReturnType<typeof handler>> {
    const requestContext = this.createRequestContext(request)
    requestContext.endpoint = '/api/v1/images/generate'
    
    if (options?.userId) requestContext.userId = options.userId
    if (options?.sessionId) requestContext.sessionId = options.sessionId

    try {
      const result = await handler()

      // Track image generation in analytics
      if (this.config.enableUsageAnalytics) {
        usageAnalytics.trackImageGeneration(
          true,
          result.generationTime,
          {
            path: '/api/v1/images/generate',
            userAgent: requestContext.userAgent,
            country: requestContext.country,
            colo: requestContext.colo
          },
          {
            userId: requestContext.userId,
            sessionId: requestContext.sessionId,
            prompt: options?.responseContent,
            parameters: result.promptParameters
          }
        )
      }

      // Track performance
      if (this.config.enablePerformanceTracking) {
        const memoryUsage = this.memoryUsageTracker.getCurrentUsage()
        metricsCollector.recordRequest({
          requestId: requestContext.requestId,
          endpoint: requestContext.endpoint,
          method: requestContext.method,
          responseTime: result.generationTime,
          statusCode: 200,
          memoryUsage,
          cacheHit: false,
          userAgent: requestContext.userAgent,
          country: requestContext.country,
          colo: requestContext.colo
        })
      }

      return result

    } catch (error) {
      // Track image generation error
      if (this.config.enableErrorTracking) {
        errorTracker.trackError(
          'error',
          'external_service',
          `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined,
          {
            requestId: requestContext.requestId,
            endpoint: requestContext.endpoint,
            method: requestContext.method,
            userId: requestContext.userId,
            userAgent: requestContext.userAgent,
            country: requestContext.country,
            environment: process.env.NODE_ENV || 'unknown'
          },
          {
            responseContent: options?.responseContent,
            context: options?.context,
            sessionId: requestContext.sessionId
          }
        )
      }

      // Track failed image generation
      if (this.config.enableUsageAnalytics) {
        usageAnalytics.trackImageGeneration(
          false,
          undefined,
          {
            path: '/api/v1/images/generate',
            userAgent: requestContext.userAgent,
            country: requestContext.country,
            colo: requestContext.colo
          },
          {
            userId: requestContext.userId,
            sessionId: requestContext.sessionId,
            prompt: options?.responseContent,
            parameters: options?.context
          }
        )
      }

      throw error
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData(timeRange: { start: number; end: number }) {
    const [performanceMetrics, usageSummary, errorSummary] = await Promise.all([
      this.config.enablePerformanceTracking 
        ? metricsCollector.getAggregatedMetrics(timeRange.start, timeRange.end)
        : null,
      this.config.enableUsageAnalytics 
        ? usageAnalytics.getUsageSummary(timeRange.start, timeRange.end)
        : null,
      this.config.enableErrorTracking 
        ? errorTracker.getErrorSummary(timeRange.start, timeRange.end)
        : null
    ])

    return {
      timeRange,
      performance: performanceMetrics,
      usage: usageSummary,
      errors: errorSummary,
      alerts: this.config.enablePerformanceTracking 
        ? metricsCollector.getActiveAlerts()
        : [],
      recommendations: this.config.enablePerformanceTracking 
        ? metricsCollector.getPerformanceRecommendations()
        : [],
      systemHealth: this.getSystemHealthStatus()
    }
  }

  /**
   * Export all monitoring data
   */
  async exportMonitoringData(
    format: 'json' | 'csv',
    timeRange?: { start: number; end: number }
  ) {
    const data: any = {}

    if (this.config.enablePerformanceTracking) {
      data.performance = metricsCollector.exportMetrics(format, timeRange?.start, timeRange?.end)
    }

    if (this.config.enableUsageAnalytics) {
      data.usage = usageAnalytics.exportAnalytics(format, timeRange?.start, timeRange?.end)
    }

    if (this.config.enableErrorTracking) {
      data.errors = errorTracker.exportErrors(format, {
        startTime: timeRange?.start,
        endTime: timeRange?.end
      })
    }

    return format === 'json' ? JSON.stringify(data, null, 2) : data
  }

  /**
   * Create request context
   */
  private createRequestContext(request: Request): RequestContext {
    const url = new URL(request.url)
    
    return {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      endpoint: url.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      country: request.headers.get('cf-ipcountry') || undefined,
      colo: request.headers.get('cf-colo') || undefined
    }
  }

  /**
   * Create basic context for non-sampled requests
   */
  private createBasicContext(request: Request): RequestContext {
    const url = new URL(request.url)
    
    return {
      requestId: `basic_${Date.now()}`,
      startTime: Date.now(),
      endpoint: url.pathname,
      method: request.method
    }
  }

  /**
   * Track request start
   */
  private trackRequestStart(request: Request, context: RequestContext): void {
    if (this.config.enableDetailedLogging) {
      console.log(`Request started: ${context.method} ${context.endpoint}`, {
        requestId: context.requestId,
        userAgent: context.userAgent,
        country: context.country
      })
    }
  }

  /**
   * Track successful request completion
   */
  private async trackRequestSuccess<T>(
    request: Request,
    context: RequestContext,
    result: T
  ): Promise<void> {
    const responseTime = Date.now() - context.startTime

    if (this.config.enableDetailedLogging) {
      console.log(`Request completed: ${context.method} ${context.endpoint}`, {
        requestId: context.requestId,
        responseTime,
        success: true
      })
    }

    // Track in performance metrics
    if (this.config.enablePerformanceTracking) {
      const memoryUsage = this.memoryUsageTracker.getCurrentUsage()
      metricsCollector.recordRequest({
        requestId: context.requestId,
        endpoint: context.endpoint,
        method: context.method,
        responseTime,
        statusCode: 200,
        memoryUsage,
        cacheHit: false, // Would need cache detection logic
        userAgent: context.userAgent,
        country: context.country,
        colo: context.colo
      })
    }
  }

  /**
   * Track request error
   */
  private async trackRequestError(
    request: Request,
    context: RequestContext,
    error: unknown
  ): Promise<void> {
    const responseTime = Date.now() - context.startTime

    if (this.config.enableDetailedLogging) {
      console.error(`Request failed: ${context.method} ${context.endpoint}`, {
        requestId: context.requestId,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Track error
    if (this.config.enableErrorTracking) {
      errorTracker.trackError(
        'error',
        'api',
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        {
          requestId: context.requestId,
          endpoint: context.endpoint,
          method: context.method,
          userAgent: context.userAgent,
          country: context.country,
          colo: context.colo,
          environment: process.env.NODE_ENV || 'unknown'
        },
        {
          responseTime
        }
      )
    }

    // Track in performance metrics
    if (this.config.enablePerformanceTracking) {
      const memoryUsage = this.memoryUsageTracker.getCurrentUsage()
      metricsCollector.recordRequest({
        requestId: context.requestId,
        endpoint: context.endpoint,
        method: context.method,
        responseTime,
        statusCode: 500,
        memoryUsage,
        cacheHit: false,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        userAgent: context.userAgent,
        country: context.country,
        colo: context.colo
      })
    }
  }

  /**
   * Get system health status
   */
  private getSystemHealthStatus() {
    const memoryUsage = this.memoryUsageTracker.getCurrentUsage()
    const memoryLimit = 128 // MB - Cloudflare Workers limit
    const memoryUtilization = (memoryUsage / memoryLimit) * 100

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    const issues: string[] = []

    // Check memory usage
    if (memoryUtilization > 90) {
      status = 'unhealthy'
      issues.push('Critical memory usage')
    } else if (memoryUtilization > 75) {
      status = 'degraded'
      issues.push('High memory usage')
    }

    // Check error rates
    if (this.config.enableErrorTracking) {
      const recentErrors = errorTracker.getErrorSummary(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      if (recentErrors.errorRate > 0.1) {
        status = 'unhealthy'
        issues.push('High error rate')
      } else if (recentErrors.errorRate > 0.05) {
        if (status === 'healthy') status = 'degraded'
        issues.push('Elevated error rate')
      }
    }

    return {
      status,
      timestamp: Date.now(),
      memoryUsage,
      memoryUtilization,
      issues
    }
  }
}

/**
 * Memory Usage Tracker
 */
class MemoryUsageTracker {
  private samples: number[] = []
  private readonly maxSamples = 100

  getCurrentUsage(): number {
    // In Cloudflare Workers, we don't have direct access to memory usage
    // This is a simplified estimation based on typical patterns
    const estimatedUsage = this.estimateMemoryUsage()
    
    this.samples.push(estimatedUsage)
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }

    return estimatedUsage
  }

  getAverageUsage(): number {
    if (this.samples.length === 0) return 0
    return this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length
  }

  getPeakUsage(): number {
    if (this.samples.length === 0) return 0
    return Math.max(...this.samples)
  }

  private estimateMemoryUsage(): number {
    // This is a rough estimation - in a real implementation,
    // you might use more sophisticated memory tracking
    const baseUsage = 10 // Base memory usage in MB
    const variableUsage = Math.random() * 20 // Variable usage
    return baseUsage + variableUsage
  }
}

// Create singleton instance
export const enhancedMonitoring = new EnhancedMonitoringMiddleware()

// Utility functions for easy integration
export function monitorAPICall<T>(
  request: Request,
  endpoint: string,
  handler: () => Promise<T>,
  options?: Parameters<typeof enhancedMonitoring.monitorAPIEndpoint>[3]
): Promise<T> {
  return enhancedMonitoring.monitorAPIEndpoint(request, endpoint, handler, options)
}

export function monitorChatInteraction(
  request: Request,
  messageType: 'user' | 'assistant',
  handler: Parameters<typeof enhancedMonitoring.monitorChatInteraction>[2],
  options?: Parameters<typeof enhancedMonitoring.monitorChatInteraction>[3]
) {
  return enhancedMonitoring.monitorChatInteraction(request, messageType, handler, options)
}

export function monitorImageGeneration(
  request: Request,
  handler: Parameters<typeof enhancedMonitoring.monitorImageGeneration>[1],
  options?: Parameters<typeof enhancedMonitoring.monitorImageGeneration>[2]
) {
  return enhancedMonitoring.monitorImageGeneration(request, handler, options)
}