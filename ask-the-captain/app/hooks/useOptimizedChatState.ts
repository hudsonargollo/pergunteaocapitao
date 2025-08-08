'use client'

import { useReducer, useCallback, useMemo, useRef, useEffect, useState } from 'react'

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  imageUrl?: string
  isTyping?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  isTyping: boolean
  isGeneratingImage: boolean
  currentCaptainImage: string
  error: string | null
  conversationId?: string
  // Performance optimizations
  messageCache: Map<string, ChatMessage>
  visibleMessageIds: string[]
  totalMessageCount: number
}

type ChatAction = 
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_GENERATING_IMAGE'; payload: boolean }
  | { type: 'SET_CAPTAIN_IMAGE'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONVERSATION_ID'; payload: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'OPTIMIZE_MESSAGES'; payload: { maxVisible: number } }

const initialState: ChatState = {
  messages: [],
  isTyping: false,
  isGeneratingImage: false,
  currentCaptainImage: '/images/captain-default.png',
  error: null,
  conversationId: undefined,
  messageCache: new Map(),
  visibleMessageIds: [],
  totalMessageCount: 0
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE': {
      const newMessage = action.payload
      const newCache = new Map(state.messageCache)
      newCache.set(newMessage.id, newMessage)
      
      const newMessages = [...state.messages, newMessage]
      const newVisibleIds = newMessages.slice(-50).map(m => m.id) // Keep last 50 visible
      
      return {
        ...state,
        messages: newMessages,
        messageCache: newCache,
        visibleMessageIds: newVisibleIds,
        totalMessageCount: newMessages.length
      }
    }
    
    case 'UPDATE_MESSAGE': {
      const { id, updates } = action.payload
      const newCache = new Map(state.messageCache)
      const existingMessage = newCache.get(id)
      
      if (existingMessage) {
        const updatedMessage = { ...existingMessage, ...updates }
        newCache.set(id, updatedMessage)
        
        const newMessages = state.messages.map(msg => 
          msg.id === id ? updatedMessage : msg
        )
        
        return {
          ...state,
          messages: newMessages,
          messageCache: newCache
        }
      }
      
      return state
    }
    
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload }
    
    case 'SET_GENERATING_IMAGE':
      return { ...state, isGeneratingImage: action.payload }
    
    case 'SET_CAPTAIN_IMAGE':
      return { ...state, currentCaptainImage: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    case 'SET_CONVERSATION_ID':
      return { ...state, conversationId: action.payload }
    
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        messageCache: new Map(),
        visibleMessageIds: [],
        totalMessageCount: 0
      }
    
    case 'OPTIMIZE_MESSAGES': {
      const { maxVisible } = action.payload
      const visibleMessages = state.messages.slice(-maxVisible)
      const newVisibleIds = visibleMessages.map(m => m.id)
      
      // Keep cache for visible messages only
      const newCache = new Map()
      visibleMessages.forEach(msg => {
        newCache.set(msg.id, msg)
      })
      
      return {
        ...state,
        messages: visibleMessages,
        messageCache: newCache,
        visibleMessageIds: newVisibleIds
      }
    }
    
    default:
      return state
  }
}

interface UseOptimizedChatStateOptions {
  maxVisibleMessages?: number
  enableMessageCaching?: boolean
  autoOptimizeThreshold?: number
}

export function useOptimizedChatState(options: UseOptimizedChatStateOptions = {}) {
  const {
    maxVisibleMessages = 50,
    enableMessageCaching = true,
    autoOptimizeThreshold = 100
  } = options

  const [state, dispatch] = useReducer(chatReducer, initialState)
  const optimizationTimeoutRef = useRef<NodeJS.Timeout>()

  // Auto-optimize when message count exceeds threshold
  useEffect(() => {
    if (state.totalMessageCount > autoOptimizeThreshold) {
      if (optimizationTimeoutRef.current) {
        clearTimeout(optimizationTimeoutRef.current)
      }
      
      optimizationTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'OPTIMIZE_MESSAGES', payload: { maxVisible: maxVisibleMessages } })
      }, 1000) // Debounce optimization
    }
    
    return () => {
      if (optimizationTimeoutRef.current) {
        clearTimeout(optimizationTimeoutRef.current)
      }
    }
  }, [state.totalMessageCount, autoOptimizeThreshold, maxVisibleMessages])

  // Memoized actions to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    addMessage: (message: ChatMessage) => {
      dispatch({ type: 'ADD_MESSAGE', payload: message })
    },
    
    updateMessage: (id: string, updates: Partial<ChatMessage>) => {
      dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } })
    },
    
    setTyping: (isTyping: boolean) => {
      dispatch({ type: 'SET_TYPING', payload: isTyping })
    },
    
    setGeneratingImage: (isGenerating: boolean) => {
      dispatch({ type: 'SET_GENERATING_IMAGE', payload: isGenerating })
    },
    
    setCaptainImage: (imageUrl: string) => {
      dispatch({ type: 'SET_CAPTAIN_IMAGE', payload: imageUrl })
    },
    
    setError: (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error })
    },
    
    setConversationId: (id: string) => {
      dispatch({ type: 'SET_CONVERSATION_ID', payload: id })
    },
    
    clearMessages: () => {
      dispatch({ type: 'CLEAR_MESSAGES' })
    },
    
    optimizeMessages: () => {
      dispatch({ type: 'OPTIMIZE_MESSAGES', payload: { maxVisible: maxVisibleMessages } })
    }
  }), [maxVisibleMessages])

  // Memoized selectors for performance
  const selectors = useMemo(() => ({
    // Get visible messages (for rendering)
    getVisibleMessages: () => {
      if (enableMessageCaching && state.visibleMessageIds.length > 0) {
        return state.visibleMessageIds
          .map(id => state.messageCache.get(id))
          .filter(Boolean) as ChatMessage[]
      }
      return state.messages.slice(-maxVisibleMessages)
    },
    
    // Get message by ID (cached lookup)
    getMessage: (id: string) => {
      return enableMessageCaching ? state.messageCache.get(id) : 
        state.messages.find(msg => msg.id === id)
    },
    
    // Get conversation stats
    getStats: () => ({
      totalMessages: state.totalMessageCount,
      visibleMessages: Math.min(state.messages.length, maxVisibleMessages),
      cacheSize: state.messageCache.size,
      isOptimized: state.totalMessageCount > autoOptimizeThreshold
    })
  }), [state, maxVisibleMessages, enableMessageCaching, autoOptimizeThreshold])

  return {
    state,
    actions,
    selectors
  }
}

