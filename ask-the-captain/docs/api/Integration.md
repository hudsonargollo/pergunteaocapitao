# API Integration Documentation

## Overview

The "Ask the Captain" platform integrates with multiple APIs to provide a comprehensive chat experience with Capitão Caverna. This document covers all API endpoints, integration patterns, error handling, and best practices for working with the backend services.

## Architecture Overview

```mermaid
graph TB
    subgraph "Frontend"
        UI[AnimatedAIChat Component]
        State[Chat State Management]
        Cache[Image & Response Cache]
    end
    
    subgraph "API Layer"
        Chat[/api/chat]
        Images[/api/v1/images/generate]
        Health[/api/health]
        Metrics[/api/metrics]
    end
    
    subgraph "External Services"
        OpenAI[OpenAI API]
        DALLE[DALL-E 3]
    end
    
    subgraph "Cloudflare Services"
        D1[(D1 Database)]
        R2[(R2 Storage)]
        VZ[(Vectorize Index)]
    end
    
    UI --> Chat
    UI --> Images
    Chat --> OpenAI
    Chat --> VZ
    Images --> DALLE
    Images --> R2
    Images --> D1
```

## Core API Endpoints

### POST /api/chat

The primary conversation endpoint that handles user messages and generates AI responses.

#### Request Format

```typescript
interface ChatRequest {
  message: string
  conversationId?: string
}
```

#### Example Request

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: "Como posso começar minha transformação?",
    conversationId: "conv_1234567890_abc123"
  })
})
```

#### Response Format

```typescript
interface ChatResponse {
  response: string
  imageUrl: string
  conversationId: string
}
```

#### Example Response

```json
{
  "response": "Guerreiro, sua transformação começa com a decisão de abandonar a zona de conforto. O primeiro passo é definir claramente seus objetivos e criar um plano de ação disciplinado.",
  "imageUrl": "https://pub-123.r2.dev/captain-images/img_abc123.png",
  "conversationId": "conv_1234567890_abc123"
}
```

#### Error Responses

```typescript
interface ChatError {
  error: {
    code: string
    message: string
    details?: object
    timestamp: string
  }
  fallback?: {
    response?: string
    imageUrl?: string
  }
}
```

#### Common Error Codes

- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_INPUT`: Message validation failed
- `SERVICE_UNAVAILABLE`: OpenAI API unavailable
- `CONTEXT_TOO_LONG`: Message history too long
- `INTERNAL_ERROR`: Unexpected server error

### POST /api/v1/images/generate

Generates contextual Captain images based on response content and tone.

#### Request Format

```typescript
interface ImageGenerationRequest {
  responseContent: string
  context?: {
    tone: 'supportive' | 'challenging' | 'instructional' | 'motivational'
    themes: string[]
    intensity: 'low' | 'medium' | 'high'
  }
  conversationId?: string
}
```

#### Example Request

```javascript
const response = await fetch('/api/v1/images/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    responseContent: "Guerreiro, é hora de enfrentar seus medos!",
    context: {
      tone: 'challenging',
      themes: ['courage', 'transformation'],
      intensity: 'high'
    },
    conversationId: "conv_1234567890_abc123"
  })
})
```

#### Response Format

```typescript
interface ImageGenerationResponse {
  imageUrl: string
  imageId: string
  promptParameters: {
    basePrompt: string
    contextualModifiers: string[]
    style: string
    pose: string
    expression: string
  }
  generationTime: number
}
```

#### Example Response

```json
{
  "imageUrl": "https://pub-123.r2.dev/captain-images/img_def456.png",
  "imageId": "img_def456",
  "promptParameters": {
    "basePrompt": "Pixar-style anthropomorphic wolf character...",
    "contextualModifiers": ["challenging pose", "intense expression"],
    "style": "3D cartoon, dramatic lighting",
    "pose": "crossed arms, firm stance",
    "expression": "intense gaze, determined"
  },
  "generationTime": 3.2
}
```

### GET /api/health

Health check endpoint for monitoring system status.

#### Response Format

