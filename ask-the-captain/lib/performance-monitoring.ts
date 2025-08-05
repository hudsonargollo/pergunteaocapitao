/**
 * Performance Monitoring and Metrics Collection for Cloudflare Workers
 * Provides comprehensive performance tracking, alerting, and optimization insights
 */

import { performanceMonitor } from './edge-optimization'
// CloudflareEnv is now available globally from cloudflare-env.d.ts

export interface MetricsData {
  timestamp: number
  requestId: string
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  memoryUsage: number
  cacheHit: boolean
  errorType?: string
  userAgent?: string
  country?: string
  colo?: string
}

export interface AggregatedMetrics {
  timeRange: {
    start: number
    end: number
  }
  requests: {
    total: number
    successful: number
    failed: number
    averageResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
  }
  cache: {
    hitRate: number
    totalHits: number
    totalMisses: number
  }
  memory: {
    averageUsage: number
    peakUsage: number
    utilizationPercent: number
  }
  errors: {
    totalErrors: number
    errorRate: number
    errorsByType: Record<string, number>
  }
  geography: {
    requestsByCountry: Record<string, number>
    requestsByColo: Record<string, number>
  }
}

export interface PerformanceAlert {
  id: string
  type: 'error_rate' | 'response_time' | 'memory_usage' | 'cache_hit_rate'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  threshold: number
  currentValue: number
  timestamp: number
  resolved: boolean
}

/**
 * Performance Metrics Collector
 */
export class PerformanceMetricsCollector {
  private metrics: MetricsData[] = []
  private readonly maxMetricsInMemory = 1000
  private alerts: PerformanceAlert[] = []
  private alertThresholds = {
    errorRate: 0.05, // 5%
    responseTime: 5000, // 5 seconds
    memoryUsage: 100, // 100MB
    cacheHitRate: 0.3 // 30%
  }

  constructor(private env: CloudflareEnv) {}

