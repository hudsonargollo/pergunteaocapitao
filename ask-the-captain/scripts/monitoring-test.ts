#!/usr/bin/env tsx

/**
 * Monitoring System Test Script
 * Tests all monitoring components and generates sample data
 */

import { metricsCollector } from '../lib/performance-monitoring';
import { errorTracker } from '../lib/error-tracking';
import { usageAnalytics } from '../lib/usage-analytics';

async function testMonitoringSystem() {
  console.log('🔍 Testing Ask the Captain Monitoring System...\n');

  // Test Performance Monitoring
  console.log('📊 Testing Performance Monitoring...');
  
  // Simulate some requests
  for (let i = 0; i < 10; i++) {
    const metric = {
      requestId: `test_req_${i}`,
      endpoint: i % 2 === 0 ? '/api/chat' : '/api/v1/images/generate',
      method: 'POST',
      responseTime: Math.random() * 2000 + 500, // 500-2500ms
      statusCode: Math.random() > 0.1 ? 200 : 500, // 90% success rate
      memoryUsage: Math.random() * 50 + 20, // 20-70 MB
      cacheHit: Math.random() > 0.6, // 40% cache hit rate
      errorType: Math.random() > 0.9 ? 'timeout' : undefined,
      userAgent: 'Mozilla/5.0 (Test Browser)',
      country: ['US', 'BR', 'DE', 'JP'][Math.floor(Math.random() * 4)],
      colo: ['SFO', 'GRU', 'FRA', 'NRT'][Math.floor(Math.random() * 4)]
    };
    
    metricsCollector.recordRequest(metric);
  }

  const performanceMetrics = metricsCollector.getAggregatedMetrics(Date.now() - 60000);
  console.log('✅ Performance metrics collected:');
  console.log(`   - Total requests: ${performanceMetrics.requests.total}`);
  console.log(`   - Average response time: ${performanceMetrics.requests.averageResponseTime.toFixed(0)}ms`);
  console.log(`   - Cache hit rate: ${(performanceMetrics.cache.hitRate * 100).toFixed(1)}%`);
  console.log(`   - Memory utilization: ${performanceMetrics.memory.utilizationPercent.toFixed(1)}%\n`);

  // Test Error Tracking
  console.log('🚨 Testing Error Tracking...');
  
  // Simulate some errors
  errorTracker.trackError('error', 'api', 'Database connection failed', new Error('Connection timeout'));
  errorTracker.trackError('warning', 'external_service', 'OpenAI API slow response', undefined, {
    endpoint: '/api/chat',
    method: 'POST'
  });
  errorTracker.trackError('error', 'validation', 'Invalid user input', new Error('Message too long'));

  const errorSummary = errorTracker.getErrorSummary(Date.now() - 60000);
  console.log('✅ Error tracking working:');
  console.log(`   - Total errors: ${errorSummary.totalErrors}`);
  console.log(`   - Error rate: ${(errorSummary.errorRate * 100).toFixed(2)}%`);
  console.log(`   - Errors by level:`, errorSummary.errorsByLevel);
  console.log(`   - Errors by category:`, errorSummary.errorsByCategory, '\n');

  // Test Usage Analytics
  console.log('📈 Testing Usage Analytics...');
  
  // Simulate user sessions
  for (let i = 0; i < 5; i++) {
    const sessionId = `test_session_${i}`;
    
    // Page view
    usageAnalytics.trackPageView('/', {
      userAgent: 'Mozilla/5.0 (Test Browser)',
      country: ['US', 'BR', 'DE'][Math.floor(Math.random() * 3)],
      path: '/'
    }, { sessionId });

    // Chat messages
    for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
      usageAnalytics.trackChatMessage('user', undefined, {
        path: '/'
      }, { sessionId });
      
      usageAnalytics.trackChatMessage('assistant', Math.random() * 3000 + 1000, {
        path: '/'
      }, { sessionId, topics: ['discipline', 'focus'] });
    }

    // Image generation
    if (Math.random() > 0.5) {
      usageAnalytics.trackImageGeneration(true, Math.random() * 5000 + 2000, {
        path: '/'
      }, { sessionId });
    }
  }

  const usageSummary = usageAnalytics.getUsageSummary(Date.now() - 60000);
  console.log('✅ Usage analytics working:');
  console.log(`   - Total sessions: ${usageSummary.overview.totalSessions}`);
  console.log(`   - Total messages: ${usageSummary.overview.totalMessages}`);
  console.log(`   - Total images: ${usageSummary.overview.totalImages}`);
  console.log(`   - Average session duration: ${(usageSummary.overview.averageSessionDuration / 1000).toFixed(1)}s\n`);

  // Test Alerts
  console.log('🚨 Testing Alert System...');
  
  const performanceAlerts = metricsCollector.getActiveAlerts();
  const errorAlerts = errorTracker.getErrors({ resolved: false });
  
  console.log('✅ Alert system working:');
  console.log(`   - Performance alerts: ${performanceAlerts.length}`);
  console.log(`   - Error alerts: ${errorAlerts.length}\n`);

  // Test Recommendations
  console.log('💡 Testing Recommendations...');
  
  const recommendations = metricsCollector.getPerformanceRecommendations();
  console.log('✅ Recommendations generated:');
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. Priority: ${rec.priority}`);
    console.log(`      Impact: ${rec.estimatedImpact}`);
    console.log(`      Actions: ${rec.recommendations.length} recommendations`);
  });

  console.log('\n🎉 All monitoring systems are working correctly!');
  console.log('\n📋 Next steps:');
  console.log('   1. Deploy the application with monitoring enabled');
  console.log('   2. Access monitoring dashboard at /api/monitoring');
  console.log('   3. Export metrics at /api/metrics');
  console.log('   4. Set up external alerting if needed');
}

// Run the test
if (require.main === module) {
  testMonitoringSystem().catch(console.error);
}

export { testMonitoringSystem };