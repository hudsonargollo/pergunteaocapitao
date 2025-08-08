# Troubleshooting Guide - Common Issues

## Overview

This guide covers common issues encountered when working with the "Ask the Captain" platform, including the AnimatedAIChat component, API integrations, image generation, and deployment problems. Each issue includes symptoms, root causes, and step-by-step solutions.

## Component Issues

### 1. AnimatedAIChat Component Not Rendering

#### Symptoms
- Component appears blank or shows error boundary
- Console errors about missing dependencies
- TypeScript compilation errors

#### Root Causes
- Missing required dependencies (framer-motion, lucide-react)
- Incorrect import paths
- TypeScript configuration issues
- Missing CSS variables

#### Solutions

**Check Dependencies**
```bash
# Verify required packages are installed
npm list framer-motion lucide-react

# Install missing dependencies
npm install framer-motion lucide-react
```

**Verify Import Paths**
```typescript
// Correct imports
import { AnimatedAIChat } from '@/app/components/ui/animated-ai-chat'
import { motion } from 'framer-motion'
import { Send, Loader2 } from 'lucide-react'

// Check if path aliases are configured in tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./app/*"]
    }
  }
}
```

**Check CSS Variables**
```css
/* Ensure these variables are defined in globals.css */
:root {
  --cave-dark: #0A0A0B;
  --cave-charcoal: #1C1C1C;
  --cave-red: #FF3333;
  /* ... other cave theme variables */
}
```

**Debug Component Rendering**
```tsx
// Add error boundary and logging
import { ErrorBoundary } from 'react-error-boundary'

function ErrorFallback({error, resetErrorBoundary}) {
  console.error('AnimatedAIChat Error:', error)
  return (
    <div role="alert" className="p-4 bg-red-100 border border-red-400 rounded">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

// Wrap component
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <AnimatedAIChat />
</ErrorBoundary>
```

### 2. Animations Not Working or Choppy

#### Symptoms
- Messages appear instantly without animation
- Animations stutter or lag
- Performance warnings in console

#### Root Causes
- User has reduced motion enabled
- Device performance limitations
- Too many concurrent animations
- Inefficient animation configurations

#### Solutions

**Check Motion Preferences**
```typescript
import { useReducedMotion } from 'framer-motion'

function DebugAnimations() {
  const shouldReduceMotion = useReducedMotion()
  
  console.log('Reduced motion preference:', shouldReduceMotion)
  
  // Animations will be disabled if user prefers reduced motion
  return null
}
```

**Monitor Performance**
```typescript
// Add performance monitoring
const { metrics, isMonitoring } = useAnimationPerformance({
  targetFPS: 60,
  enableLogging: true,
  onPerformanceChange: (metrics) => {
    console.log('Animation performance:', metrics)
    if (metrics.fps < 30) {
      console.warn('Poor animation performance detected')
    }
  }
})
```

**Optimize Animation Settings**
```typescript
// Reduce animation complexity based on performance
const animationSettings = useMemo(() => {
  const baseSettings = {
    enableComplexAnimations: true,
    enableBlur: true,
    maxConcurrentAnimations: 10
  }

  // Reduce complexity for low-performance devices
  if (performanceMetrics.fps < 45) {
    return {
      ...baseSettings,
      enableComplexAnimations: false,
      enableBlur: false,
      maxConcurrentAnimations: 3
    }
  }

  return baseSettings
}, [performanceMetrics])
```

**Debug Animation Config**
```typescript
// Log animation configuration
console.log('Animation config:', animationConfig)
console.log('Device capabilities:', deviceCapabilities)
console.log('Should reduce motion:', shouldReduceMotion)
```

### 3. Captain Images Not Loading

#### Symptoms
- Placeholder images or broken image icons
- Images load slowly or inconsistently
- Fallback images not working

#### Root Causes
- Image generation API failures
- Network connectivity issues
- Incorrect image URLs
- Missing fallback images

#### Solutions

**Check Image URLs**
```typescript
// Debug image loading
const debugImageLoading = (imageUrl: string) => {
  console.log('Attempting to load image:', imageUrl)
  
  const img = new Image()
  img.onload = () => console.log('Image loaded successfully:', imageUrl)
  img.onerror = (error) => console.error('Image failed to load:', imageUrl, error)
  img.src = imageUrl
}
```

