import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { metricsCollector } from '@/lib/performance-monitoring';
import { errorTracker } from '@/lib/error-tracking';
import { usageAnalytics } from '@/lib/usage-analytics';

/**
 * Monitoring dashboard API endpoint
 * Provides comprehensive monitoring data for Ask the Captain
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'overview';
    const startTime = parseInt(url.searchParams.get('startTime') || '0') || (Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    const endTime = parseInt(url.searchParams.get('endTime') || '0') || Date.now();

    // Initialize services with environment
    metricsCollector['env'] = env;
    errorTracker['env'] = env;
    usageAnalytics['env'] = env;

    let responseData: any;

    switch (type) {
      case 'overview':
        responseData = await getOverviewData(startTime, endTime);
        break;
      
      case 'performance':
        responseData = await getPerformanceData(startTime, endTime);
        break;
      
      case 'errors':
        responseData = await getErrorData(startTime, endTime);
        break;
      
      case 'usage':
        responseData = await getUsageData(startTime, endTime);
        break;
      
      case 'alerts':
        responseData = await getAlertsData();
        break;
      
      case 'recommendations':
        responseData = await getRecommendationsData();
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid monitoring type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      type,
      timeRange: { start: startTime, end: endTime },
      data: responseData
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Monitoring API error:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch monitoring data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}

/**
 * Get overview monitoring data
 */
async function getOverviewData(startTime: number, endTime: number) {
  const performanceMetrics = metricsCollector.getAggregatedMetrics(startTime, endTime);
  const errorSummary = errorTracker.getErrorSummary(startTime, endTime);
  const usageSummary = usageAnalytics.getUsageSummary(startTime, endTime);
  const activeAlerts = metricsCollector.getActiveAlerts();
  const errorAlerts = errorTracker.getErrors({ resolved: false });

  return {
    system: {
      status: activeAlerts.length === 0 && errorAlerts.length === 0 ? 'healthy' : 'degraded',
      uptime: '99.9%', // Would be calculated from actual uptime data
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown'
    },
    performance: {
      averageResponseTime: performanceMetrics.requests.averageResponseTime,
      p95ResponseTime: performanceMetrics.requests.p95ResponseTime,
      requestsPerMinute: performanceMetrics.requests.total / ((endTime - startTime) / 60000),
      cacheHitRate: performanceMetrics.cache.hitRate,
      memoryUtilization: performanceMetrics.memory.utilizationPercent
    },
    reliability: {
      successRate: (performanceMetrics.requests.successful / performanceMetrics.requests.total) * 100,
      errorRate: errorSummary.errorRate * 100,
      totalErrors: errorSummary.totalErrors,
      criticalErrors: errorSummary.errorsByLevel.error || 0
    },
    usage: {
      totalSessions: usageSummary.overview.totalSessions,
      totalMessages: usageSummary.overview.totalMessages,
      totalImages: usageSummary.overview.totalImages,
      activeUsers: usageSummary.engagement.activeUsers,
      averageSessionDuration: usageSummary.overview.averageSessionDuration
    },
    alerts: {
      total: activeAlerts.length + errorAlerts.length,
      critical: activeAlerts.filter(a => a.severity === 'critical').length + 
               errorAlerts.filter(e => e.level === 'error').length,
      warnings: activeAlerts.filter(a => a.severity === 'medium').length +
                errorAlerts.filter(e => e.level === 'warning').length
    }
  };
}

/**
 * Get detailed performance data
 */
async function getPerformanceData(startTime: number, endTime: number) {
  const metrics = metricsCollector.getAggregatedMetrics(startTime, endTime);
  const recommendations = metricsCollector.getPerformanceRecommendations();

  return {
    metrics,
    recommendations,
    trends: {
      // Would include historical trend data
      responseTimetrend: 'stable',
      errorRatetrend: 'improving',
      cacheHitRatetrend: 'stable'
    }
  };
}

/**
 * Get error tracking data
 */
