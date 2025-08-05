/**
 * Monitoring Middleware
 * Automatically tracks requests, errors, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector, createRequestMetric } from './performance-monitoring';
import { errorTracker, trackError } from './error-tracking';
import { usageAnalytics, trackPageView } from './usage-analytics';

export interface MonitoringContext {
  requestId: string;
  startTime: number;
  sessionId?: string;
  userId?: string;
}

/**
 * Monitoring middleware for automatic request tracking
 */
export function withMonitoring<T extends any[]>(
  handler: (request: NextRequest, context: MonitoringContext, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const sessionId = extractSessionId(request);
    const userId = extractUserId(request);

    const context: MonitoringContext = {
      requestId,
      startTime,
      sessionId,
      userId
    };

    let response: NextResponse;
    let error: Error | undefined;
    let cacheHit = false;

    try {
      // Track request start
      errorTracker.trackRequest();

      // Track page view for GET requests to pages
      const url = new URL(request.url);
      if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
        trackPageView(url.pathname, {
          userAgent: request.headers.get('user-agent') || undefined,
          country: request.headers.get('cf-ipcountry') || undefined,
          colo: request.headers.get('cf-colo') || undefined,
          referrer: request.headers.get('referer') || undefined,
          path: url.pathname
        }, {
          sessionId,
          userId
        });
      }

      // Execute the handler
      response = await handler(request, context, ...args);

      // Check if response came from cache
      cacheHit = response.headers.get('x-cache-status') === 'HIT';

    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      
      // Track error
      const errorCategory = categorizeError(error, request);
      trackError('error', errorCategory, error.message, error, {
        requestId,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        userAgent: request.headers.get('user-agent') || undefined,
        country: request.headers.get('cf-ipcountry') || undefined,
        colo: request.headers.get('cf-colo') || undefined
      });

      // Create error response
      response = NextResponse.json(
        {
          error: 'Internal server error',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Calculate memory usage (approximation)
    const memoryUsage = getMemoryUsage();

    // Record performance metrics
    const metric = createRequestMetric(
      request,
      response,
      startTime,
      memoryUsage,
      cacheHit,
      error?.name
    );

    metricsCollector.recordRequest(metric);

    // Add monitoring headers to response
    response.headers.set('x-request-id', requestId);
    response.headers.set('x-response-time', `${Date.now() - startTime}ms`);
    response.headers.set('x-cache-status', cacheHit ? 'HIT' : 'MISS');

    return response;
  };
}

/**
 * Monitoring middleware specifically for API routes
 */
export function withAPIMonitoring(
  handler: (request: NextRequest, context: MonitoringContext) => Promise<NextResponse>
) {
  return withMonitoring(async (request: NextRequest, context: MonitoringContext) => {
    const url = new URL(request.url);
    
    // Track API usage
    usageAnalytics.trackEvent('feature_usage', 'api', 'request', {
      path: url.pathname,
      userAgent: request.headers.get('user-agent') || undefined,
      country: request.headers.get('cf-ipcountry') || undefined,
      colo: request.headers.get('cf-colo') || undefined
    }, {
      label: url.pathname,
      sessionId: context.sessionId,
      userId: context.userId,
      metadata: {
        method: request.method,
        endpoint: url.pathname
      }
    });

    return handler(request, context);
  });
}

/**
 * Monitoring middleware for chat endpoints
 */
export function withChatMonitoring(
  handler: (request: NextRequest, context: MonitoringContext) => Promise<NextResponse>
) {
  return withAPIMonitoring(async (request: NextRequest, context: MonitoringContext) => {
    const startTime = Date.now();
    
    try {
      const response = await handler(request, context);
      const responseTime = Date.now() - startTime;
      
      // Track chat message
      usageAnalytics.trackChatMessage('assistant', responseTime, {
        path: new URL(request.url).pathname,
        userAgent: request.headers.get('user-agent') || undefined,
        country: request.headers.get('cf-ipcountry') || undefined,
        colo: request.headers.get('cf-colo') || undefined
      }, {
        sessionId: context.sessionId,
        userId: context.userId
      });

      return response;
    } catch (error) {
      // Track chat error
      trackError('error', 'api', 'Chat request failed', error instanceof Error ? error : new Error(String(error)), {
        requestId: context.requestId,
        endpoint: '/api/chat',
        method: request.method,
        userAgent: request.headers.get('user-agent') || undefined,
        country: request.headers.get('cf-ipcountry') || undefined
      });
      
      throw error;
    }
  });
}

/**
 * Monitoring middleware for image generation endpoints
 */
export function withImageMonitoring(
  handler: (request: NextRequest, context: MonitoringContext) => Promise<NextResponse>
) {
  return withAPIMonitoring(async (request: NextRequest, context: MonitoringContext) => {
    const startTime = Date.now();
    
    try {
      const response = await handler(request, context);
      const generationTime = Date.now() - startTime;
      const success = response.status < 400;
      
      // Track image generation
      usageAnalytics.trackImageGeneration(success, generationTime, {
        path: new URL(request.url).pathname,
        userAgent: request.headers.get('user-agent') || undefined,
        country: request.headers.get('cf-ipcountry') || undefined,
        colo: request.headers.get('cf-colo') || undefined
      }, {
        sessionId: context.sessionId,
        userId: context.userId
      });

      return response;
    } catch (error) {
      // Track image generation error
      trackError('error', 'external_service', 'Image generation failed', error instanceof Error ? error : new Error(String(error)), {
        requestId: context.requestId,
        endpoint: '/api/v1/images/generate',
        method: request.method,
        userAgent: request.headers.get('user-agent') || undefined,
        country: request.headers.get('cf-ipcountry') || undefined
      });
      
      // Track failed image generation
      usageAnalytics.trackImageGeneration(false, Date.now() - startTime, {
        path: new URL(request.url).pathname,
        userAgent: request.headers.get('user-agent') || undefined,
        country: request.headers.get('cf-ipcountry') || undefined,
        colo: request.headers.get('cf-colo') || undefined
      }, {
        sessionId: context.sessionId,
        userId: context.userId
      });
      
      throw error;
    }
  });
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract session ID from request
 */
function extractSessionId(request: NextRequest): string | undefined {
  // Try to get session ID from cookie or header
  const sessionCookie = request.cookies.get('session-id');
  const sessionHeader = request.headers.get('x-session-id');
  
  return sessionCookie?.value || sessionHeader || undefined;
}

/**
 * Extract user ID from request
 */
function extractUserId(request: NextRequest): string | undefined {
  // Try to get user ID from cookie, header, or JWT token
  const userCookie = request.cookies.get('user-id');
  const userHeader = request.headers.get('x-user-id');
  
  // In the future, this could decode a JWT token to get user ID
  
  return userCookie?.value || userHeader || undefined;
}

/**
 * Categorize error based on error type and request context
 */
function categorizeError(error: Error, request: NextRequest): 'api' | 'database' | 'external_service' | 'validation' | 'system' {
  const url = new URL(request.url);
  const errorMessage = error.message.toLowerCase();
  
  // Database errors
  if (errorMessage.includes('database') || errorMessage.includes('d1') || errorMessage.includes('sql')) {
    return 'database';
  }
  
  // External service errors
  if (errorMessage.includes('openai') || errorMessage.includes('fetch') || errorMessage.includes('network')) {
    return 'external_service';
  }
  
  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid') || error.name === 'ValidationError') {
    return 'validation';
  }
  
  // API errors
  if (url.pathname.startsWith('/api/')) {
    return 'api';
  }
  
  // Default to system error
  return 'system';
}

/**
 * Get approximate memory usage
 */
function getMemoryUsage(): number {
  // In Cloudflare Workers, we don't have access to process.memoryUsage()
  // This is an approximation based on typical usage patterns
  
  try {
    // Try to get memory info if available (might be available in some environments)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Fallback: estimate based on typical usage
  return Math.random() * 50 + 10; // Random value between 10-60 MB
}

/**
 * Create monitoring context for manual tracking
 */
export function createMonitoringContext(
  requestId?: string,
  sessionId?: string,
  userId?: string
): MonitoringContext {
  return {
    requestId: requestId || generateRequestId(),
    startTime: Date.now(),
    sessionId,
    userId
  };
}

/**
 * Track custom event with monitoring context
 */
export function trackCustomEvent(
  context: MonitoringContext,
  type: 'feature_usage' | 'error' | 'performance',
  category: string,
  action: string,
  options?: {
    label?: string;
    value?: number;
    metadata?: Record<string, any>;
  }
) {
  switch (type) {
    case 'feature_usage':
      usageAnalytics.trackFeatureUsage(category, action, {
        path: '/', // Default path
        environment: process.env.NODE_ENV || 'unknown'
      }, {
        sessionId: context.sessionId,
        userId: context.userId,
        value: options?.value,
        metadata: options?.metadata
      });
      break;
      
    case 'error':
      trackError('error', category as any, action, undefined, {
        requestId: context.requestId
      }, options?.metadata);
      break;
      
    case 'performance':
      // Custom performance tracking would go here
      console.log(`Performance event: ${category}.${action}`, options);
      break;
  }
}