```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    openai: 'up' | 'down' | 'degraded'
    vectorize: 'up' | 'down' | 'degraded'
    d1: 'up' | 'down' | 'degraded'
    r2: 'up' | 'down' | 'degraded'
  }
  metrics: {
    responseTime: number
    memoryUsage: number
    activeConnections: number
  }
}
```

### GET /api/metrics

Performance and usage metrics endpoint.

#### Response Format

```typescript
interface MetricsResponse {
  period: string
  metrics: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    imageGenerations: number
    knowledgeBaseQueries: number
  }
  performance: {
    p50ResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
  }
}
```

## Integration Patterns

### Basic Chat Integration

```typescript
import { useState } from 'react'

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  imageUrl?: string
}

export function useChatAPI() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = async (content: string) => {
    setIsLoading(true)
    setError(null)

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: ChatResponse = await response.json()

      // Add AI response
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
        imageUrl: data.imageUrl
      }
      setMessages(prev => [...prev, aiMessage])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  return { messages, isLoading, error, sendMessage }
}
```

### Advanced Integration with Error Handling

```typescript
interface APIConfig {
  maxRetries: number
  retryDelay: number
  timeout: number
}

class CaptainAPIClient {
  private config: APIConfig
  private conversationId: string | null = null

  constructor(config: Partial<APIConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config
    }
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    return this.withRetry(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            conversationId: this.conversationId
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new APIError(response.status, errorData.error?.message || response.statusText)
        }

        const data: ChatResponse = await response.json()
        this.conversationId = data.conversationId
        return data

      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    })
  }

  async generateImage(responseContent: string, context?: any): Promise<ImageGenerationResponse> {
    return this.withRetry(async () => {
      const response = await fetch('/api/v1/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseContent,
          context,
          conversationId: this.conversationId
        })
      })

      if (!response.ok) {
        throw new APIError(response.status, 'Image generation failed')
      }

      return response.json()
    })
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt === this.config.maxRetries || !this.isRetryableError(lastError)) {
          throw lastError
        }

        await this.delay(this.config.retryDelay * Math.pow(2, attempt - 1))
      }
    }

    throw lastError!
  }

  private isRetryableError(error: Error): boolean {
    if (error instanceof APIError) {
      return error.status >= 500 || error.status === 429
    }
    return error.name === 'AbortError' || error.message.includes('network')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'APIError'
  }
}
```

### Batch Request Processing

```typescript
interface BatchRequest {
  id: string
  endpoint: string
  body: any
}

interface BatchResponse {
  id: string
  success: boolean
  data?: any
  error?: string
}

class BatchAPIProcessor {
  private queue: BatchRequest[] = []
  private processing = false
  private batchSize = 3
  private batchDelay = 200

  async addRequest(endpoint: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest & { resolve: Function; reject: Function } = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        endpoint,
        body,
        resolve,
        reject
      }

      this.queue.push(request)
      this.processBatch()
    })
  }

  private async processBatch() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize)
      
      try {
        const results = await Promise.allSettled(
          batch.map(req => this.executeRequest(req))
        )

        results.forEach((result, index) => {
          const request = batch[index] as any
          if (result.status === 'fulfilled') {
            request.resolve(result.value)
          } else {
            request.reject(result.reason)
          }
        })

      } catch (error) {
        batch.forEach((req: any) => req.reject(error))
      }

      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelay))
      }
    }

    this.processing = false
  }

  private async executeRequest(request: BatchRequest): Promise<any> {
    const response = await fetch(request.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }
}
```

## Error Handling Strategies

### Captain Persona Error Messages

