// Tests for fallback systems
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SearchFallbackService,
  ImageFallbackService,
  ResponseFallbackService,
  OfflineStateService,
  PartialFailureRecoveryService,
  FallbackOrchestrator
} from '../fallback-systems'
import { CaptainError, ErrorType } from '../error-handling'
import type { SearchResult, ToneAnalysis } from '@/types'

describe('SearchFallbackService', () => {
  let service: SearchFallbackService

  beforeEach(() => {
    service = new SearchFallbackService()
  })

  it('should generate motivation fallback for motivation queries', () => {
    const results = service.generateFallbackResults('Preciso de motivação para continuar')
    
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('transformação')
    expect(results[0].metadata.source).toBe('fallback_motivation')
    expect(results[0].score).toBe(0.8)
  })

  it('should generate discipline fallback for discipline queries', () => {
    const results = service.generateFallbackResults('Como manter disciplina diária?')
    
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('disciplina')
    expect(results[0].metadata.source).toBe('fallback_discipline')
  })

  it('should generate focus fallback for focus queries', () => {
    const results = service.generateFallbackResults('Tenho problemas de foco e concentração')
    
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('foco')
    expect(results[0].metadata.source).toBe('fallback_focus')
  })

  it('should generate progress fallback for progress queries', () => {
    const results = service.generateFallbackResults('Como medir meu progresso?')
    
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('progresso')
    expect(results[0].metadata.source).toBe('fallback_progress')
  })

  it('should generate obstacles fallback for obstacle queries', () => {
    const results = service.generateFallbackResults('Estou enfrentando muitos obstáculos')
    
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('obstáculos')
    expect(results[0].metadata.source).toBe('fallback_obstacles')
  })

  it('should generate default fallback for unrecognized queries', () => {
    const results = service.generateFallbackResults('Random unrelated query')
    
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Guerreiro')
    expect(results[0].metadata.source).toBe('fallback_default')
    expect(results[0].score).toBe(0.7)
  })

  it('should create fallback search context', () => {
    const context = service.createFallbackSearchContext('test query')
    
    expect(context.results).toHaveLength(1)
    expect(context.fallbackUsed).toBe(true)
    expect(context.searchTime).toBeGreaterThanOrEqual(0)
  })
})

describe('ImageFallbackService', () => {
  let service: ImageFallbackService

  beforeEach(() => {
    service = new ImageFallbackService()
  })

  it('should return appropriate fallback image for tone analysis', () => {
    const toneAnalysis: ToneAnalysis = {
      primary: 'supportive',
      intensity: 'medium',
      themes: ['encouragement'],
      visualParameters: {
        pose: 'open',
        expression: 'warm',
        environment: 'cave',
        lighting: 'soft'
      }
    }

    const imageUrl = service.getFallbackImageUrl(toneAnalysis)
    expect(imageUrl).toBe('/placeholder-captain.svg')
  })

  it('should return default image when no tone analysis provided', () => {
    const imageUrl = service.getFallbackImageUrl()
    expect(imageUrl).toBe('/placeholder-captain.svg')
  })

  it('should return loading image URL', () => {
    const imageUrl = service.getLoadingImageUrl()
    expect(imageUrl).toBe('/placeholder-captain-response.svg')
  })

  it('should return error image URL', () => {
    const imageUrl = service.getErrorImageUrl()
    expect(imageUrl).toBe('/placeholder-captain.svg')
  })

  it('should validate image URL availability', async () => {
    // Mock fetch for testing
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })

    const validUrl = await service.validateImageUrl('http://valid-image.com/image.png')
    const invalidUrl = await service.validateImageUrl('http://invalid-image.com/image.png')

    expect(validUrl).toBe(true)
    expect(invalidUrl).toBe(false)
  })

  it('should get fallback image with validation', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    const toneAnalysis: ToneAnalysis = {
      primary: 'challenging',
      intensity: 'high',
      themes: ['determination'],
      visualParameters: {
        pose: 'firm',
        expression: 'intense',
        environment: 'cave',
        lighting: 'dramatic'
      }
    }

    const imageUrl = await service.getFallbackImageWithValidation(toneAnalysis)
    expect(imageUrl).toBe('/placeholder-captain.svg')
  })
})

