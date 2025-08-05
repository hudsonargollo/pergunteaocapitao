import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock environment for integration tests
const mockEnv = {
  OPENAI_API_KEY: 'test-api-key',
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
        run: vi.fn().mockResolvedValue({ success: true })
      })
    }),
    exec: vi.fn().mockResolvedValue({ success: true })
  } as any,
  VECTORIZE_INDEX: {
    query: vi.fn().mockResolvedValue({
      matches: [
        {
          id: 'test-chunk-1',
          score: 0.9,
          metadata: {
            content: 'Test content about Modo Caverna methodology',
            source: 'modocaverna-docs.md'
          }
        }
      ]
    }),
    upsert: vi.fn().mockResolvedValue({ success: true })
  } as any,
  R2_BUCKET: {
    put: vi.fn().mockResolvedValue({
      key: 'test-image-key',
      etag: 'test-etag'
    }),
    get: vi.fn().mockResolvedValue({
      body: new ReadableStream()
    })
  } as any,
  ASSETS: {} as any
}

// Mock global fetch for OpenAI API calls
global.fetch = vi.fn()

// Integration tests to verify complete API workflows
describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default fetch mock for OpenAI API
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('openai.com/v1/embeddings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              embedding: Array.from({ length: 1536 }, () => Math.random())
            }]
          })
        })
      }
      
      if (url.includes('openai.com/v1/chat/completions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: 'Guerreiro, você deve tomar ação imediata! Primeiro passo: defina seus objetivos claros. Segundo: elimine todas as distrações. Terceiro: execute com disciplina total. A caverna exige compromisso!'
              }
            }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50
            }
          })
        })
      }
      
      if (url.includes('openai.com/v1/images/generations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              url: 'https://oaidalleapiprodscus.blob.core.windows.net/test-image.png'
            }]
          })
        })
      }
      
      // Mock image download
      if (url.includes('blob.core.windows.net')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        })
      }
      
      return Promise.reject(new Error(`Unmocked fetch call to ${url}`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('End-to-End Chat API Flow', () => {
    it('should complete full chat workflow from request to response', async () => {
      // Import the chat route
      const { POST: chatPost } = await import('@/app/api/chat/route')
      
      // Mock the environment
      vi.stubGlobal('process', { env: mockEnv })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Como posso desenvolver mais disciplina?'
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('response')
      expect(data).toHaveProperty('imageUrl')
      expect(data).toHaveProperty('conversationId')
      
      // Verify response contains Capitão Caverna characteristics
      expect(data.response).toContain('guerreiro')
      expect(typeof data.imageUrl).toBe('string')
      expect(data.imageUrl).toMatch(/^https?:\/\//)
    })

    it('should handle semantic search integration', async () => {
      const { POST: chatPost } = await import('@/app/api/chat/route')
      
      vi.stubGlobal('process', { env: mockEnv })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'O que são os três pilares do Modo Caverna?'
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.response).toBeDefined()
      
      // Verify that vectorize search was called
      expect(mockEnv.VECTORIZE_INDEX.query).toHaveBeenCalled()
    })

    it('should handle conversation context', async () => {
      const { POST: chatPost } = await import('@/app/api/chat/route')
      
      vi.stubGlobal('process', { env: mockEnv })
      
      const conversationId = 'test-conversation-123'
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Continue nossa conversa anterior',
          conversationId
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.conversationId).toBe(conversationId)
    })
  })

  describe('End-to-End Image Generation Flow', () => {
    it('should complete full image generation workflow', async () => {
      const { POST: imagePost } = await import('@/app/api/v1/images/generate/route')
      
      vi.stubGlobal('process', { env: mockEnv })
      
      const request = new NextRequest('http://localhost:3000/api/v1/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseContent: 'Guerreiro, é hora de tomar ação! Disciplina é a chave do sucesso.',
          tone: 'challenging',
          themes: ['discipline', 'action']
        })
      })

      const response = await imagePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('imageUrl')
      expect(data).toHaveProperty('imageId')
      expect(data).toHaveProperty('promptParameters')
      
      // Verify image was stored in R2
      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalled()
      
      // Verify metadata was stored in D1
      expect(mockEnv.DB.prepare).toHaveBeenCalled()
    })

    it('should retrieve image metadata', async () => {
      const { GET: imageGet } = await import('@/app/api/v1/images/generate/route')
      
      vi.stubGlobal('process', { env: mockEnv })
      
      // Mock database response for image metadata
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            image_id: 'test-image-123',
            r2_object_key: 'images/generated/2024/01/test-image-123.png',
            prompt_parameters: JSON.stringify({
              pose: 'confident stance',
              expression: 'determined gaze'
            }),
            created_at: '2024-01-01T00:00:00Z'
          })
        })
      })
      
      const request = new NextRequest('http://localhost:3000/api/v1/images/generate?imageId=test-image-123')

      const response = await imageGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.imageId).toBe('test-image-123')
      expect(data.promptParameters).toBeDefined()
    })
  })

  describe('Database Integration', () => {
    it('should handle D1 database operations', async () => {
      const { D1Client } = await import('@/lib/d1')
      
      const d1Client = new D1Client(mockEnv.DB)
      
      // Test image metadata storage
      const imageMetadata = {
        image_id: 'test-image-123',
        r2_object_key: 'images/generated/2024/01/test-image-123.png',
        prompt_parameters: JSON.stringify({ test: 'parameters' }),
        response_context: 'Test response context',
        tone_analysis: JSON.stringify({ primary: 'challenging' })
      }
      
      await d1Client.storeImageMetadata(imageMetadata)
      
      expect(mockEnv.DB.prepare).toHaveBeenCalled()
    })

    it('should handle database connection errors gracefully', async () => {
      const { D1Client } = await import('@/lib/d1')
      
      // Mock database error
      const errorDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database connection failed')
        })
      }
      
      const d1Client = new D1Client(errorDb as any)
      
      await expect(d1Client.storeImageMetadata({
        image_id: 'test',
        r2_object_key: 'test',
        prompt_parameters: '{}'
      })).rejects.toThrow('Database connection failed')
    })
  })

  describe('OpenAI API Integration', () => {
    it('should handle OpenAI embedding generation', async () => {
      const { EmbeddingService } = await import('@/lib/embedding-service')
      const { OpenAIClient } = await import('@/lib/openai')
      
      const openaiClient = new OpenAIClient('test-api-key')
      const embeddingService = new EmbeddingService(openaiClient)
      
      const testChunk = {
        id: 'test-chunk-1',
        content: 'Test content for embedding generation',
        source: 'test-source',
        metadata: {}
      }
      
      const result = await embeddingService.generateSingleEmbedding(testChunk)
      
      expect(result).toBeDefined()
      expect(result?.values).toHaveLength(1536)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('openai.com/v1/embeddings'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      )
    })

    it('should handle OpenAI chat completion', async () => {
      const { OpenAIClient } = await import('@/lib/openai')
      
      const openaiClient = new OpenAIClient('test-api-key')
      
      const result = await openaiClient.generateChatCompletion([
        { role: 'system', content: 'You are Capitão Caverna' },
        { role: 'user', content: 'Como desenvolver disciplina?' }
      ])
      
      expect(result).toBeDefined()
      expect(result.content).toContain('Guerreiro')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('openai.com/v1/chat/completions'),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should handle OpenAI image generation', async () => {
      const { OpenAIClient } = await import('@/lib/openai')
      
      const openaiClient = new OpenAIClient('test-api-key')
      
      const prompt = 'Capitão Caverna in confident stance with determined expression'
      const result = await openaiClient.generateImage(prompt)
      
      expect(result).toBeDefined()
      expect(result).toMatch(/^https?:\/\//)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('openai.com/v1/images/generations'),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should handle OpenAI API errors gracefully', async () => {
      const { OpenAIClient } = await import('@/lib/openai')
      
      // Mock API error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        })
      })
      
      const openaiClient = new OpenAIClient('test-api-key')
      
      await expect(openaiClient.generateImage('test prompt'))
        .rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Cloudflare Services Integration', () => {
    it('should handle Vectorize operations', async () => {
      const { VectorizeClient } = await import('@/lib/vectorize')
      
      const vectorizeClient = new VectorizeClient(mockEnv.VECTORIZE_INDEX)
      
      const embedding = Array.from({ length: 1536 }, () => Math.random())
      const results = await vectorizeClient.search(embedding, {
        topK: 5,
        minScore: 0.7
      })
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(mockEnv.VECTORIZE_INDEX.query).toHaveBeenCalled()
    })

    it('should handle R2 storage operations', async () => {
      const { R2Client } = await import('@/lib/r2')
      
      const r2Client = new R2Client(mockEnv.R2_BUCKET, 'test-bucket')
      
      const testData = new ArrayBuffer(1024)
      const result = await r2Client.uploadImage('test-key.png', testData, {
        contentType: 'image/png'
      })
      
      expect(result).toBeDefined()
      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalled()
    })

    it('should handle Vectorize upsert operations', async () => {
      const { VectorizeClient } = await import('@/lib/vectorize')
      
      const vectorizeClient = new VectorizeClient(mockEnv.VECTORIZE_INDEX)
      
      const vectors = [{
        id: 'test-vector-1',
        values: Array.from({ length: 1536 }, () => Math.random()),
        metadata: {
          content: 'Test content',
          source: 'test-source'
        }
      }]
      
      await vectorizeClient.upsert(vectors)
      
      expect(mockEnv.VECTORIZE_INDEX.upsert).toHaveBeenCalledWith(vectors)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle service failures gracefully', async () => {
      const { POST: chatPost } = await import('@/app/api/chat/route')
      
      // Mock OpenAI API failure
      global.fetch = vi.fn().mockRejectedValue(new Error('OpenAI API unavailable'))
      
      vi.stubGlobal('process', { env: mockEnv })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message'
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data.error.code).toBeDefined()
    })

    it('should provide fallback responses when search fails', async () => {
      const { POST: chatPost } = await import('@/app/api/chat/route')
      
      // Mock Vectorize failure
      const failingEnv = {
        ...mockEnv,
        VECTORIZE_INDEX: {
          query: vi.fn().mockRejectedValue(new Error('Vectorize unavailable'))
        }
      }
      
      vi.stubGlobal('process', { env: failingEnv })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message'
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      // Should still return a response (fallback)
      expect(response.status).toBe(200)
      expect(data.response).toBeDefined()
    })
  })

  describe('Service Dependencies Integration', () => {
    it('should have all required service classes available', async () => {
      // Verify all service classes can be imported and instantiated
      const { SemanticSearchService } = await import('@/lib/semantic-search')
      const { ResponseGenerator } = await import('@/lib/response-generator')
      const { ImageStorageService } = await import('@/lib/image-storage')
      const { EmbeddingService } = await import('@/lib/embedding-service')
      const { VectorizeClient } = await import('@/lib/vectorize')
      const { R2Client } = await import('@/lib/r2')
      const { D1Client } = await import('@/lib/d1')
      const { OpenAIClient } = await import('@/lib/openai')

      expect(SemanticSearchService).toBeDefined()
      expect(ResponseGenerator).toBeDefined()
      expect(ImageStorageService).toBeDefined()
      expect(EmbeddingService).toBeDefined()
      expect(VectorizeClient).toBeDefined()
      expect(R2Client).toBeDefined()
      expect(D1Client).toBeDefined()
      expect(OpenAIClient).toBeDefined()
      
      // Test instantiation
      const openaiClient = new OpenAIClient('test-key')
      const d1Client = new D1Client(mockEnv.DB)
      const r2Client = new R2Client(mockEnv.R2_BUCKET, 'test-bucket')
      const vectorizeClient = new VectorizeClient(mockEnv.VECTORIZE_INDEX)
      
      expect(openaiClient).toBeInstanceOf(OpenAIClient)
      expect(d1Client).toBeInstanceOf(D1Client)
      expect(r2Client).toBeInstanceOf(R2Client)
      expect(vectorizeClient).toBeInstanceOf(VectorizeClient)
    })

    it('should verify API route exports', async () => {
      const chatRoute = await import('@/app/api/chat/route')
      const imageRoute = await import('@/app/api/v1/images/generate/route')
      
      expect(chatRoute.POST).toBeDefined()
      expect(typeof chatRoute.POST).toBe('function')
      
      expect(imageRoute.POST).toBeDefined()
      expect(imageRoute.GET).toBeDefined()
      expect(typeof imageRoute.POST).toBe('function')
      expect(typeof imageRoute.GET).toBe('function')
    })

    it('should verify TypeScript types are properly exported', async () => {
      const types = await import('@/types')
      
      // Verify the types module loads without errors
      expect(types).toBeDefined()
    })
  })
})