**Verify Fallback System**
```typescript
// Test fallback image system
import { BRAND_ASSETS, getFallbackImageUrl } from '@/app/lib/brand-assets'

console.log('Available fallback images:', BRAND_ASSETS.fallbackImages)
console.log('Default fallback:', getFallbackImageUrl('default'))

// Test fallback loading
const testFallback = (context: string) => {
  const fallbackUrl = getFallbackImageUrl(context)
  debugImageLoading(fallbackUrl)
}
```

**Check Image Generation API**
```typescript
// Test image generation endpoint
const testImageGeneration = async () => {
  try {
    const response = await fetch('/api/v1/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseContent: 'Test message',
        context: { tone: 'supportive', themes: ['test'], intensity: 'medium' }
      })
    })
    
    if (!response.ok) {
      console.error('Image generation failed:', response.status, response.statusText)
      const errorData = await response.json()
      console.error('Error details:', errorData)
    } else {
      const data = await response.json()
      console.log('Image generation successful:', data)
    }
  } catch (error) {
    console.error('Image generation request failed:', error)
  }
}
```

**Implement Image Preloading**
```typescript
// Preload critical images
const preloadCriticalImages = async () => {
  const criticalImages = [
    BRAND_ASSETS.fallbackImages.default,
    BRAND_ASSETS.fallbackImages.supportive,
    BRAND_ASSETS.fallbackImages.challenging
  ]
  
  const preloadPromises = criticalImages.map(url => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(url)
      img.onerror = () => reject(new Error(`Failed to preload ${url}`))
      img.src = url
    })
  })
  
  try {
    await Promise.all(preloadPromises)
    console.log('Critical images preloaded successfully')
  } catch (error) {
    console.warn('Some images failed to preload:', error)
  }
}
```

## API Integration Issues

### 4. Chat API Not Responding

#### Symptoms
- Messages stuck in "sending" state
- Network errors in console
- Timeout errors

#### Root Causes
- API endpoint not available
- Network connectivity issues
- Server overload or rate limiting
- Incorrect request format

#### Solutions

**Check API Endpoint**
```bash
# Test API endpoint directly
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "conversationId": "test_123"}'
```

**Debug Network Requests**
```typescript
// Add detailed logging to API calls
const debugAPICall = async (endpoint: string, body: any) => {
  console.log(`Making request to ${endpoint}:`, body)
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    
    console.log(`Response status: ${response.status}`)
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()))
    
    const data = await response.json()
    console.log(`Response data:`, data)
    
    return data
  } catch (error) {
    console.error(`API call failed:`, error)
    throw error
  }
}
```

**Check Network Connectivity**
```typescript
// Test network connectivity
const checkConnectivity = async () => {
  try {
    const response = await fetch('/api/health', { method: 'GET' })
    if (response.ok) {
      console.log('API is reachable')
      const health = await response.json()
      console.log('Health status:', health)
    } else {
      console.error('API health check failed:', response.status)
    }
  } catch (error) {
    console.error('Network connectivity issue:', error)
  }
}
```

**Implement Retry Logic**
```typescript
// Add exponential backoff retry
const retryAPICall = async (operation: () => Promise<any>, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

### 5. Rate Limiting Issues

#### Symptoms
- HTTP 429 errors
- "Too many requests" messages
- Requests being rejected

#### Root Causes
- Exceeding API rate limits
- Multiple rapid requests
- Insufficient rate limiting handling

#### Solutions

**Implement Request Throttling**
```typescript
class RequestThrottler {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private requestsPerSecond = 2
  private interval = 1000 / this.requestsPerSecond

  async throttle<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const operation = this.queue.shift()!
      await operation()
      
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.interval))
      }
    }
    
    this.processing = false
  }
}
```

**Handle Rate Limit Responses**
```typescript
const handleRateLimit = async (response: Response) => {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000
    
    console.warn(`Rate limited. Retrying after ${delay}ms`)
    
    // Show user-friendly message
    const captainMessage = "Guerreiro, até mesmo o Capitão precisa de um momento para recarregar as energias. Aguarde um instante e tente novamente."
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, delay))
    return true // Indicate retry should happen
  }
  
  return false
}
```

## Performance Issues

### 6. Slow Component Performance

#### Symptoms
- Laggy interactions
- Slow message rendering
- High memory usage

#### Root Causes
- Large message history
- Inefficient re-renders
- Memory leaks
- Unoptimized animations

#### Solutions

**Enable Virtual Scrolling**
```typescript
// Check if virtual scrolling is enabled
const debugVirtualScrolling = () => {
  console.log('Should use virtualization:', shouldUseVirtualization)
  console.log('Visible range:', visibleRange)
  console.log('Total messages:', chatState.messages.length)
  console.log('Rendered messages:', visibleMessages.length)
}
```

**Monitor Memory Usage**
```typescript
// Track memory usage
const monitorMemory = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    console.log('Memory usage:', {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
    })
  }
}