// Hook for efficient image caching
export function useImageCache(maxCacheSize: number = 20) {
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const usageRef = useRef<Map<string, number>>(new Map())

  const preloadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      // Check if already cached
      const cached = cacheRef.current.get(url)
      if (cached) {
        // Update usage count
        usageRef.current.set(url, (usageRef.current.get(url) || 0) + 1)
        resolve(cached)
        return
      }

      // Create new image
      const img = new Image()
      img.onload = () => {
        // Add to cache
        if (cacheRef.current.size >= maxCacheSize) {
          // Remove least used image
          let leastUsedUrl = ''
          let leastUsedCount = Infinity
          
          for (const [cachedUrl, count] of usageRef.current.entries()) {
            if (count < leastUsedCount) {
              leastUsedCount = count
              leastUsedUrl = cachedUrl
            }
          }
          
          if (leastUsedUrl) {
            cacheRef.current.delete(leastUsedUrl)
            usageRef.current.delete(leastUsedUrl)
          }
        }
        
        cacheRef.current.set(url, img)
        usageRef.current.set(url, 1)
        resolve(img)
      }
      
      img.onerror = reject
      img.src = url
    })
  }, [maxCacheSize])

  const getCachedImage = useCallback((url: string): HTMLImageElement | null => {
    const cached = cacheRef.current.get(url)
    if (cached) {
      usageRef.current.set(url, (usageRef.current.get(url) || 0) + 1)
    }
    return cached || null
  }, [])

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
    usageRef.current.clear()
  }, [])

  const getCacheStats = useCallback(() => ({
    size: cacheRef.current.size,
    maxSize: maxCacheSize,
    urls: Array.from(cacheRef.current.keys())
  }), [maxCacheSize])

  return {
    preloadImage,
    getCachedImage,
    clearCache,
    getCacheStats
  }
}

