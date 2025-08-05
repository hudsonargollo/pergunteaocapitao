import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as chatPost } from '@/app/api/chat/route'
import { POST as imagePost, GET as imageGet } from '@/app/api/v1/images/generate/route'

// Mock the environment
const mockEnv = {
  OPENAI_API_KEY: 'test-api-key',
  DB: {} as any,
  VECTORIZE_INDEX: {} as any,
  R2_BUCKET: {} as any,
  ASSETS: {} as any
}

// Mock process.env
vi.stubGlobal('process', {
  env: mockEnv
})

// Mock the service classes
vi.mock('@/lib/semantic-search', () => ({
  SemanticSearchService: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue({
      results: [
        {
          content: 'Test search result content',
          score: 0.8,
          metadata: { source: 'test-source' }
        }
      ],
      fallbackUsed: false
    })
  }))
}))

vi.mock('@/lib/response-generator', () => ({
  ResponseGenerator: vi.fn().mockImplementation(() => ({
    determineToneModifier: vi.fn().mockReturnValue('instructional'),
    generateResponse: vi.fn().mockResolvedValue({
      response: 'Test response from Capitão Caverna',
      toneAnalysis: {
        primary: 'instructional',
        intensity: 'medium',
        themes: ['discipline', 'action'],
        visualParameters: {
          pose: 'confident stance',
          expression: 'focused determination',
          environment: 'cave interior',
          lighting: 'dramatic shadows'
        }
      },
      validation: { isValid: true, violations: [], suggestions: [] },
      metadata: {
        contextUsed: 'test context',
        promptTokens: 100,
        responseTokens: 50,
        processingTime: 1000
      }
    })
  }))
}))

vi.mock('@/lib/image-storage', () => ({
  ImageStorageService: vi.fn().mockImplementation(() => ({
    storeImage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        imageId: 'test-image-id',
        publicUrl: 'https://example.com/test-image.png',
        r2ObjectKey: 'images/generated/2024/01/test-image-id.png',
        metadata: {
          image_id: 'test-image-id',
          r2_object_key: 'images/generated/2024/01/test-image-id.png',
          prompt_parameters: '{}',
          created_at: new Date().toISOString()
        }
      }
    }),
    getImageMetadata: vi.fn().mockResolvedValue({
      success: true,
      data: {
        image_id: 'test-image-id',
        r2_object_key: 'images/generated/2024/01/test-image-id.png',
        prompt_parameters: '{"test": "parameters"}',
        response_context: 'Test response context',
        tone_analysis: '{"primary": "instructional"}',
        created_at: new Date().toISOString()
      }
    })
  }))
}))

vi.mock('@/lib/embedding-service', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({}))
}))

vi.mock('@/lib/vectorize', () => ({
  VectorizeClient: vi.fn().mockImplementation(() => ({}))
}))

vi.mock('@/lib/r2', () => ({
  R2Client: vi.fn().mockImplementation(() => ({
    getPublicUrl: vi.fn().mockReturnValue('https://example.com/test-image.png')
  }))
}))

vi.mock('@/lib/d1', () => ({
  D1Client: vi.fn().mockImplementation(() => ({}))
}))

vi.mock('@/lib/openai', () => ({
  OpenAIClient: vi.fn().mockImplementation(() => ({
    generateImage: vi.fn().mockResolvedValue('https://openai.example.com/generated-image.png'),
    analyzeTone: vi.fn().mockResolvedValue({
      primary: 'instructional',
      intensity: 'medium',
      themes: ['discipline', 'action'],
      visualParameters: {
        pose: 'confident stance',
        expression: 'focused determination',
        environment: 'cave interior',
        lighting: 'dramatic shadows'
      }
    })
  }))
}))

// Mock fetch for image download
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
})

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/chat', () => {
    it('should handle valid chat request', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Como posso melhorar minha disciplina?'
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('response')
      expect(data).toHaveProperty('imageUrl')
      expect(data).toHaveProperty('conversationId')
      expect(typeof data.response).toBe('string')
      expect(typeof data.conversationId).toBe('string')
    })

    it('should reject empty message', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: ''
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.code).toBe('INVALID_JSON')
    })

    it('should reject message that is too long', async () => {
      const longMessage = 'a'.repeat(2001)
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: longMessage
        })
      })

      const response = await chatPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /api/v1/images/generate', () => {
    it('should handle valid image generation request', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/images/generate', {
        method: 'POST',
        body: JSON.stringify({
          responseContent: 'Guerreiro, é hora de agir com disciplina e foco.',
          tone: 'instructional',
          themes: ['discipline', 'action']
        })
      })

      const response = await imagePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('imageUrl')
      expect(data).toHaveProperty('imageId')
      expect(data).toHaveProperty('promptParameters')
      expect(typeof data.imageUrl).toBe('string')
      expect(typeof data.imageId).toBe('string')
    })

    it('should reject empty responseContent', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/images/generate', {
        method: 'POST',
        body: JSON.stringify({
          responseContent: ''
        })
      })

      const response = await imagePost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid tone', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/images/generate', {
        method: 'POST',
        body: JSON.stringify({
          responseContent: 'Test content',
          tone: 'invalid-tone'
        })
      })

      const response = await imagePost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/v1/images/generate', () => {
    it('should retrieve image metadata', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/images/generate?imageId=test-image-id')

      const response = await imageGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('imageId')
      expect(data).toHaveProperty('imageUrl')
      expect(data).toHaveProperty('promptParameters')
      expect(data.imageId).toBe('test-image-id')
    })

    it('should reject missing imageId parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/images/generate')

      const response = await imageGet(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.code).toBe('MISSING_PARAMETER')
    })
  })
})