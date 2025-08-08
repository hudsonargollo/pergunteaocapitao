'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface PerformanceMetrics {
  fps: number
  frameTime: number
  isOptimal: boolean
  droppedFrames: number
  totalFrames: number
}

interface AnimationPerformanceOptions {
  targetFPS?: number
  monitoringDuration?: number
  enableLogging?: boolean
  onPerformanceChange?: (metrics: PerformanceMetrics) => void
}

export function useAnimationPerformance(options: AnimationPerformanceOptions = {}) {
  const {
    targetFPS = 60,
    monitoringDuration = 5000, // 5 seconds
    enableLogging = false,
    onPerformanceChange
  } = options

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    isOptimal: true,
    droppedFrames: 0,
    totalFrames: 0
  })

  const [isMonitoring, setIsMonitoring] = useState(false)
  const frameCountRef = useRef(0)
  const droppedFramesRef = useRef(0)
  const lastTimeRef = useRef(0)
  const startTimeRef = useRef(0)
  const animationFrameRef = useRef<number>()

  const measureFrame = useCallback((currentTime: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = currentTime
      lastTimeRef.current = currentTime
    }

    const deltaTime = currentTime - lastTimeRef.current
    const expectedFrameTime = 1000 / targetFPS

    frameCountRef.current++

    // Check if frame was dropped (took longer than expected)
    if (deltaTime > expectedFrameTime * 1.5) {
      droppedFramesRef.current++
    }

    // Calculate metrics every 100 frames or at the end of monitoring
    if (frameCountRef.current % 100 === 0 || 
        currentTime - startTimeRef.current >= monitoringDuration) {
      
      const totalTime = currentTime - startTimeRef.current
      const actualFPS = (frameCountRef.current / totalTime) * 1000
      const avgFrameTime = totalTime / frameCountRef.current
      const isOptimal = actualFPS >= targetFPS * 0.9 && droppedFramesRef.current < frameCountRef.current * 0.1

      const newMetrics: PerformanceMetrics = {
        fps: Math.round(actualFPS),
        frameTime: Math.round(avgFrameTime * 100) / 100,
        isOptimal,
        droppedFrames: droppedFramesRef.current,
        totalFrames: frameCountRef.current
      }

      setMetrics(newMetrics)
      onPerformanceChange?.(newMetrics)

      if (enableLogging) {
        console.log('Animation Performance:', newMetrics)
      }

      // Stop monitoring after duration
      if (currentTime - startTimeRef.current >= monitoringDuration) {
        setIsMonitoring(false)
        return
      }
    }

    lastTimeRef.current = currentTime
    
    if (isMonitoring) {
      animationFrameRef.current = requestAnimationFrame(measureFrame)
    }
  }, [targetFPS, monitoringDuration, enableLogging, onPerformanceChange, isMonitoring])

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return

    // Reset counters
    frameCountRef.current = 0
    droppedFramesRef.current = 0
    startTimeRef.current = 0
    lastTimeRef.current = 0

    setIsMonitoring(true)
    animationFrameRef.current = requestAnimationFrame(measureFrame)
  }, [measureFrame, isMonitoring])

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Auto-start monitoring when component mounts
  useEffect(() => {
    startMonitoring()
    return stopMonitoring
  }, [startMonitoring, stopMonitoring])

  return {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring
  }
}

// Hook for optimizing component re-renders
export function useOptimizedRerender<T>(value: T, delay: number = 16): T {
  const [optimizedValue, setOptimizedValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setOptimizedValue(value)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay])

  return optimizedValue
}

// Hook for detecting device performance capabilities
export function useDevicePerformance() {
  const [deviceCapabilities, setDeviceCapabilities] = useState({
    isHighPerformance: true,
    supportedAnimations: 'full' as 'full' | 'reduced' | 'minimal',
    recommendedSettings: {
      enableBlur: true,
      enableShadows: true,
      enableComplexAnimations: true,
      maxConcurrentAnimations: 10
    }
  })

  useEffect(() => {
    const detectCapabilities = () => {
      // Check hardware concurrency (CPU cores)
      const cores = navigator.hardwareConcurrency || 4
      
      // Check memory (if available)
      const memory = (navigator as any).deviceMemory || 4
      
      // Check connection speed
      const connection = (navigator as any).connection
      const effectiveType = connection?.effectiveType || '4g'
      
      // Determine performance level
      const isHighPerformance = cores >= 4 && memory >= 4 && effectiveType !== 'slow-2g'
      const isMediumPerformance = cores >= 2 && memory >= 2
      
      let supportedAnimations: 'full' | 'reduced' | 'minimal' = 'full'
      let recommendedSettings = {
        enableBlur: true,
        enableShadows: true,
        enableComplexAnimations: true,
        maxConcurrentAnimations: 10
      }

      if (!isHighPerformance) {
        if (isMediumPerformance) {
          supportedAnimations = 'reduced'
          recommendedSettings = {
            enableBlur: true,
            enableShadows: false,
            enableComplexAnimations: false,
            maxConcurrentAnimations: 5
          }
        } else {
          supportedAnimations = 'minimal'
          recommendedSettings = {
            enableBlur: false,
            enableShadows: false,
            enableComplexAnimations: false,
            maxConcurrentAnimations: 2
          }
        }
      }

      setDeviceCapabilities({
        isHighPerformance,
        supportedAnimations,
        recommendedSettings
      })
    }

    detectCapabilities()
  }, [])

  return deviceCapabilities
}