describe('ResponseFallbackService', () => {
  let service: ResponseFallbackService

  beforeEach(() => {
    service = new ResponseFallbackService()
  })

  it('should generate appropriate fallback for system unavailable', () => {
    const response = service.generateFallbackResponse(ErrorType.SERVICE_UNAVAILABLE)
    
    expect(response).toContain('dificuldades técnicas')
    expect(response).toContain('obstáculos são oportunidades')
  })

  it('should generate appropriate fallback for rate limit', () => {
    const response = service.generateFallbackResponse(ErrorType.RATE_LIMIT_EXCEEDED)
    
    expect(response).toContain('paciência')
    expect(response).toContain('Cave Mode')
  })

  it('should generate appropriate fallback for search failure', () => {
    const response = service.generateFallbackResponse(ErrorType.SEMANTIC_SEARCH_FAILED)
    
    expect(response).toContain('sistema de busca')
    expect(response).toContain('sabedoria que você precisa já está dentro de você')
  })

  it('should generate default fallback for unknown errors', () => {
    const response = service.generateFallbackResponse(ErrorType.INTERNAL_ERROR)
    
    expect(response).toContain('Guerreiro')
    expect(response).toContain('Cave Mode')
  })

  it('should create complete fallback chat response', () => {
    const toneAnalysis: ToneAnalysis = {
      primary: 'supportive',
      intensity: 'medium',
      themes: ['support'],
      visualParameters: {
        pose: 'open',
        expression: 'encouraging',
        environment: 'cave',
        lighting: 'warm'
      }
    }

    const chatResponse = service.createFallbackChatResponse(
      ErrorType.CHAT_COMPLETION_FAILED,
      'test-conversation-id',
      toneAnalysis
    )

    expect(chatResponse.response).toContain('obstáculo técnico')
    expect(chatResponse.imageUrl).toBe('/placeholder-captain.svg')
    expect(chatResponse.conversationId).toBe('test-conversation-id')
  })
})

describe('OfflineStateService', () => {
  let service: OfflineStateService

  beforeEach(() => {
    service = new OfflineStateService()
  })

  it('should return offline messages for different reasons', () => {
    const connectionLost = service.getOfflineMessage('connection_lost')
    const serviceDown = service.getOfflineMessage('service_down')
    const maintenance = service.getOfflineMessage('maintenance')
    const timeout = service.getOfflineMessage('timeout')

    expect(connectionLost).toContain('Conexão perdida')
    expect(serviceDown).toContain('temporariamente indisponíveis')
    expect(maintenance).toContain('manutenção')
    expect(timeout).toContain('demorou mais que o esperado')
  })

  it('should create offline response with fallback', () => {
    const response = service.createOfflineResponse('service_down')

    expect(response.error.code).toBe('OFFLINE_STATE')
    expect(response.error.message).toBe('System temporarily offline')
    expect(response.fallback.response).toContain('temporariamente indisponíveis')
    expect(response.fallback.imageUrl).toBe('/placeholder-captain.svg')
  })

  it('should default to connection_lost reason', () => {
    const response = service.createOfflineResponse()
    expect(response.fallback.response).toContain('Conexão perdida')
  })
})

describe('PartialFailureRecoveryService', () => {
  let service: PartialFailureRecoveryService

  beforeEach(() => {
    service = new PartialFailureRecoveryService()
  })

  it('should recover from partial chat failure with partial response', async () => {
    const partialResponse = 'Guerreiro, você precisa entender que a disciplina'
    
    const recovery = await service.recoverFromPartialChatFailure(
      'Como manter disciplina?',
      partialResponse
    )

    expect(recovery.recovered).toBe(true)
    expect(recovery.recoveryMethod).toBe('partial_completion')
    expect(recovery.response).toContain(partialResponse)
    expect(recovery.response).toMatch(/\.$/) // Should end with period
  })

  it('should recover from partial chat failure with search results', async () => {
    const searchResults: SearchResult[] = [{
      content: 'A disciplina é fundamental para o sucesso no Cave Mode...',
      score: 0.9,
      metadata: { source: 'modocaverna-docs.md' }
    }]

    const recovery = await service.recoverFromPartialChatFailure(
      'Como manter disciplina?',
      undefined,
      searchResults
    )

    expect(recovery.recovered).toBe(true)
    expect(recovery.recoveryMethod).toBe('context_based')
    expect(recovery.response).toContain('disciplina é fundamental')
  })

  it('should fall back when no partial data available', async () => {
    const recovery = await service.recoverFromPartialChatFailure(
      'Test query'
    )

    expect(recovery.recovered).toBe(false)
    expect(recovery.recoveryMethod).toBe('fallback')
    expect(recovery.response).toContain('Guerreiro')
  })

  it('should complete partial responses appropriately', async () => {
    const testCases = [
      {
        input: 'Guerreiro, lembre-se',
        expected: 'Guerreiro, lembre-se - a ação é sempre o próximo passo.'
      },
      {
        input: 'A disciplina, guerreiro',
        expected: 'A disciplina, guerreiro Continue firme na sua jornada.'
      },
      {
        input: 'Incomplete sentence',
        expected: 'Incomplete sentence Mantenha o foco e continue avançando.'
      },
      {
        input: 'Complete sentence.',
        expected: 'Complete sentence.'
      }
    ]

    for (const testCase of testCases) {
      const recovery = await service.recoverFromPartialChatFailure(
        'test',
        testCase.input
      )
      expect(recovery.response).toBe(testCase.expected)
    }
  })

  it('should recover from partial image failure with fallback', async () => {
    const toneAnalysis: ToneAnalysis = {
      primary: 'motivational',
      intensity: 'high',
      themes: ['inspiration'],
      visualParameters: {
        pose: 'heroic',
        expression: 'inspiring',
        environment: 'cave',
        lighting: 'dynamic'
      }
    }

    const recovery = await service.recoverFromPartialImageFailure(toneAnalysis, true)

    expect(recovery.recovered).toBe(true)
    expect(recovery.recoveryMethod).toBe('default_image')
    expect(recovery.imageUrl).toBe('/placeholder-captain.svg')
  })

  it('should recover from partial search failure with partial results', async () => {
    const partialResults: SearchResult[] = [{
      content: 'Partial search result',
      score: 0.8,
      metadata: { source: 'test' }
    }]

    const recovery = await service.recoverFromPartialSearchFailure(
      'test query',
      partialResults
    )

    expect(recovery.recovered).toBe(true)
    expect(recovery.recoveryMethod).toBe('partial_results')
    expect(recovery.results).toEqual(partialResults)
  })

  it('should recover from partial search failure with fallback generation', async () => {
    const recovery = await service.recoverFromPartialSearchFailure('motivation query')

    expect(recovery.recovered).toBe(true)
    expect(recovery.recoveryMethod).toBe('fallback_generation')
    expect(recovery.results).toHaveLength(1)
    expect(recovery.results[0].content).toContain('transformação')
  })
})