// Monitor every 10 seconds
setInterval(monitorMemory, 10000)
```

**Optimize Re-renders**
```typescript
// Use React DevTools Profiler to identify expensive renders
import { Profiler } from 'react'

const onRenderCallback = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  console.log('Render performance:', {
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  })
}

// Wrap component
<Profiler id="AnimatedAIChat" onRender={onRenderCallback}>
  <AnimatedAIChat />
</Profiler>
```

**Implement Message Cleanup**
```typescript
// Clean up old messages to prevent memory issues
const cleanupOldMessages = (messages: ChatMessage[], maxMessages = 100) => {
  if (messages.length > maxMessages) {
    const messagesToKeep = messages.slice(-maxMessages)
    console.log(`Cleaned up ${messages.length - maxMessages} old messages`)
    return messagesToKeep
  }
  return messages
}
```

### 7. Image Loading Performance

#### Symptoms
- Slow image loading
- Images causing layout shifts
- High bandwidth usage

#### Root Causes
- Large image files
- No image optimization
- Missing image dimensions
- No lazy loading

#### Solutions

**Implement Image Optimization**
```typescript
// Add image optimization
const optimizeImageUrl = (url: string, width?: number, height?: number) => {
  if (!url.includes('r2.dev')) return url
  
  const params = new URLSearchParams()
  if (width) params.set('w', width.toString())
  if (height) params.set('h', height.toString())
  params.set('f', 'webp') // Use WebP format
  params.set('q', '85') // 85% quality
  
  return `${url}?${params.toString()}`
}
```

**Add Image Lazy Loading**
```tsx
// Implement lazy loading for Captain images
const LazyImage = ({ src, alt, className, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [src])

  return (
    <div className={cn("relative", className)}>
      <img
        ref={imgRef}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
        {...props}
      />
      
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-cave-stone animate-pulse rounded" />
      )}
      
      {error && (
        <div className="absolute inset-0 bg-cave-stone rounded flex items-center justify-center">
          <span className="text-cave-mist text-sm">Imagem não disponível</span>
        </div>
      )}
    </div>
  )
}
```

## Deployment Issues

### 8. Cloudflare Workers Deployment Failures

#### Symptoms
- Build failures during deployment
- Runtime errors in production
- Missing environment variables

#### Root Causes
- Incompatible dependencies
- Missing Cloudflare-specific configurations
- Environment variable issues
- Bundle size limits

#### Solutions

**Check Bundle Size**
```bash
# Analyze bundle size
npm run build
npx wrangler dev --local

# Check for large dependencies
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer .next/static/chunks/
```

**Verify Cloudflare Configuration**
```typescript
// Check wrangler.toml configuration
// wrangler.toml
name = "ask-the-captain"
main = "src/index.js"
compatibility_date = "2023-05-18"

