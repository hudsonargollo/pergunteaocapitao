'use client'

import { useCallback, useRef, useMemo } from 'react'

interface APIRequest {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
}

interface APIResponse<T = any> {
  data: T
  status: number
  headers: Headers
  cached: boolean
}

interface RequestCache<T = any> {
  data: T
  timestamp: number
  etag?: string
  maxAge: number
}

interface PendingRequest<T = any> {
  promise: Promise<APIResponse<T>>
  timestamp: number
}

interface APIManagerOptions {
  enableCaching: boolean
  defaultCacheTime: number // in milliseconds
  enableDeduplication: boolean
  maxConcurrentRequests: number
  retryAttempts: number
  retryDelay: number
}

const defaultOptions: APIManagerOptions = {
  enableCaching: true,
  defaultCacheTime: 5 * 60 * 1000, // 5 minutes
  enableDeduplication: true,
  maxConcurrentRequests: 6,
  retryAttempts: 3,
  retryDelay: 1000
}

export function useEfficientAPIManager(options: Partial<APIManagerOptions> = {}) {
  const config = { ...defaultOptions, ...options }
  
  // Cache for storing API responses
  const cacheRef = useRef<Map<string, RequestCache>>(new Map())
  
  // Track pending requests to avoid duplicates
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map())
  
  // Track active request count for concurrency control
  const activeRequestsRef = useRef<number>(0)
  
  // Queue for requests waiting due to concurrency limits
  const requestQueueRef = useRef<Array<{
    request: APIRequest
    resolve: (value: APIResponse) => void
    reject: (error: any) => void
    cacheKey: string
    retryCount: number
  }>>([])

  // Generate cache key for request
  const getCacheKey = useCallback((request: APIRequest): string => {
    const { endpoint, method, body, headers } = request
    return `${method}:${endpoint}:${JSON.stringify(body)}:${JSON.stringify(headers)}`
  }, [])

  // Check if cached response is still valid
  const isCacheValid = useCallback((cached: RequestCache): boolean => {
    return Date.now() - cached.timestamp < cached.maxAge
  }, [])

  // Get cached response if available and valid
  const getCachedResponse = useCallback((cacheKey: string): APIResponse | null => {
    if (!config.enableCaching) return null
    
    const cached = cacheRef.current.get(cacheKey)
    if (cached && isCacheValid(cached)) {
      return {
        data: cached.data,
        status: 200,
        headers: new Headers(),
        cached: true
      }
    }
    
    // Remove expired cache entry
    if (cached) {
      cacheRef.current.delete(cacheKey)
    }
    
    return null
  }, [config.enableCaching, isCacheValid])

  // Cache response
  const setCachedResponse = useCallback((
    cacheKey: string, 
    response: APIResponse, 
    maxAge: number = config.defaultCacheTime
  ) => {
    if (!config.enableCaching) return
    
    // Don't cache error responses
    if (response.status >= 400) return
    
    cacheRef.current.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
      etag: response.headers.get('etag') || undefined,
      maxAge
    })
    
    // Cleanup old cache entries if cache gets too large
    if (cacheRef.current.size > 200) {
      const entries = Array.from(cacheRef.current.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      // Remove oldest 50 entries
      for (let i = 0; i < 50; i++) {
        cacheRef.current.delete(entries[i][0])
      }
    }
  }, [config.enableCaching, config.defaultCacheTime])

  // Process queued requests
  const processQueue = useCallback(() => {
    while (requestQueueRef.current.length > 0 && 
           activeRequestsRef.current < config.maxConcurrentRequests) {
      
      const queuedRequest = requestQueueRef.current.shift()
      if (queuedRequest) {
        executeRequest(queuedRequest)
      }
    }
  }, [config.maxConcurrentRequests])

  // Execute actual HTTP request
  const executeRequest = useCallback(async (requestData: {
    request: APIRequest
    resolve: (value: APIResponse) => void
    reject: (error: any) => void
    cacheKey: string
    retryCount: number
  }) => {
    const { request, resolve, reject, cacheKey, retryCount } = requestData
    
    activeRequestsRef.current++
    
    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers
        }
      }
      
      if (request.body && request.method !== 'GET') {
        fetchOptions.body = JSON.stringify(request.body)
      }
      
      const response = await fetch(request.endpoint, fetchOptions)
      
      let data: any
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }
      
      const apiResponse: APIResponse = {
        data,
        status: response.status,
        headers: response.headers,
        cached: false
      }
      
      if (response.ok) {
        // Cache successful responses
        setCachedResponse(cacheKey, apiResponse)
        resolve(apiResponse)
      } else {
        // Handle HTTP errors
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
        ;(error as any).response = apiResponse
        reject(error)
      }
      
    } catch (error) {
      // Retry logic for network errors
      if (retryCount < config.retryAttempts && 
          (error instanceof TypeError || // Network error
           (error as any).name === 'AbortError')) {
        
        setTimeout(() => {
          executeRequest({
            ...requestData,
            retryCount: retryCount + 1
          })
        }, config.retryDelay * Math.pow(2, retryCount)) // Exponential backoff
        
        return
      }
      
      reject(error)
    } finally {
      activeRequestsRef.current--
      pendingRequestsRef.current.delete(cacheKey)
      
      // Process any queued requests
      setTimeout(processQueue, 0)
    }
  }, [config.retryAttempts, config.retryDelay, setCachedResponse, processQueue])

  // Main request method
  const makeRequest = useCallback(<T = any>(request: APIRequest): Promise<APIResponse<T>> => {
    const cacheKey = getCacheKey(request)
    
    // Check cache first
    const cached = getCachedResponse(cacheKey)
    if (cached) {
      return Promise.resolve(cached as APIResponse<T>)
    }
    
    // Check for pending duplicate request
    if (config.enableDeduplication) {
      const pending = pendingRequestsRef.current.get(cacheKey)
      if (pending) {
        return pending.promise as Promise<APIResponse<T>>
      }
    }
    
    // Create new request promise
    const requestPromise = new Promise<APIResponse<T>>((resolve, reject) => {
      const requestData = {
        request,
        resolve: resolve as (value: APIResponse) => void,
        reject,
        cacheKey,
        retryCount: 0
      }
      
      // Check concurrency limits
      if (activeRequestsRef.current >= config.maxConcurrentRequests) {
        // Queue the request
        requestQueueRef.current.push(requestData)
      } else {
        // Execute immediately
        executeRequest(requestData)
      }
    })
    
    // Track pending request
    if (config.enableDeduplication) {
      pendingRequestsRef.current.set(cacheKey, {
        promise: requestPromise as Promise<APIResponse>,
        timestamp: Date.now()
      })
    }
    
    return requestPromise
  }, [getCacheKey, getCachedResponse, config.enableDeduplication, config.maxConcurrentRequests, executeRequest])

  // Convenience methods for common HTTP methods
  const get = useCallback(<T = any>(endpoint: string, headers?: Record<string, string>): Promise<APIResponse<T>> => {
    return makeRequest<T>({ endpoint, method: 'GET', headers })
  }, [makeRequest])

  const post = useCallback(<T = any>(
    endpoint: string, 
    body?: any, 
    headers?: Record<string, string>
  ): Promise<APIResponse<T>> => {
    return makeRequest<T>({ endpoint, method: 'POST', body, headers })
  }, [makeRequest])

  const put = useCallback(<T = any>(
    endpoint: string, 
    body?: any, 
    headers?: Record<string, string>
  ): Promise<APIResponse<T>> => {
    return makeRequest<T>({ endpoint, method: 'PUT', body, headers })
  }, [makeRequest])

  const del = useCallback(<T = any>(endpoint: string, headers?: Record<string, string>): Promise<APIResponse<T>> => {
    return makeRequest<T>({ endpoint, method: 'DELETE', headers })
  }, [makeRequest])

  // Cache management methods
  const clearCache = useCallback((pattern?: string) => {
    if (pattern) {
      // Clear cache entries matching pattern
      const regex = new RegExp(pattern)
      for (const [key] of cacheRef.current.entries()) {
        if (regex.test(key)) {
          cacheRef.current.delete(key)
        }
      }
    } else {
      // Clear all cache
      cacheRef.current.clear()
    }
  }, [])

  const invalidateCache = useCallback((endpoint: string) => {
    const pattern = `(GET|POST|PUT|DELETE):${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
    clearCache(pattern)
  }, [clearCache])

  // Get performance statistics
  const getStats = useCallback(() => ({
    cacheSize: cacheRef.current.size,
    pendingRequests: pendingRequestsRef.current.size,
    activeRequests: activeRequestsRef.current,
    queuedRequests: requestQueueRef.current.length,
    cacheHitRate: 0 // Could be implemented with additional tracking
  }), [])

  // Preload requests for better performance
  const preload = useCallback((requests: APIRequest[]) => {
    requests.forEach(request => {
      // Only preload if not already cached or pending
      const cacheKey = getCacheKey(request)
      if (!getCachedResponse(cacheKey) && !pendingRequestsRef.current.has(cacheKey)) {
        makeRequest(request).catch(() => {
          // Ignore preload errors
        })
      }
    })
  }, [getCacheKey, getCachedResponse, makeRequest])

  return {
    // Main request methods
    makeRequest,
    get,
    post,
    put,
    delete: del,
    
    // Cache management
    clearCache,
    invalidateCache,
    
    // Performance utilities
    getStats,
    preload,
    
    // Configuration
    config
  }
}

// Hook for intelligent request batching with priority
export function useRequestBatcher<T, R>(
  batchProcessor: (requests: T[]) => Promise<R[]>,
  options: {
    batchSize?: number
    batchDelay?: number
    maxWaitTime?: number
    priorityFn?: (request: T) => number
  } = {}
) {
  const {
    batchSize = 10,
    batchDelay = 100,
    maxWaitTime = 5000,
    priorityFn
  } = options

  const queueRef = useRef<Array<{
    request: T
    resolve: (value: R) => void
    reject: (error: any) => void
    timestamp: number
    priority: number
  }>>([])
  
  const timeoutRef = useRef<NodeJS.Timeout>()
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout>()

  const processBatch = useCallback(async () => {
    if (queueRef.current.length === 0) return

    // Sort by priority if priority function is provided
    if (priorityFn) {
      queueRef.current.sort((a, b) => b.priority - a.priority)
    }

    const batch = queueRef.current.splice(0, batchSize)
    const requests = batch.map(item => item.request)

    try {
      const results = await batchProcessor(requests)
      batch.forEach((item, index) => {
        item.resolve(results[index])
      })
    } catch (error) {
      batch.forEach(item => {
        item.reject(error)
      })
    }

    // Clear timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current)
      maxWaitTimeoutRef.current = undefined
    }

    // Process remaining items if any
    if (queueRef.current.length > 0) {
      scheduleProcessing()
    }
  }, [batchProcessor, batchSize, priorityFn])

  const scheduleProcessing = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Schedule batch processing
    timeoutRef.current = setTimeout(processBatch, batchDelay)

    // Set max wait timeout if not already set
    if (!maxWaitTimeoutRef.current && queueRef.current.length > 0) {
      maxWaitTimeoutRef.current = setTimeout(processBatch, maxWaitTime)
    }
  }, [processBatch, batchDelay, maxWaitTime])

  const addRequest = useCallback((request: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      const priority = priorityFn ? priorityFn(request) : 0
      
      queueRef.current.push({
        request,
        resolve,
        reject,
        timestamp: Date.now(),
        priority
      })

      // Process immediately if batch is full
      if (queueRef.current.length >= batchSize) {
        processBatch()
      } else {
        scheduleProcessing()
      }
    })
  }, [batchSize, processBatch, scheduleProcessing, priorityFn])

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current)
    }
    return processBatch()
  }, [processBatch])

  const getQueueStats = useCallback(() => ({
    queueSize: queueRef.current.length,
    oldestRequestAge: queueRef.current.length > 0 
      ? Date.now() - Math.min(...queueRef.current.map(item => item.timestamp))
      : 0
  }), [])

  return {
    addRequest,
    flush,
    getQueueStats
  }
}