  /**
   * Record a request metric
   */
  recordRequest(data: Omit<MetricsData, 'timestamp'>): void {
    const metric: MetricsData = {
      ...data,
      timestamp: Date.now()
    }

    this.metrics.push(metric)

    // Keep only recent metrics in memory
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory)
    }

    // Update performance monitor
    performanceMonitor.recordCacheEvent(data.cacheHit)
    performanceMonitor.recordMemoryUsage(data.memoryUsage)

    // Check for alerts
    this.checkAlerts(metric)

    // Send to external analytics if configured
    this.sendToAnalytics(metric)
  }

  /**
   * Get aggregated metrics for a time range
   */
  getAggregatedMetrics(
    startTime: number,
    endTime: number = Date.now()
  ): AggregatedMetrics {
    const filteredMetrics = this.metrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    )

    if (filteredMetrics.length === 0) {
      return this.getEmptyMetrics(startTime, endTime)
    }

    const responseTimes = filteredMetrics.map(m => m.responseTime).sort((a, b) => a - b)
    const successfulRequests = filteredMetrics.filter(m => m.statusCode < 400)
    const failedRequests = filteredMetrics.filter(m => m.statusCode >= 400)
    const cacheHits = filteredMetrics.filter(m => m.cacheHit)
    const memoryUsages = filteredMetrics.map(m => m.memoryUsage)

    // Calculate percentiles
    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)

    // Group errors by type
    const errorsByType: Record<string, number> = {}
    filteredMetrics.forEach(m => {
      if (m.errorType) {
        errorsByType[m.errorType] = (errorsByType[m.errorType] || 0) + 1
      }
    })

    // Group by geography
    const requestsByCountry: Record<string, number> = {}
    const requestsByColo: Record<string, number> = {}
    filteredMetrics.forEach(m => {
      if (m.country) {
        requestsByCountry[m.country] = (requestsByCountry[m.country] || 0) + 1
      }
      if (m.colo) {
        requestsByColo[m.colo] = (requestsByColo[m.colo] || 0) + 1
      }
    })

    return {
      timeRange: { start: startTime, end: endTime },
      requests: {
        total: filteredMetrics.length,
        successful: successfulRequests.length,
        failed: failedRequests.length,
        averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0
      },
      cache: {
        hitRate: cacheHits.length / filteredMetrics.length,
        totalHits: cacheHits.length,
        totalMisses: filteredMetrics.length - cacheHits.length
      },
      memory: {
        averageUsage: memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length,
        peakUsage: Math.max(...memoryUsages),
        utilizationPercent: (Math.max(...memoryUsages) / 128) * 100 // Assuming 128MB limit
      },
      errors: {
        totalErrors: failedRequests.length,
        errorRate: failedRequests.length / filteredMetrics.length,
        errorsByType
      },
      geography: {
        requestsByCountry,
        requestsByColo
      }
    }
  }

  /**
   * Get current performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      return true
    }
    return false
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): {
    recommendations: string[]
    priority: 'low' | 'medium' | 'high'
    estimatedImpact: string
  }[] {
    const recommendations: {
      recommendations: string[]
      priority: 'low' | 'medium' | 'high'
      estimatedImpact: string
    }[] = []

    const recentMetrics = this.getAggregatedMetrics(Date.now() - 60 * 60 * 1000) // Last hour

    // Response time recommendations
    if (recentMetrics.requests.averageResponseTime > 3000) {
      recommendations.push({
        recommendations: [
          'Implement response caching for common queries',
          'Optimize database queries and reduce external API calls',
          'Consider request batching for external services'
        ],
        priority: 'high',
        estimatedImpact: 'Reduce response time by 40-60%'
      })
    }

    // Cache hit rate recommendations
    if (recentMetrics.cache.hitRate < 0.5) {
      recommendations.push({
        recommendations: [
          'Review cache key generation strategy',
          'Increase cache TTL for stable content',
          'Implement cache warming for popular queries'
        ],
        priority: 'medium',
        estimatedImpact: 'Improve cache hit rate to 70-80%'
      })
    }

    // Memory usage recommendations
    if (recentMetrics.memory.utilizationPercent > 80) {
      recommendations.push({
        recommendations: [
          'Implement more aggressive memory cleanup',
          'Reduce object sizes and optimize data structures',
          'Consider streaming for large responses'
        ],
        priority: 'high',
        estimatedImpact: 'Reduce memory usage by 30-50%'
      })
    }

    // Error rate recommendations
    if (recentMetrics.errors.errorRate > 0.02) {
      recommendations.push({
        recommendations: [
          'Implement better error handling and fallbacks',
          'Add retry logic for transient failures',
          'Review and fix common error patterns'
        ],
        priority: 'high',
        estimatedImpact: 'Reduce error rate to <1%'
      })
    }

    return recommendations
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(
    format: 'json' | 'csv' | 'prometheus',
    startTime?: number,
    endTime?: number
  ): string {
    const metrics = startTime 
      ? this.metrics.filter(m => m.timestamp >= startTime && (!endTime || m.timestamp <= endTime))
      : this.metrics

    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2)
      
      case 'csv':
        return this.exportToCSV(metrics)
      
      case 'prometheus':
        return this.exportToPrometheus(metrics)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metric: MetricsData): void {
    const now = Date.now()
    const recentMetrics = this.getAggregatedMetrics(now - 5 * 60 * 1000) // Last 5 minutes

    // Error rate alert
    if (recentMetrics.errors.errorRate > this.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error_rate',
        severity: recentMetrics.errors.errorRate > 0.1 ? 'critical' : 'high',
        message: `High error rate detected: ${(recentMetrics.errors.errorRate * 100).toFixed(2)}%`,
        threshold: this.alertThresholds.errorRate,
        currentValue: recentMetrics.errors.errorRate
      })
    }

    // Response time alert
    if (recentMetrics.requests.averageResponseTime > this.alertThresholds.responseTime) {
      this.createAlert({
        type: 'response_time',
        severity: recentMetrics.requests.averageResponseTime > 10000 ? 'critical' : 'high',
        message: `High response time detected: ${recentMetrics.requests.averageResponseTime.toFixed(0)}ms`,
        threshold: this.alertThresholds.responseTime,
        currentValue: recentMetrics.requests.averageResponseTime
      })
    }

    // Memory usage alert
    if (metric.memoryUsage > this.alertThresholds.memoryUsage) {
      this.createAlert({
        type: 'memory_usage',
        severity: metric.memoryUsage > 120 ? 'critical' : 'medium',
        message: `High memory usage detected: ${metric.memoryUsage.toFixed(1)}MB`,
        threshold: this.alertThresholds.memoryUsage,
        currentValue: metric.memoryUsage
      })
    }

    // Cache hit rate alert
    if (recentMetrics.cache.hitRate < this.alertThresholds.cacheHitRate) {
      this.createAlert({
        type: 'cache_hit_rate',
        severity: 'medium',
        message: `Low cache hit rate detected: ${(recentMetrics.cache.hitRate * 100).toFixed(1)}%`,
        threshold: this.alertThresholds.cacheHitRate,
        currentValue: recentMetrics.cache.hitRate
      })
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(
      alert => alert.type === alertData.type && !alert.resolved
    )

    if (existingAlert) {
      // Update existing alert
      existingAlert.currentValue = alertData.currentValue
      existingAlert.timestamp = Date.now()
      return
    }

    // Create new alert
    const alert: PerformanceAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false
    }

    this.alerts.push(alert)

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    console.warn(`Performance alert created: ${alert.message}`)
  }

  /**
   * Send metrics to external analytics
   */
  private async sendToAnalytics(metric: MetricsData): Promise<void> {
    try {
      // Send to Cloudflare Analytics if configured
      if (this.env.CLOUDFLARE_ANALYTICS_TOKEN) {
        // Implementation would depend on Cloudflare Analytics API
        console.log('Sending metric to Cloudflare Analytics:', metric.requestId)
      }

      // Send to custom analytics endpoint if configured
      if (this.env.CUSTOM_ANALYTICS_ENDPOINT) {
        await fetch(this.env.CUSTOM_ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.env.CUSTOM_ANALYTICS_TOKEN}`
          },
          body: JSON.stringify(metric)
        })
      }

    } catch (error) {
      console.error('Failed to send metrics to analytics:', error)
    }
  }

  /**
   * Export metrics to CSV format
   */
  private exportToCSV(metrics: MetricsData[]): string {
    const headers = [
      'timestamp', 'requestId', 'endpoint', 'method', 'responseTime',
      'statusCode', 'memoryUsage', 'cacheHit', 'errorType', 'userAgent',
      'country', 'colo'
    ]

    const csvRows = [headers.join(',')]

    metrics.forEach(metric => {
      const row = [
        metric.timestamp,
        metric.requestId,
        metric.endpoint,
        metric.method,
        metric.responseTime,
        metric.statusCode,
        metric.memoryUsage,
        metric.cacheHit,
        metric.errorType || '',
        metric.userAgent || '',
        metric.country || '',
        metric.colo || ''
      ]
      csvRows.push(row.join(','))
    })

    return csvRows.join('\n')
  }

  /**
   * Export metrics to Prometheus format
   */
  private exportToPrometheus(metrics: MetricsData[]): string {
    const now = Date.now()
    const lines: string[] = []

    // Response time histogram
    lines.push('# HELP ask_captain_response_time_seconds Response time in seconds')
    lines.push('# TYPE ask_captain_response_time_seconds histogram')
    
    const responseTimes = metrics.map(m => m.responseTime / 1000) // Convert to seconds
    const buckets = [0.1, 0.5, 1, 2, 5, 10, 30]
    
    buckets.forEach(bucket => {
      const count = responseTimes.filter(time => time <= bucket).length
      lines.push(`ask_captain_response_time_seconds_bucket{le="${bucket}"} ${count} ${now}`)
    })

    // Request counter
    lines.push('# HELP ask_captain_requests_total Total number of requests')
    lines.push('# TYPE ask_captain_requests_total counter')
    lines.push(`ask_captain_requests_total ${metrics.length} ${now}`)

    // Error counter
    lines.push('# HELP ask_captain_errors_total Total number of errors')
    lines.push('# TYPE ask_captain_errors_total counter')
    const errorCount = metrics.filter(m => m.statusCode >= 400).length
    lines.push(`ask_captain_errors_total ${errorCount} ${now}`)

    // Cache hit rate
    lines.push('# HELP ask_captain_cache_hit_rate Cache hit rate')
    lines.push('# TYPE ask_captain_cache_hit_rate gauge')
    const cacheHits = metrics.filter(m => m.cacheHit).length
    const hitRate = metrics.length > 0 ? cacheHits / metrics.length : 0
    lines.push(`ask_captain_cache_hit_rate ${hitRate} ${now}`)

    return lines.join('\n')
  }

  /**
   * Get empty metrics structure
   */
  private getEmptyMetrics(startTime: number, endTime: number): AggregatedMetrics {
    return {
      timeRange: { start: startTime, end: endTime },
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      },
      cache: {
        hitRate: 0,
        totalHits: 0,
        totalMisses: 0
      },
      memory: {
        averageUsage: 0,
        peakUsage: 0,
        utilizationPercent: 0
      },
      errors: {
        totalErrors: 0,
        errorRate: 0,
        errorsByType: {}
      },
      geography: {
        requestsByCountry: {},
        requestsByColo: {}
      }
    }
  }
}

// Create singleton instance
export const metricsCollector = new PerformanceMetricsCollector({} as CloudflareEnv)

// Utility functions
export function createRequestMetric(
  request: Request,
  response: Response,
  startTime: number,
  memoryUsage: number,
  cacheHit: boolean,
  errorType?: string
): Omit<MetricsData, 'timestamp'> {
  const url = new URL(request.url)
  
  return {
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    endpoint: url.pathname,
    method: request.method,
    responseTime: Date.now() - startTime,
    statusCode: response.status,
    memoryUsage,
    cacheHit,
    errorType,
    userAgent: request.headers.get('user-agent') || undefined,
    country: request.headers.get('cf-ipcountry') || undefined,
    colo: request.headers.get('cf-colo') || undefined
  }
}

// Export types
export type { 
  MetricsData, 
  AggregatedMetrics, 
  PerformanceAlert 
}