describe('FallbackOrchestrator', () => {
  let orchestrator: FallbackOrchestrator

  beforeEach(() => {
    orchestrator = new FallbackOrchestrator()
  })

  it('should handle complete chat flow failure', async () => {
    const error = new CaptainError(ErrorType.CHAT_COMPLETION_FAILED, 'Chat failed')
    const context = {
      query: 'Test query',
      conversationId: 'test-id',
      partialResponse: 'Partial response',
      partialResults: [],
      toneAnalysis: {
        primary: 'supportive' as const,
        intensity: 'medium' as const,
        themes: ['support'],
        visualParameters: {
          pose: 'open',
          expression: 'encouraging',
          environment: 'cave',
          lighting: 'warm'
        }
      }
    }

    const response = await orchestrator.handleChatFlowFailure(error, context)

    expect(response.response).toContain('Partial response')
    expect(response.imageUrl).toBe('/placeholder-captain.svg')
    expect(response.conversationId).toBe('test-id')
  })

  it('should handle search failure', async () => {
    const results = await orchestrator.handleSearchFailure('motivation query')

    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('transformação')
    expect(results[0].metadata.source).toBe('fallback_motivation')
  })

  it('should handle image failure', async () => {
    const toneAnalysis: ToneAnalysis = {
      primary: 'challenging',
      intensity: 'high',
      themes: ['determination'],
      visualParameters: {
        pose: 'firm',
        expression: 'intense',
        environment: 'cave',
        lighting: 'dramatic'
      }
    }

    const imageUrl = await orchestrator.handleImageFailure(toneAnalysis)
    expect(imageUrl).toBe('/placeholder-captain.svg')
  })

  it('should return system health status', () => {
    const health = orchestrator.getSystemHealthStatus()

    expect(health.search).toBe('available')
    expect(health.chat).toBe('available')
    expect(health.images).toBe('available')
    expect(health.overall).toBe('healthy')
  })
})

describe('Captain Persona Consistency in Fallbacks', () => {
  it('should maintain Captain persona in all fallback responses', () => {
    const service = new ResponseFallbackService()
    const errorTypes = [
      ErrorType.SERVICE_UNAVAILABLE,
      ErrorType.RATE_LIMIT_EXCEEDED,
      ErrorType.SEMANTIC_SEARCH_FAILED,
      ErrorType.CHAT_COMPLETION_FAILED,
      ErrorType.INTERNAL_ERROR
    ]

    errorTypes.forEach(errorType => {
      const response = service.generateFallbackResponse(errorType)
      
      // Should contain Captain-like language
      expect(response.toLowerCase()).toMatch(/guerreiro|caverna|disciplina|ação|obstáculo|determinação/)
      
      // Should be action-oriented
      expect(response.toLowerCase()).toMatch(/ação|continue|foque|use|mantenha/)
      
      // Should avoid victim language
      expect(response.toLowerCase()).not.toMatch(/desculpa|pena|coitado|vítima/)
    })
  })

  it('should maintain consistent tone across all fallback services', () => {
    const searchService = new SearchFallbackService()
    const responseService = new ResponseFallbackService()
    
    const searchFallback = searchService.generateFallbackResults('test')[0].content
    const responseFallback = responseService.generateFallbackResponse(ErrorType.INTERNAL_ERROR)
    
    // Both should have warrior/cave terminology
    expect(searchFallback.toLowerCase()).toMatch(/guerreiro|caverna|ação/)
    expect(responseFallback.toLowerCase()).toMatch(/guerreiro|caverna|ação/)
    
    // Both should be empowering, not apologetic
    expect(searchFallback).not.toMatch(/desculp/i)
    expect(responseFallback).not.toMatch(/desculp/i)
  })
})