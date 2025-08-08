import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Health check endpoint for monitoring and deployment verification
 * Returns system status and basic connectivity checks
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { env } = await getCloudflareContext();
    
    // Basic health checks
    const healthChecks = {
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'unknown',
      status: 'healthy',
      checks: {
        // database: await checkDatabase(env),
        // vectorize: await checkVectorize(env),
        // r2: await checkR2(env),
        openai: await checkOpenAI(env),
      },
      responseTime: 0,
      version: process.env.npm_package_version || 'unknown',
    };

    // Calculate response time
    healthChecks.responseTime = Date.now() - startTime;

    // Determine overall status
    const allChecksHealthy = Object.values(healthChecks.checks).every(
      check => check.status === 'healthy'
    );

    if (!allChecksHealthy) {
      healthChecks.status = 'degraded';
    }

    const statusCode = healthChecks.status === 'healthy' ? 200 : 503;

    return NextResponse.json(healthChecks, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}

/**
 * Check D1 database connectivity
 */
async function checkDatabase(env: any): Promise<{ status: string; message?: string }> {
  try {
    if (!env.DB) {
      return { status: 'unhealthy', message: 'D1 database binding not found' };
    }

    // Simple query to check connectivity
    const result = await env.DB.prepare('SELECT 1 as test').first();
    
    if (result && result.test === 1) {
      return { status: 'healthy' };
    } else {
      return { status: 'unhealthy', message: 'Database query returned unexpected result' };
    }
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'Database check failed' 
    };
  }
}

/**
 * Check Vectorize index connectivity
 */
async function checkVectorize(env: any): Promise<{ status: string; message?: string }> {
  try {
    if (!env.VECTORIZE_INDEX) {
      return { status: 'unhealthy', message: 'Vectorize index binding not found' };
    }

    // Try to get index info (this is a lightweight operation)
    const indexInfo = await env.VECTORIZE_INDEX.describe();
    
    if (indexInfo) {
      return { status: 'healthy' };
    } else {
      return { status: 'unhealthy', message: 'Vectorize index not accessible' };
    }
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'Vectorize check failed' 
    };
  }
}

/**
 * Check R2 bucket connectivity
 */
async function checkR2(env: any): Promise<{ status: string; message?: string }> {
  try {
    if (!env.R2_BUCKET) {
      return { status: 'unhealthy', message: 'R2 bucket binding not found' };
    }

    // Try to list objects (with limit 1 to minimize cost)
    const objects = await env.R2_BUCKET.list({ limit: 1 });
    
    if (objects !== null) {
      return { status: 'healthy' };
    } else {
      return { status: 'unhealthy', message: 'R2 bucket not accessible' };
    }
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'R2 check failed' 
    };
  }
}

/**
 * Check OpenAI API connectivity
 */
async function checkOpenAI(env: any): Promise<{ status: string; message?: string }> {
  try {
    if (!env.OPENAI_API_KEY) {
      return { status: 'unhealthy', message: 'OpenAI API key not configured' };
    }

    // Make a minimal API call to check connectivity
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return { status: 'healthy' };
    } else {
      return { 
        status: 'unhealthy', 
        message: `OpenAI API returned ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'OpenAI API check failed' 
    };
  }
}

/**
 * HEAD request for simple uptime checks
 */
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

// Remove the duplicate GET function that was at line 197