```typescript
interface CaptainErrorConfig {
  context: 'chat' | 'image' | 'system'
  severity: 'low' | 'medium' | 'high'
  retryable: boolean
}

class CaptainErrorHandler {
  private errorMessages = {
    RATE_LIMIT_EXCEEDED: {
      chat: "Guerreiro, até mesmo o Capitão precisa de um momento para recarregar as energias. Aguarde um instante e tente novamente.",
      image: "A forja de imagens está aquecendo, guerreiro. Aguarde um momento para que eu possa aparecer novamente.",
      system: "Sistema temporariamente sobrecarregado. Aguarde alguns momentos."
    },
    SERVICE_UNAVAILABLE: {
      chat: "A conexão com a caverna está instável, guerreiro. Verifique sua conexão e retome nossa conversa.",
      image: "As energias da caverna estão instáveis. Minha aparência pode não se atualizar, mas minha orientação permanece firme.",
      system: "Serviços temporariamente indisponíveis."
    },
    INVALID_INPUT: {
      chat: "Guerreiro, sua mensagem não chegou clara até mim. Reformule sua pergunta e tente novamente.",
      image: "Não consegui interpretar o contexto para gerar minha imagem. Continuemos nossa conversa.",
      system: "Entrada inválida fornecida."
    },
    TIMEOUT_ERROR: {
      chat: "A caverna está ecoando... Sua mensagem demorou para chegar. Tente novamente, guerreiro.",
      image: "A criação da imagem está demorando mais que o esperado. Vou usar uma aparência padrão.",
      system: "Operação expirou por tempo limite."
    }
  }

  getCaptainMessage(errorCode: string, config: CaptainErrorConfig): string {
    const messages = this.errorMessages[errorCode]
    if (!messages) {
      return "Guerreiro, algo inesperado aconteceu na caverna. Mas não desista - tente novamente!"
    }

    return messages[config.context] || messages.system
  }

  shouldRetry(errorCode: string): boolean {
    const retryableErrors = [
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE', 
      'TIMEOUT_ERROR',
      'NETWORK_ERROR'
    ]
    return retryableErrors.includes(errorCode)
  }

  getRetryDelay(errorCode: string, attemptCount: number): number {
    const baseDelays = {
      'RATE_LIMIT_EXCEEDED': 5000,
      'SERVICE_UNAVAILABLE': 2000,
      'TIMEOUT_ERROR': 1000,
      'NETWORK_ERROR': 1500
    }

    const baseDelay = baseDelays[errorCode] || 1000
    return Math.min(baseDelay * Math.pow(2, attemptCount - 1), 30000)
  }
}
```

### Graceful Degradation

```typescript
interface FallbackStrategy {
  chatFallback: (message: string) => Promise<ChatResponse>
  imageFallback: (context: string) => string
  offlineResponse: (message: string) => ChatResponse
}

class GracefulDegradationHandler implements FallbackStrategy {
  async chatFallback(message: string): Promise<ChatResponse> {
    // Use cached responses or predefined responses for common questions
    const commonResponses = {
      'como começar': "Guerreiro, toda jornada começa com o primeiro passo. Defina seu objetivo e comece hoje mesmo.",
      'estou perdido': "A confusão é normal, guerreiro. Respire fundo e foque no que realmente importa para você.",
      'preciso de ajuda': "Estou aqui para te guiar, guerreiro. Conte-me mais sobre seu desafio específico."
    }

    const lowerMessage = message.toLowerCase()
    for (const [key, response] of Object.entries(commonResponses)) {
      if (lowerMessage.includes(key)) {
        return {
          response,
          imageUrl: this.imageFallback('supportive'),
          conversationId: `fallback_${Date.now()}`
        }
      }
    }

    return {
      response: "Guerreiro, mesmo sem acesso completo aos ensinamentos, posso te orientar: mantenha o foco, seja disciplinado e nunca desista de seus objetivos.",
      imageUrl: this.imageFallback('default'),
      conversationId: `fallback_${Date.now()}`
    }
  }

  imageFallback(context: string): string {
    const fallbackImages = {
      'supportive': '/reference5-capitao-caverna-smiling-holding-smartphone.webp',
      'challenging': '/reference3-capitao-caverna-back.webp',
      'instructional': '/reference2-capitao-caverna-rightside.webp',
      'motivational': '/reference6-capitao-caverna-winking-thumbsup.webp',
      'default': '/reference1-capitao-caverna-front.webp'
    }

    return fallbackImages[context] || fallbackImages.default
  }

  offlineResponse(message: string): ChatResponse {
    return {
      response: "Guerreiro, estamos desconectados da caverna principal, mas lembre-se: a disciplina e o foco não dependem de conexão. Continue praticando os ensinamentos que já aprendeu.",
      imageUrl: this.imageFallback('supportive'),
      conversationId: `offline_${Date.now()}`
    }
  }
}
```

