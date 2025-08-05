import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { metricsCollector } from '@/lib/performance-monitoring';
import { errorTracker } from '@/lib/error-tracking';
import { usageAnalytics } from '@/lib/usage-analytics';

/**
 * Metrics export API endpoint
 * Provides metrics in various formats for external monitoring systems
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const type = url.searchParams.get('type') || 'performance';
    const startTime = parseInt(url.searchParams.get('startTime') || '0') || (Date.now() - 60 * 60 * 1000); // Default: last hour
    const endTime = parseInt(url.searchParams.get('endTime') || '0') || Date.now();

    // Initialize services with environment
    metricsCollector['env'] = env;
    errorTracker['env'] = env;
    usageAnalytics['env'] = env;

    let exportData: string;
    let contentType: string = '';
    let filename: string;

    switch (type) {
      case 'performance':
        exportData = metricsCollector.exportMetrics(format as any, startTime, endTime);
        filename = `performance-metrics-${Date.now()}.${format}`;
        break;
      
      case 'errors':
        exportData = errorTracker.exportErrors(format as any, { startTime, endTime });
        filename = `error-logs-${Date.now()}.${format}`;
        break;
      
      case 'usage':
        exportData = usageAnalytics.exportAnalytics(format as any, startTime, endTime);
        filename = `usage-analytics-${Date.now()}.${format}`;
        break;
      
      case 'prometheus':
        // Special case for Prometheus metrics
        exportData = await getPrometheusMetrics();
        contentType = 'text/plain; version=0.0.4; charset=utf-8';
        filename = 'metrics.txt';
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid metrics type' },
          { status: 400 }
        );
    }

    // Set content type based on format
    if (!contentType) {
      switch (format) {
        case 'json':
          contentType = 'application/json';
          break;
        case 'csv':
          contentType = 'text/csv';
          break;
        case 'prometheus':
          contentType = 'text/plain; version=0.0.4; charset=utf-8';
          break;
        default:
          contentType = 'text/plain';
      }
    }

    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Metrics export error:', error);
    
    return NextResponse.json({
      error: 'Failed to export metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Generate Prometheus-compatible metrics
 */