// Hook for efficient API call batching with caching
export function useAPIBatching<T, R>(
  apiCall: (requests: T[]) => Promise<R[]>,
  batchSize: number = 5,
  batchDelay: number = 100,
  enableCaching: boolean = true
) {
  const queueRef = useRef<Array<{
    request: T
    resolve: (value: R) => void
    reject: (error: any) => void
    cacheKey?: string
  }>>([])
  const timeoutRef = useRef<NodeJS.Timeout>()
  const cacheRef = useRef<Map<string, { result: R; timestamp: number }>>(new Map())
  const cacheExpiryMs = 5 * 60 * 1000 // 5 minutes

  const getCacheKey = useCallback((request: T): string => {
    return JSON.stringify(request)
  }, [])

  const getCachedResult = useCallback((cacheKey: string): R | null => {
    if (!enableCaching) return null
    
    const cached = cacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < cacheExpiryMs) {
      return cached.result
    }
    
    // Remove expired cache entry
    if (cached) {
      cacheRef.current.delete(cacheKey)
    }
    
    return null
  }, [enableCaching, cacheExpiryMs])

  const setCachedResult = useCallback((cacheKey: string, result: R) => {
    if (!enableCaching) return
    
    cacheRef.current.set(cacheKey, {
      result,
      timestamp: Date.now()
    })
    
    // Cleanup old cache entries if cache gets too large
    if (cacheRef.current.size > 100) {
      const entries = Array.from(cacheRef.current.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      // Remove oldest 20 entries
      for (let i = 0; i < 20; i++) {
        cacheRef.current.delete(entries[i][0])
      }
    }
  }, [enableCaching])

  const processBatch = useCallback(async () => {
    if (queueRef.current.length === 0) return

    const batch = queueRef.current.splice(0, batchSize)
    const uncachedBatch = batch.filter(item => {
      if (item.cacheKey) {
        const cached = getCachedResult(item.cacheKey)
        if (cached) {
          item.resolve(cached)
          return false
        }
      }
      return true
    })

    if (uncachedBatch.length === 0) return

    const requests = uncachedBatch.map(item => item.request)

    try {
      const results = await apiCall(requests)
      uncachedBatch.forEach((item, index) => {
        const result = results[index]
        if (item.cacheKey) {
          setCachedResult(item.cacheKey, result)
        }
        item.resolve(result)
      })
    } catch (error) {
      uncachedBatch.forEach(item => {
        item.reject(error)
      })
    }
  }, [apiCall, batchSize, getCachedResult, setCachedResult])

  const scheduleProcessing = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(processBatch, batchDelay)
  }, [processBatch, batchDelay])

  const addRequest = useCallback((request: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      const cacheKey = enableCaching ? getCacheKey(request) : undefined
      
      // Check cache first
      if (cacheKey) {
        const cached = getCachedResult(cacheKey)
        if (cached) {
          resolve(cached)
          return
        }
      }

      queueRef.current.push({ request, resolve, reject, cacheKey })
      
      // Process immediately if batch is full
      if (queueRef.current.length >= batchSize) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        processBatch()
      } else {
        scheduleProcessing()
      }
    })
  }, [batchSize, processBatch, scheduleProcessing, enableCaching, getCacheKey, getCachedResult])

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  const getCacheStats = useCallback(() => ({
    size: cacheRef.current.size,
    entries: Array.from(cacheRef.current.keys())
  }), [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { 
    addRequest, 
    clearCache, 
    getCacheStats,
    queueSize: queueRef.current.length
  }
}

// Hook for virtual scrolling large message lists
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, index) => ({
      item,
      index: visibleRange.startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (visibleRange.startIndex + index) * itemHeight,
        height: itemHeight,
        width: '100%'
      }
    }))
  }, [items, visibleRange, itemHeight])

  const totalHeight = items.length * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    if (scrollElementRef.current) {
      const targetScrollTop = index * itemHeight
      scrollElementRef.current.scrollTo({
        top: targetScrollTop,
        behavior
      })
    }
  }, [itemHeight])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    scrollToIndex(items.length - 1, behavior)
  }, [scrollToIndex, items.length])

  return {
    scrollElementRef,
    visibleItems,
    totalHeight,
    handleScroll,
    scrollToIndex,
    scrollToBottom,
    visibleRange
  }
}

// Hook for memory-efficient message rendering
export function useMessageMemoryManagement(
  messages: ChatMessage[],
  maxRenderedMessages: number = 50,
  enableVirtualization: boolean = true
) {
  const [renderMode, setRenderMode] = useState<'full' | 'virtual' | 'windowed'>('full')
  const memoryUsageRef = useRef<number>(0)
  const performanceObserverRef = useRef<PerformanceObserver | null>(null)

  // Monitor memory usage if available
  useEffect(() => {
    if ('memory' in performance) {
      const checkMemoryUsage = () => {
        const memInfo = (performance as any).memory
        memoryUsageRef.current = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit
        
        // Switch to virtual scrolling if memory usage is high
        if (memoryUsageRef.current > 0.8 && messages.length > maxRenderedMessages) {
          setRenderMode('virtual')
        } else if (memoryUsageRef.current > 0.6 && messages.length > maxRenderedMessages * 2) {
          setRenderMode('windowed')
        } else if (memoryUsageRef.current < 0.5) {
          setRenderMode('full')
        }
      }

      const interval = setInterval(checkMemoryUsage, 5000) // Check every 5 seconds
      return () => clearInterval(interval)
    }
  }, [messages.length, maxRenderedMessages])

  // Determine which messages to render based on mode
  const renderableMessages = useMemo(() => {
    switch (renderMode) {
      case 'virtual':
        // Only render visible messages (handled by virtual scrolling)
        return messages
      
      case 'windowed':
        // Render only recent messages
        return messages.slice(-maxRenderedMessages)
      
      case 'full':
      default:
        // Render all messages if count is reasonable
        return messages.length > maxRenderedMessages * 3 
          ? messages.slice(-maxRenderedMessages * 2)
          : messages
    }
  }, [messages, renderMode, maxRenderedMessages])

  const memoryStats = useMemo(() => ({
    totalMessages: messages.length,
    renderedMessages: renderableMessages.length,
    renderMode,
    memoryUsage: memoryUsageRef.current,
    isOptimized: renderMode !== 'full'
  }), [messages.length, renderableMessages.length, renderMode])

  return {
    renderableMessages,
    renderMode,
    memoryStats,
    shouldUseVirtualization: enableVirtualization && renderMode === 'virtual'
  }
}