## Performance Optimization

### Request Caching

```typescript
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Usage with API client
class CachedAPIClient extends CaptainAPIClient {
  private cache = new APICache()

  async sendMessage(message: string): Promise<ChatResponse> {
    const cacheKey = `chat:${message.toLowerCase().trim()}`
    const cached = this.cache.get<ChatResponse>(cacheKey)
    
    if (cached) {
      return cached
    }

    const response = await super.sendMessage(message)
    
    // Cache successful responses for common questions
    if (this.isCacheable(message)) {
      this.cache.set(cacheKey, response, 10 * 60 * 1000) // 10 minutes
    }

    return response
  }

  private isCacheable(message: string): boolean {
    const cacheablePatterns = [
      /^(o que é|what is)/i,
      /^(como|how)/i,
      /^(quando|when)/i,
      /^(onde|where)/i,
      /^(por que|why)/i
    ]

    return cacheablePatterns.some(pattern => pattern.test(message))
  }
}
```

### Connection Pooling

```typescript
class ConnectionPool {
  private pool: Set<AbortController> = new Set()
  private maxConnections = 10

  async execute<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.pool.size >= this.maxConnections) {
      throw new Error('Connection pool exhausted')
    }

    const controller = new AbortController()
    this.pool.add(controller)

    try {
      return await operation(controller.signal)
    } finally {
      this.pool.delete(controller)
    }
  }

  abortAll(): void {
    this.pool.forEach(controller => controller.abort())
    this.pool.clear()
  }

  getActiveConnections(): number {
    return this.pool.size
  }
}
```

## Testing API Integration

### Unit Tests

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { CaptainAPIClient } from './api-client'

// Mock fetch globally
global.fetch = jest.fn()

describe('CaptainAPIClient', () => {
  let client: CaptainAPIClient
  let mockFetch: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    client = new CaptainAPIClient()
    mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockClear()
  })

  it('should send message successfully', async () => {
    const mockResponse: ChatResponse = {
      response: 'Test response',
      imageUrl: 'https://example.com/image.png',
      conversationId: 'conv_123'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    const result = await client.sendMessage('Test message')

    expect(mockFetch).toHaveBeenCalledWith('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test message',
        conversationId: null
      })
    })

    expect(result).toEqual(mockResponse)
  })

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong'
        }
      })
    } as Response)

    await expect(client.sendMessage('Test message')).rejects.toThrow('Something went wrong')
  })

  it('should retry on retryable errors', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable'
    } as Response)

    // Second call succeeds
    const mockResponse: ChatResponse = {
      response: 'Success after retry',
      imageUrl: 'https://example.com/image.png',
      conversationId: 'conv_123'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    const result = await client.sendMessage('Test message')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual(mockResponse)
  })
})
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

