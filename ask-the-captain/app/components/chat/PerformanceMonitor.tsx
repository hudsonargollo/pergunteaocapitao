'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, BarChart3, Cpu, HardDrive, Zap } from 'lucide-react'

interface PerformanceStats {
  fps: number
  memoryUsage: number
  renderMode: 'full' | 'virtual' | 'windowed'
  totalMessages: number
  renderedMessages: number
  cacheHitRate: number
  apiResponseTime: number
  imageLoadTime: number
}

interface PerformanceMonitorProps {
  stats: PerformanceStats
  isVisible?: boolean
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  className?: string
}

export function PerformanceMonitor({ 
  stats, 
  isVisible = false, 
  position = 'bottom-right',
  className = '' 
}: PerformanceMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [historicalData, setHistoricalData] = useState<PerformanceStats[]>([])

  // Track performance history
  useEffect(() => {
    setHistoricalData(prev => {
      const newData = [...prev, stats].slice(-20) // Keep last 20 data points
      return newData
    })
  }, [stats])

  // Calculate performance score
  const performanceScore = React.useMemo(() => {
    const fpsScore = Math.min(stats.fps / 60, 1) * 30
    const memoryScore = Math.max(1 - stats.memoryUsage, 0) * 25
    const efficiencyScore = (stats.cacheHitRate / 100) * 20
    const responseScore = Math.max(1 - (stats.apiResponseTime / 2000), 0) * 25
    
    return Math.round(fpsScore + memoryScore + efficiencyScore + responseScore)
  }, [stats])

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
      default:
        return 'bottom-4 right-4'
    }
  }

  if (!isVisible) return null

  return (
    <div className={`fixed ${getPositionClasses()} z-50 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-cave-dark/90 backdrop-blur-sm border border-cave-stone/30 rounded-lg shadow-lg"
      >
        {/* Collapsed View */}
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 p-3 text-cave-off-white hover:text-cave-white transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Activity className="w-4 h-4" />
          <span className={`text-sm font-medium ${getPerformanceColor(performanceScore)}`}>
            {performanceScore}%
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <BarChart3 className="w-4 h-4" />
          </motion.div>
        </motion.button>

        {/* Expanded View */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-cave-stone/30 overflow-hidden"
            >
              <div className="p-4 space-y-3 min-w-[280px]">
                {/* Performance Score */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cave-mist">Performance Score</span>
                  <span className={`text-lg font-bold ${getPerformanceColor(performanceScore)}`}>
                    {performanceScore}%
                  </span>
                </div>

                {/* FPS */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-cave-ember" />
                    <span className="text-sm text-cave-mist">FPS</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    stats.fps >= 55 ? 'text-green-400' : 
                    stats.fps >= 30 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {stats.fps}
                  </span>
                </div>

                {/* Memory Usage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3 h-3 text-cave-ember" />
                    <span className="text-sm text-cave-mist">Memory</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    stats.memoryUsage < 0.6 ? 'text-green-400' : 
                    stats.memoryUsage < 0.8 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {(stats.memoryUsage * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Render Mode */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3 h-3 text-cave-ember" />
                    <span className="text-sm text-cave-mist">Render Mode</span>
                  </div>
                  <span className="text-sm font-medium text-cave-white capitalize">
                    {stats.renderMode}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cave-mist">Messages</span>
                  <span className="text-sm font-medium text-cave-white">
                    {stats.renderedMessages}/{stats.totalMessages}
                  </span>
                </div>

                {/* Cache Hit Rate */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cave-mist">Cache Hit Rate</span>
                  <span className={`text-sm font-medium ${
                    stats.cacheHitRate >= 80 ? 'text-green-400' : 
                    stats.cacheHitRate >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {stats.cacheHitRate.toFixed(1)}%
                  </span>
                </div>

                {/* API Response Time */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cave-mist">API Response</span>
                  <span className={`text-sm font-medium ${
                    stats.apiResponseTime < 1000 ? 'text-green-400' : 
                    stats.apiResponseTime < 2000 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {stats.apiResponseTime}ms
                  </span>
                </div>

                {/* Performance Trend */}
                {historicalData.length > 5 && (
                  <div className="pt-2 border-t border-cave-stone/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-cave-mist">Performance Trend</span>
                    </div>
                    <div className="flex items-end gap-1 h-8">
                      {historicalData.slice(-10).map((data, index) => {
                        const score = Math.min(data.fps / 60, 1) * 100
                        return (
                          <div
                            key={index}
                            className={`flex-1 rounded-t ${
                              score >= 80 ? 'bg-green-400/60' : 
                              score >= 60 ? 'bg-yellow-400/60' : 'bg-red-400/60'
                            }`}
                            style={{ height: `${Math.max(score, 10)}%` }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Optimization Suggestions */}
                {performanceScore < 70 && (
                  <div className="pt-2 border-t border-cave-stone/30">
                    <div className="text-xs text-cave-mist mb-1">Suggestions:</div>
                    <div className="text-xs text-yellow-400 space-y-1">
                      {stats.fps < 30 && <div>• Reduce animation complexity</div>}
                      {stats.memoryUsage > 0.8 && <div>• Clear message history</div>}
                      {stats.cacheHitRate < 50 && <div>• Optimize caching strategy</div>}
                      {stats.apiResponseTime > 2000 && <div>• Check network connection</div>}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default PerformanceMonitor