async function getPrometheusMetrics(): Promise<string> {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const performanceMetrics = metricsCollector.getAggregatedMetrics(oneHourAgo, now);
  const errorSummary = errorTracker.getErrorSummary(oneHourAgo, now);
  const usageSummary = usageAnalytics.getUsageSummary(oneHourAgo, now);

  const lines: string[] = [];

  // Performance metrics
  lines.push('# HELP ask_captain_requests_total Total number of HTTP requests');
  lines.push('# TYPE ask_captain_requests_total counter');
  lines.push(`ask_captain_requests_total ${performanceMetrics.requests.total} ${now}`);

  lines.push('# HELP ask_captain_request_duration_seconds Request duration in seconds');
  lines.push('# TYPE ask_captain_request_duration_seconds histogram');
  lines.push(`ask_captain_request_duration_seconds_sum ${performanceMetrics.requests.averageResponseTime * performanceMetrics.requests.total / 1000} ${now}`);
  lines.push(`ask_captain_request_duration_seconds_count ${performanceMetrics.requests.total} ${now}`);

  // Response time percentiles
  lines.push('# HELP ask_captain_request_duration_p95_seconds 95th percentile request duration');
  lines.push('# TYPE ask_captain_request_duration_p95_seconds gauge');
  lines.push(`ask_captain_request_duration_p95_seconds ${performanceMetrics.requests.p95ResponseTime / 1000} ${now}`);

  lines.push('# HELP ask_captain_request_duration_p99_seconds 99th percentile request duration');
  lines.push('# TYPE ask_captain_request_duration_p99_seconds gauge');
  lines.push(`ask_captain_request_duration_p99_seconds ${performanceMetrics.requests.p99ResponseTime / 1000} ${now}`);

  // Error metrics
  lines.push('# HELP ask_captain_errors_total Total number of errors');
  lines.push('# TYPE ask_captain_errors_total counter');
  lines.push(`ask_captain_errors_total ${errorSummary.totalErrors} ${now}`);

  lines.push('# HELP ask_captain_error_rate Error rate (errors per request)');
  lines.push('# TYPE ask_captain_error_rate gauge');
  lines.push(`ask_captain_error_rate ${errorSummary.errorRate} ${now}`);

  // Error breakdown by level
  Object.entries(errorSummary.errorsByLevel).forEach(([level, count]) => {
    lines.push(`ask_captain_errors_total{level="${level}"} ${count} ${now}`);
  });

  // Error breakdown by category
  Object.entries(errorSummary.errorsByCategory).forEach(([category, count]) => {
    lines.push(`ask_captain_errors_total{category="${category}"} ${count} ${now}`);
  });

  // Cache metrics
  lines.push('# HELP ask_captain_cache_hit_rate Cache hit rate');
  lines.push('# TYPE ask_captain_cache_hit_rate gauge');
  lines.push(`ask_captain_cache_hit_rate ${performanceMetrics.cache.hitRate} ${now}`);

  lines.push('# HELP ask_captain_cache_hits_total Total cache hits');
  lines.push('# TYPE ask_captain_cache_hits_total counter');
  lines.push(`ask_captain_cache_hits_total ${performanceMetrics.cache.totalHits} ${now}`);

  lines.push('# HELP ask_captain_cache_misses_total Total cache misses');
  lines.push('# TYPE ask_captain_cache_misses_total counter');
  lines.push(`ask_captain_cache_misses_total ${performanceMetrics.cache.totalMisses} ${now}`);

  // Memory metrics
  lines.push('# HELP ask_captain_memory_usage_bytes Current memory usage in bytes');
  lines.push('# TYPE ask_captain_memory_usage_bytes gauge');
  lines.push(`ask_captain_memory_usage_bytes ${performanceMetrics.memory.averageUsage * 1024 * 1024} ${now}`);

  lines.push('# HELP ask_captain_memory_peak_bytes Peak memory usage in bytes');
  lines.push('# TYPE ask_captain_memory_peak_bytes gauge');
  lines.push(`ask_captain_memory_peak_bytes ${performanceMetrics.memory.peakUsage * 1024 * 1024} ${now}`);

  lines.push('# HELP ask_captain_memory_utilization_percent Memory utilization percentage');
  lines.push('# TYPE ask_captain_memory_utilization_percent gauge');
  lines.push(`ask_captain_memory_utilization_percent ${performanceMetrics.memory.utilizationPercent} ${now}`);

  // Usage metrics
  lines.push('# HELP ask_captain_sessions_total Total number of user sessions');
  lines.push('# TYPE ask_captain_sessions_total counter');
  lines.push(`ask_captain_sessions_total ${usageSummary.overview.totalSessions} ${now}`);

  lines.push('# HELP ask_captain_messages_total Total number of chat messages');
  lines.push('# TYPE ask_captain_messages_total counter');
  lines.push(`ask_captain_messages_total ${usageSummary.overview.totalMessages} ${now}`);

  lines.push('# HELP ask_captain_images_generated_total Total number of images generated');
  lines.push('# TYPE ask_captain_images_generated_total counter');
  lines.push(`ask_captain_images_generated_total ${usageSummary.overview.totalImages} ${now}`);

  lines.push('# HELP ask_captain_searches_total Total number of search queries');
  lines.push('# TYPE ask_captain_searches_total counter');
  lines.push(`ask_captain_searches_total ${usageSummary.overview.totalSearches} ${now}`);

  lines.push('# HELP ask_captain_active_users Current number of active users');
  lines.push('# TYPE ask_captain_active_users gauge');
  lines.push(`ask_captain_active_users ${usageSummary.engagement.activeUsers} ${now}`);

  lines.push('# HELP ask_captain_session_duration_seconds Average session duration in seconds');
  lines.push('# TYPE ask_captain_session_duration_seconds gauge');
  lines.push(`ask_captain_session_duration_seconds ${usageSummary.overview.averageSessionDuration / 1000} ${now}`);

  lines.push('# HELP ask_captain_bounce_rate Session bounce rate');
  lines.push('# TYPE ask_captain_bounce_rate gauge');
  lines.push(`ask_captain_bounce_rate ${usageSummary.overview.bounceRate} ${now}`);

  // Geographic distribution
  usageSummary.geography.topCountries.forEach(({ country, sessions }) => {
    lines.push(`ask_captain_sessions_total{country="${country}"} ${sessions} ${now}`);
  });

  usageSummary.geography.topColos.forEach(({ colo, sessions }) => {
    lines.push(`ask_captain_sessions_total{colo="${colo}"} ${sessions} ${now}`);
  });

  // System info
  lines.push('# HELP ask_captain_build_info Build information');
  lines.push('# TYPE ask_captain_build_info gauge');
  lines.push(`ask_captain_build_info{version="${process.env.npm_package_version || 'unknown'}",environment="${process.env.NODE_ENV || 'unknown'}"} 1 ${now}`);

  return lines.join('\n') + '\n';
}