describe('API Integration Tests', () => {
  let apiClient: CaptainAPIClient

  beforeAll(() => {
    apiClient = new CaptainAPIClient({
      maxRetries: 1,
      timeout: 5000
    })
  })

  it('should complete full chat flow', async () => {
    const message = 'Como posso começar minha transformação?'
    
    // Send message
    const chatResponse = await apiClient.sendMessage(message)
    
    expect(chatResponse.response).toBeTruthy()
    expect(chatResponse.conversationId).toBeTruthy()
    expect(chatResponse.imageUrl).toMatch(/^https?:\/\//)

    // Generate contextual image
    const imageResponse = await apiClient.generateImage(
      chatResponse.response,
      { tone: 'supportive', themes: ['transformation'], intensity: 'medium' }
    )

    expect(imageResponse.imageUrl).toMatch(/^https?:\/\//)
    expect(imageResponse.imageId).toBeTruthy()
    expect(imageResponse.promptParameters).toBeTruthy()
  }, 30000) // 30 second timeout for integration test

  it('should handle rate limiting gracefully', async () => {
    // Send multiple rapid requests to trigger rate limiting
    const promises = Array.from({ length: 10 }, (_, i) => 
      apiClient.sendMessage(`Test message ${i}`)
    )

    const results = await Promise.allSettled(promises)
    
    // Some should succeed, some might be rate limited
    const successful = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    expect(successful.length).toBeGreaterThan(0)
    
    // Check that rate limit errors are handled properly
    failed.forEach(result => {
      if (result.status === 'rejected') {
        expect(result.reason.message).toMatch(/rate limit|too many requests/i)
      }
    })
  }, 60000)
})
```

## Monitoring and Analytics

### Request Tracking

```typescript
interface RequestMetrics {
  endpoint: string
  method: string
  duration: number
  status: number
  timestamp: Date
  userId?: string
  conversationId?: string
}

class APIMetricsCollector {
  private metrics: RequestMetrics[] = []
  private maxMetrics = 1000

  trackRequest(metrics: RequestMetrics): void {
    this.metrics.push(metrics)
    
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // Send to analytics service
    this.sendToAnalytics(metrics)
  }

  getMetrics(timeRange?: { start: Date; end: Date }): RequestMetrics[] {
    if (!timeRange) return [...this.metrics]

    return this.metrics.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    )
  }

  getAverageResponseTime(endpoint?: string): number {
    const relevantMetrics = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics

    if (relevantMetrics.length === 0) return 0

    const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0)
    return totalDuration / relevantMetrics.length
  }

  getErrorRate(endpoint?: string): number {
    const relevantMetrics = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics

    if (relevantMetrics.length === 0) return 0

    const errorCount = relevantMetrics.filter(m => m.status >= 400).length
    return errorCount / relevantMetrics.length
  }

  private async sendToAnalytics(metrics: RequestMetrics): Promise<void> {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      })
    } catch (error) {
      console.warn('Failed to send metrics:', error)
    }
  }
}
```

### Performance Monitoring

```typescript
class APIPerformanceMonitor {
  private observer: PerformanceObserver | null = null

  start(): void {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return

    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('/api/')) {
          this.trackAPIPerformance(entry as PerformanceNavigationTiming)
        }
      })
    })

    this.observer.observe({ entryTypes: ['navigation', 'resource'] })
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  }

  private trackAPIPerformance(entry: PerformanceNavigationTiming): void {
    const metrics = {
      url: entry.name,
      duration: entry.duration,
      responseStart: entry.responseStart,
      responseEnd: entry.responseEnd,
      transferSize: entry.transferSize || 0,
      timestamp: new Date()
    }

    // Send to monitoring service
    this.sendPerformanceData(metrics)
  }

  private async sendPerformanceData(metrics: any): Promise<void> {
    try {
      await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      })
    } catch (error) {
      console.warn('Failed to send performance data:', error)
    }
  }
}
```

## Best Practices

### Request Optimization

1. **Use appropriate HTTP methods**: POST for mutations, GET for queries
2. **Include request IDs**: For tracing and debugging
3. **Implement request deduplication**: Prevent duplicate requests
4. **Use compression**: Enable gzip/brotli compression
5. **Optimize payload size**: Send only necessary data

### Error Handling

1. **Provide meaningful error messages**: Use Captain persona for user-facing errors
2. **Implement exponential backoff**: For retryable errors
3. **Log errors appropriately**: Include context and stack traces
4. **Use circuit breakers**: Prevent cascading failures
5. **Provide fallback responses**: Graceful degradation

### Security

1. **Validate all inputs**: Both client and server side
2. **Use HTTPS everywhere**: Encrypt all communications
3. **Implement rate limiting**: Prevent abuse
4. **Sanitize responses**: Prevent XSS attacks
5. **Monitor for anomalies**: Detect unusual patterns

### Performance

1. **Cache responses**: When appropriate
2. **Use connection pooling**: Reuse connections
3. **Implement request batching**: Reduce round trips
4. **Monitor response times**: Track performance metrics
5. **Optimize images**: Compress and resize appropriately

This documentation provides a comprehensive guide to integrating with the "Ask the Captain" API system, ensuring robust, performant, and user-friendly interactions with Capitão Caverna.