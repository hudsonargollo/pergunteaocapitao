/**
 * Monitoring Dashboard API Endpoint
 * Provides comprehensive monitoring data for system observability
 */

import { NextRequest, NextResponse } from 'next/server'
import { enhancedMonitoring } from '@/lib/enhanced-monitoring-middleware'
import { metricsCollector } from '@/lib/performance-monitoring'
import { usageAnalytics } from '@/lib/usage-analytics'
import { errorTracker } from '@/lib/error-tracking'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse time range parameters
    const timeRangeParam = searchParams.get('timeRange') || '1h'
    const startTimeParam = searchParams.get('startTime')
    const endTimeParam = searchParams.get('endTime')
    
    let startTime: number
    let endTime: number = Date.now()
    
    if (startTimeParam && endTimeParam) {
      startTime = parseInt(startTimeParam)
      endTime = parseInt(endTimeParam)
    } else {
      // Parse relative time range
      const timeRangeMap: Record<string, number> = {
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      }
      
      const duration = timeRangeMap[timeRangeParam] || timeRangeMap['1h']
      startTime = endTime - duration
    }

    // Get dashboard data
    const dashboardData = await enhancedMonitoring.getDashboardData({
      start: startTime,
      end: endTime
    })

    // Add real-time system status
    const systemStatus = {
      timestamp: Date.now(),
      uptime: process.uptime ? process.uptime() * 1000 : 0,
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      region: process.env.CF_REGION || 'unknown'
    }

    return NextResponse.json({
      success: true,
      data: {
        ...dashboardData,
        system: systemStatus
      }
    })

  } catch (error) {
    console.error('Dashboard API error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'export':
        return handleExport(params)
      
      case 'alert':
        return handleAlert(params)
      
      case 'resolve_error':
        return handleResolveError(params)
      
      default:
        return NextResponse.json({
          success: false,
          error: { message: 'Invalid action' }
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Dashboard POST error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

async function handleExport(params: {
  format: 'json' | 'csv'
  type: 'performance' | 'usage' | 'errors' | 'all'
  timeRange?: { start: number; end: number }
}) {
  const { format, type, timeRange } = params

  let exportData: any

  switch (type) {
    case 'performance':
      exportData = metricsCollector.exportMetrics(format, timeRange?.start, timeRange?.end)
      break
    
    case 'usage':
      exportData = usageAnalytics.exportAnalytics(format, timeRange?.start, timeRange?.end)
      break
    
    case 'errors':
      exportData = errorTracker.exportErrors(format, {
        startTime: timeRange?.start,
        endTime: timeRange?.end
      })
      break
    
    case 'all':
      exportData = await enhancedMonitoring.exportMonitoringData(format, timeRange)
      break
    
    default:
      return NextResponse.json({
        success: false,
        error: { message: 'Invalid export type' }
      }, { status: 400 })
  }

  const filename = `monitoring-${type}-${Date.now()}.${format}`
  const contentType = format === 'json' ? 'application/json' : 'text/csv'

  return new NextResponse(exportData, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}

async function handleAlert(params: {
  rule: {
    name: string
    condition: {
      type: 'error_rate' | 'error_count' | 'specific_error' | 'error_spike'
      threshold: number
      timeWindow: number
      category?: string
      level?: string
      pattern?: string
    }
    actions: {
      type: 'log' | 'webhook' | 'email'
      config: Record<string, any>
    }[]
  }
}) {
  const { rule } = params

  const alertId = errorTracker.addAlertRule({
    name: rule.name,
    condition: rule.condition,
    actions: rule.actions,
    enabled: true
  })

  return NextResponse.json({
    success: true,
    data: { alertId }
  })
}

async function handleResolveError(params: { errorId: string }) {
  const { errorId } = params

  const resolved = errorTracker.resolveError(errorId)

  return NextResponse.json({
    success: resolved,
    data: { resolved }
  })
}