[env.production]
vars = { NODE_ENV = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "ask-the-captain-db"
database_id = "your-database-id"

[[env.production.vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "captain-knowledge"

[[env.production.r2_buckets]]
binding = "IMAGES_BUCKET"
bucket_name = "captain-images"
```

**Debug Environment Variables**
```typescript
// Check environment variables in production
console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
  // Don't log actual API keys
})
```

**Handle Cloudflare-specific Issues**
```typescript
// Handle Cloudflare Workers limitations
const isCloudflareWorkers = typeof caches !== 'undefined'

if (isCloudflareWorkers) {
  // Use Cloudflare-specific APIs
  console.log('Running in Cloudflare Workers environment')
} else {
  // Use Node.js APIs for local development
  console.log('Running in local development environment')
}
```

### 9. Database Connection Issues

#### Symptoms
- Database queries failing
- Connection timeout errors
- Migration failures

#### Root Causes
- Incorrect database configuration
- Network connectivity issues
- Missing database migrations
- Permission issues

#### Solutions

**Test Database Connection**
```bash
# Test D1 database connection
npx wrangler d1 execute ask-the-captain-db --command "SELECT 1"

# Run migrations
npx wrangler d1 migrations apply ask-the-captain-db --local
npx wrangler d1 migrations apply ask-the-captain-db --remote
```

**Debug Database Queries**
```typescript
// Add query logging
const executeQuery = async (query: string, params: any[] = []) => {
  console.log('Executing query:', query, 'with params:', params)
  
  try {
    const result = await env.DB.prepare(query).bind(...params).all()
    console.log('Query result:', result)
    return result
  } catch (error) {
    console.error('Query failed:', error)
    throw error
  }
}
```

**Check Database Schema**
```sql
-- Verify tables exist
SELECT name FROM sqlite_master WHERE type='table';

-- Check table structure
PRAGMA table_info(GeneratedImages);
PRAGMA table_info(Conversations);
```

## Debugging Tools and Techniques

### 10. Development Debugging

#### Enable Debug Logging
```typescript
// Add comprehensive logging
const DEBUG = process.env.NODE_ENV === 'development'

const debugLog = (category: string, message: string, data?: any) => {
  if (DEBUG) {
    console.log(`[${category}] ${message}`, data || '')
  }
}

// Usage throughout the application
debugLog('API', 'Sending chat request', { message, conversationId })
debugLog('Animation', 'Starting message animation', { messageId, duration })
debugLog('Image', 'Loading Captain image', { url, context })
```

#### Browser DevTools
```typescript
// Add debugging helpers to window object (development only)
if (typeof window !== 'undefined' && DEBUG) {
  (window as any).debugCaptain = {
    // Test API endpoints
    testChat: (message: string) => fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    }).then(r => r.json()),
    
    // Test image generation
    testImage: (content: string) => fetch('/api/v1/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseContent: content })
    }).then(r => r.json()),
    
    // Check component state
    getState: () => ({
      messages: chatState.messages.length,
      isTyping: chatState.isTyping,
      error: chatState.error,
      performance: performanceMetrics
    }),
    
    // Clear cache
    clearCache: () => {
      localStorage.clear()
      sessionStorage.clear()
      console.log('Cache cleared')
    }
  }
  
  console.log('Debug helpers available at window.debugCaptain')
}
```

#### Performance Monitoring
```typescript
// Add performance markers
const markPerformance = (name: string) => {
  if (typeof performance !== 'undefined') {
    performance.mark(name)
  }
}

const measurePerformance = (name: string, startMark: string, endMark: string) => {
  if (typeof performance !== 'undefined') {
    performance.measure(name, startMark, endMark)
    const measure = performance.getEntriesByName(name)[0]
    console.log(`${name}: ${measure.duration.toFixed(2)}ms`)
  }
}

// Usage
markPerformance('chat-request-start')
// ... API call
markPerformance('chat-request-end')
measurePerformance('chat-request-duration', 'chat-request-start', 'chat-request-end')
```

## Getting Help

### 11. When to Seek Additional Support

If you've tried the solutions above and are still experiencing issues:

1. **Check the GitHub Issues**: Look for similar problems and solutions
2. **Review the Documentation**: Ensure you're following the latest guidelines
3. **Check Dependencies**: Verify all packages are up to date
4. **Test in Isolation**: Create a minimal reproduction case
5. **Gather Debug Information**: Collect logs, error messages, and system info

### Debug Information Checklist

When reporting issues, include:

```typescript
// System information
const debugInfo = {
  // Environment
  nodeVersion: process.version,
  platform: process.platform,
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  
  // Application
  buildTime: process.env.BUILD_TIME,
  commitHash: process.env.COMMIT_HASH,
  
  // Performance
  memory: typeof performance !== 'undefined' && 'memory' in performance 
    ? (performance as any).memory 
    : 'N/A',
  
  // Feature detection
  features: {
    framerMotion: typeof motion !== 'undefined',
    intersectionObserver: typeof IntersectionObserver !== 'undefined',
    performanceObserver: typeof PerformanceObserver !== 'undefined',
    webp: (() => {
      const canvas = document.createElement('canvas')
      return canvas.toDataURL('image/webp').indexOf('webp') > -1
    })()
  },
  
  // Current state
  componentState: {
    messagesCount: chatState.messages.length,
    isTyping: chatState.isTyping,
    hasError: !!chatState.error,
    conversationId: chatState.conversationId
  }
}

console.log('Debug Information:', debugInfo)
```

This troubleshooting guide should help resolve most common issues encountered when working with the "Ask the Captain" platform. Remember to always check the basics first (dependencies, configuration, network connectivity) before diving into more complex debugging scenarios.