async function getErrorData(startTime: number, endTime: number) {
  const errorSummary = errorTracker.getErrorSummary(startTime, endTime);
  const recentErrors = errorTracker.getErrors({
    startTime,
    endTime,
    resolved: false
  }).slice(0, 50); // Limit to 50 most recent errors

  const alertRules = errorTracker.getAlertRules();

  return {
    summary: errorSummary,
    recentErrors: recentErrors.map(error => ({
      id: error.id,
      level: error.level,
      category: error.category,
      message: error.message,
      occurrenceCount: error.occurrenceCount,
      lastOccurrence: error.lastOccurrence,
      context: {
        endpoint: error.context.endpoint,
        method: error.context.method,
        country: error.context.country
      }
    })),
    alertRules: alertRules.map(rule => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      condition: rule.condition,
      lastTriggered: rule.lastTriggered
    }))
  };
}

/**
 * Get usage analytics data
 */
async function getUsageData(startTime: number, endTime: number) {
  const usageSummary = usageAnalytics.getUsageSummary(startTime, endTime);

  return {
    summary: usageSummary,
    insights: {
      peakUsageHours: [], // Would be calculated from hourly data
      userBehaviorPatterns: [], // Would be calculated from user journey data
      contentPerformance: usageSummary.content,
      geographicDistribution: usageSummary.geography
    }
  };
}

/**
 * Get active alerts
 */
async function getAlertsData() {
  const performanceAlerts = metricsCollector.getActiveAlerts();
  const errorAlerts = errorTracker.getErrors({ resolved: false });

  const allAlerts = [
    ...performanceAlerts.map(alert => ({
      id: alert.id,
      type: 'performance',
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
      source: 'performance_monitor'
    })),
    ...errorAlerts.map(error => ({
      id: error.id,
      type: 'error',
      severity: error.level === 'error' ? 'high' : error.level === 'warning' ? 'medium' : 'low',
      message: error.message,
      timestamp: error.lastOccurrence,
      source: 'error_tracker'
    }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  return {
    alerts: allAlerts,
    summary: {
      total: allAlerts.length,
      critical: allAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length,
      warnings: allAlerts.filter(a => a.severity === 'medium').length,
      info: allAlerts.filter(a => a.severity === 'low').length
    }
  };
}

/**
 * Get performance recommendations
 */
async function getRecommendationsData() {
  const performanceRecommendations = metricsCollector.getPerformanceRecommendations();
  
  // Add system-level recommendations
  const systemRecommendations = [
    {
      recommendations: [
        'Set up automated alerting for critical metrics',
        'Implement log aggregation for better debugging',
        'Configure backup and disaster recovery procedures'
      ],
      priority: 'medium' as const,
      estimatedImpact: 'Improve system reliability and maintainability'
    },
    {
      recommendations: [
        'Implement A/B testing for feature improvements',
        'Set up user feedback collection system',
        'Create performance budgets for key metrics'
      ],
      priority: 'low' as const,
      estimatedImpact: 'Enhance user experience and development workflow'
    }
  ];

  return {
    performance: performanceRecommendations,
    system: systemRecommendations,
    prioritized: [
      ...performanceRecommendations.filter(r => r.priority === 'high'),
      ...systemRecommendations.filter(r => r.priority === 'high'),
      ...performanceRecommendations.filter(r => r.priority === 'medium'),
      ...systemRecommendations.filter(r => r.priority === 'medium'),
      ...performanceRecommendations.filter(r => r.priority === 'low'),
      ...systemRecommendations.filter(r => r.priority === 'low')
    ]
  };
}

/**
 * POST endpoint for resolving alerts
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const body = await request.json();
    const { action, alertId, alertType } = body;

    if (action === 'resolve' && alertId && alertType) {
      let resolved = false;

      if (alertType === 'performance') {
        resolved = metricsCollector.resolveAlert(alertId);
      } else if (alertType === 'error') {
        resolved = errorTracker.resolveError(alertId);
      }

      if (resolved) {
        return NextResponse.json({ 
          success: true, 
          message: 'Alert resolved successfully' 
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'Alert not found or already resolved' 
        }, { status: 404 });
      }
    }

    return NextResponse.json({ 
      error: 'Invalid action or missing parameters' 
    }, { status: 400 });

  } catch (error) {
    console.error('Monitoring POST error:', error);
    
    return NextResponse.json({
      error: 'Failed to process monitoring action',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}