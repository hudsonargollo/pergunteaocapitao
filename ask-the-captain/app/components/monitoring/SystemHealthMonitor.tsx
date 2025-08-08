/**
 * System Health Monitor Component
 * Real-time system health monitoring and alerting
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Database,
  Zap,
  Globe,
  Users,
  MessageSquare,
  Image as ImageIcon,
  Search,
  Download
} from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  memoryUsage: number
  memoryUtilization: number
  issues: string[]
}

interface PerformanceMetrics {
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
}

interface UsageMetrics {
  overview: {
    totalSessions: number
    totalMessages: number
    totalImages: number
    totalSearches: number
    averageSessionDuration: number
    averageMessagesPerSession: number
    bounceRate: number
  }
  engagement: {
    activeUsers: number
    returningUsers: number
    newUsers: number
  }
}

interface MonitoringData {
  timeRange: { start: number; end: number }
  performance: PerformanceMetrics | null
  usage: UsageMetrics | null
  errors: any
  alerts: any[]
  recommendations: any[]
  systemHealth: SystemHealth
  system: {
    timestamp: number
    uptime: number
    version: string
    environment: string
    region: string
  }
}

interface SystemHealthMonitorProps {
  refreshInterval?: number
  className?: string
  compact?: boolean
}

export function SystemHealthMonitor({ 
  refreshInterval = 30000, 
  className,
  compact = false 
}: SystemHealthMonitorProps) {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('1h')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchMonitoringData = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitoring/dashboard?timeRange=${timeRange}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      if (result.success) {
        setData(result.data)
        setError(null)
      } else {
        throw new Error(result.error?.message || 'Failed to fetch monitoring data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch monitoring data:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchMonitoringData()
  }, [fetchMonitoringData])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchMonitoringData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchMonitoringData, refreshInterval, autoRefresh])

  const exportData = async (format: 'json' | 'csv', type: 'all' | 'performance' | 'usage' | 'errors') => {
    try {
      const response = await fetch('/api/monitoring/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          format,
          type,
          timeRange: data?.timeRange
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `monitoring-${type}-${Date.now()}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Failed to export data:', err)
    }
  }

  if (loading) {
    return (
      <div className={cn("cave-glass p-6 rounded-2xl", className)}>
        <div className="flex items-center justify-center space-x-2">
          <motion.div
            className="w-4 h-4 bg-cave-red rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-cave-off-white">Loading system health...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("cave-glass p-6 rounded-2xl border-red-500/20", className)}>
        <div className="flex items-center space-x-2 text-red-400">
          <XCircle className="w-5 h-5" />
          <span>Failed to load monitoring data: {error}</span>
        </div>
        <button
          onClick={fetchMonitoringData}
          className="mt-4 cave-button-secondary text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-400" />
      default:
        return <Activity className="w-5 h-5 text-cave-mist" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400'
      case 'degraded':
        return 'text-yellow-400'
      case 'unhealthy':
        return 'text-red-400'
      default:
        return 'text-cave-mist'
    }
  }

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / (1000 * 60 * 60))
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (compact) {
    return (
      <div className={cn("cave-glass p-4 rounded-xl", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(data.systemHealth.status)}
            <div>
              <div className={cn("font-medium", getStatusColor(data.systemHealth.status))}>
                {data.systemHealth.status.charAt(0).toUpperCase() + data.systemHealth.status.slice(1)}
              </div>
              <div className="text-xs text-cave-mist">
                {data.performance?.requests.total || 0} requests
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-cave-off-white">
              {data.performance?.requests.averageResponseTime.toFixed(0)}ms
            </div>
            <div className="text-xs text-cave-mist">avg response</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="cave-glass p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon(data.systemHealth.status)}
            <div>
              <h2 className="text-xl font-semibold text-cave-white">System Health</h2>
              <p className="text-cave-mist">
                Last updated: {new Date(data.systemHealth.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="cave-input text-sm"
            >
              <option value="5m">Last 5 minutes</option>
              <option value="15m">Last 15 minutes</option>
              <option value="1h">Last hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "cave-button-ghost text-sm",
                autoRefresh ? "text-cave-red" : "text-cave-mist"
              )}
            >
              Auto Refresh
            </button>
            
            <button
              onClick={fetchMonitoringData}
              className="cave-button-secondary text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="cave-glass-subtle p-4 rounded-xl">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-4 h-4 text-cave-red" />
              <span className="text-sm font-medium text-cave-off-white">Status</span>
            </div>
            <div className={cn("text-lg font-semibold", getStatusColor(data.systemHealth.status))}>
              {data.systemHealth.status.charAt(0).toUpperCase() + data.systemHealth.status.slice(1)}
            </div>
            {data.systemHealth.issues.length > 0 && (
              <div className="mt-2 text-xs text-yellow-400">
                {data.systemHealth.issues.join(', ')}
              </div>
            )}
          </div>

          <div className="cave-glass-subtle p-4 rounded-xl">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-cave-ember" />
              <span className="text-sm font-medium text-cave-off-white">Uptime</span>
            </div>
            <div className="text-lg font-semibold text-cave-white">
              {formatUptime(data.system.uptime)}
            </div>
            <div className="text-xs text-cave-mist">
              {data.system.environment} • {data.system.region}
            </div>
          </div>

          <div className="cave-glass-subtle p-4 rounded-xl">
            <div className="flex items-center space-x-2 mb-2">
              <Database className="w-4 h-4 text-cave-torch" />
              <span className="text-sm font-medium text-cave-off-white">Memory</span>
            </div>
            <div className="text-lg font-semibold text-cave-white">
              {data.systemHealth.memoryUtilization.toFixed(1)}%
            </div>
            <div className="text-xs text-cave-mist">
              {data.systemHealth.memoryUsage.toFixed(1)} MB used
            </div>
          </div>

          <div className="cave-glass-subtle p-4 rounded-xl">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-cave-red" />
              <span className="text-sm font-medium text-cave-off-white">Response Time</span>
            </div>
            <div className="text-lg font-semibold text-cave-white">
              {data.performance?.requests.averageResponseTime.toFixed(0) || 0}ms
            </div>
            <div className="text-xs text-cave-mist">
              P95: {data.performance?.requests.p95ResponseTime.toFixed(0) || 0}ms
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      {data.performance && (
        <div className="cave-glass p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-cave-white mb-4">Performance Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm font-medium text-cave-off-white mb-3">Requests</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-cave-mist">Total</span>
                  <span className="text-cave-white">{formatNumber(data.performance.requests.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cave-mist">Successful</span>
                  <span className="text-green-400">{formatNumber(data.performance.requests.successful)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cave-mist">Failed</span>
                  <span className="text-red-400">{formatNumber(data.performance.requests.failed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cave-mist">Success Rate</span>
                  <span className="text-cave-white">
                    {((data.performance.requests.successful / data.performance.requests.total) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-cave-off-white mb-3">Cache</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-cave-mist">Hit Rate</span>
                  <span className="text-cave-white">{(data.performance.cache.hitRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cave-mist">Hits</span>
                  <span className="text-green-400">{formatNumber(data.performance.cache.totalHits)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cave-mist">Misses</span>
                  <span className="text-yellow-400">{formatNumber(data.performance.cache.totalMisses)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-cave-off-white mb-3">Errors</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-cave-mist">Total</span>
                  <span className="text-red-400">{formatNumber(data.performance.errors.totalErrors)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cave-mist">Error Rate</span>
                  <span className="text-red-400">{(data.performance.errors.errorRate * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Metrics */}
      {data.usage && (
        <div className="cave-glass p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-cave-white mb-4">Usage Analytics</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="cave-glass-subtle p-4 rounded-xl text-center">
              <Users className="w-6 h-6 text-cave-red mx-auto mb-2" />
              <div className="text-lg font-semibold text-cave-white">
                {formatNumber(data.usage.overview.totalSessions)}
              </div>
              <div className="text-xs text-cave-mist">Sessions</div>
            </div>

            <div className="cave-glass-subtle p-4 rounded-xl text-center">
              <MessageSquare className="w-6 h-6 text-cave-ember mx-auto mb-2" />
              <div className="text-lg font-semibold text-cave-white">
                {formatNumber(data.usage.overview.totalMessages)}
              </div>
              <div className="text-xs text-cave-mist">Messages</div>
            </div>

            <div className="cave-glass-subtle p-4 rounded-xl text-center">
              <ImageIcon className="w-6 h-6 text-cave-torch mx-auto mb-2" />
              <div className="text-lg font-semibold text-cave-white">
                {formatNumber(data.usage.overview.totalImages)}
              </div>
              <div className="text-xs text-cave-mist">Images</div>
            </div>

            <div className="cave-glass-subtle p-4 rounded-xl text-center">
              <Search className="w-6 h-6 text-cave-red mx-auto mb-2" />
              <div className="text-lg font-semibold text-cave-white">
                {formatNumber(data.usage.overview.totalSearches)}
              </div>
              <div className="text-xs text-cave-mist">Searches</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="cave-glass-subtle p-4 rounded-xl">
              <div className="text-sm font-medium text-cave-off-white mb-2">Avg Session Duration</div>
              <div className="text-lg font-semibold text-cave-white">
                {Math.round(data.usage.overview.averageSessionDuration / 1000 / 60)}m
              </div>
            </div>

            <div className="cave-glass-subtle p-4 rounded-xl">
              <div className="text-sm font-medium text-cave-off-white mb-2">Messages per Session</div>
              <div className="text-lg font-semibold text-cave-white">
                {data.usage.overview.averageMessagesPerSession.toFixed(1)}
              </div>
            </div>

            <div className="cave-glass-subtle p-4 rounded-xl">
              <div className="text-sm font-medium text-cave-off-white mb-2">Bounce Rate</div>
              <div className="text-lg font-semibold text-cave-white">
                {(data.usage.overview.bounceRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="cave-glass p-6 rounded-2xl border-yellow-500/20">
          <h3 className="text-lg font-semibold text-cave-white mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span>Active Alerts</span>
          </h3>
          
          <div className="space-y-3">
            {data.alerts.map((alert, index) => (
              <div key={index} className="cave-glass-subtle p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-cave-white">{alert.message}</div>
                    <div className="text-sm text-cave-mist">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    alert.severity === 'critical' ? "bg-red-500/20 text-red-400" :
                    alert.severity === 'high' ? "bg-orange-500/20 text-orange-400" :
                    alert.severity === 'medium' ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  )}>
                    {alert.severity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="cave-glass p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-cave-white mb-4">Export Data</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => exportData('json', 'all')}
            className="cave-button-secondary text-sm flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>All (JSON)</span>
          </button>
          
          <button
            onClick={() => exportData('csv', 'performance')}
            className="cave-button-secondary text-sm flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Performance</span>
          </button>
          
          <button
            onClick={() => exportData('csv', 'usage')}
            className="cave-button-secondary text-sm flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Usage</span>
          </button>
          
          <button
            onClick={() => exportData('csv', 'errors')}
            className="cave-button-secondary text-sm flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Errors</span>
          </button>
        </div>
      </div>
    </div>
  )
}