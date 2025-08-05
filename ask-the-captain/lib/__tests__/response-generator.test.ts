/**
 * Tests for Response Generator with Persona Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResponseGenerator } from '../response-generator'
import type { SearchResult, ChatMessage } from '@/types'

// Mock the OpenAI client
vi.mock('../openai', () => ({
  OpenAIClient: vi.fn().mockImplementation(() => ({
    generateChatResponse: vi.fn(),
    analyzeTone: vi.fn()
  }))
}))

describe('ResponseGenerator', () => {
  let responseGenerator: ResponseGenerator
  let mockOpenAIClient: any

  beforeEach(() => {
    responseGenerator = new ResponseGenerator('test-api-key')
    mockOpenAIClient = (responseGenerator as any).openaiClient
  })

  describe('generateResponse', () => {
    it('should generate response with search results context', async () => {
      const mockResponse = 'Warrior, you must take action now. Your responsibility is to implement these steps immediately.'
      const mockToneAnalysis = {
        primary: 'challenging' as const,
        intensity: 'high' as const,
        themes: ['action', 'responsibility', 'discipline'],
        visualParameters: {
          pose: 'commanding stance',
          expression: 'intense focus',
          environment: 'cave interior',
          lighting: 'dramatic shadows'
        }
      }

      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockResponse)
      mockOpenAIClient.analyzeTone.mockResolvedValue(mockToneAnalysis)

      const searchResults: SearchResult[] = [
        {
          content: 'The cave mode requires discipline and daily action.',
          score: 0.9,
          metadata: { source: 'modocaverna-docs.md', section: 'Cave Mode Principles' }
        }
      ]

      const result = await responseGenerator.generateResponse(
        'How do I start cave mode?',
        searchResults
      )

      expect(result.response).toBe(mockResponse)
      expect(result.toneAnalysis).toEqual(mockToneAnalysis)
      expect(result.validation.isValid).toBe(true)
      expect(result.metadata.contextUsed).toContain('cave mode requires discipline')
      expect(mockOpenAIClient.generateChatResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'How do I start cave mode?' })
        ]),
        expect.objectContaining({ temperature: 0.7, maxTokens: 1000 })
      )
    })

    it('should handle empty search results', async () => {
      const mockResponse = 'Warrior, even without specific guidance, you must act on what you know.'
      const mockToneAnalysis = {
        primary: 'motivational' as const,
        intensity: 'medium' as const,
        themes: ['action', 'self-reliance'],
        visualParameters: {
          pose: 'confident stance',
          expression: 'determined',
          environment: 'cave interior',
          lighting: 'warm glow'
        }
      }

      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockResponse)
      mockOpenAIClient.analyzeTone.mockResolvedValue(mockToneAnalysis)

      const result = await responseGenerator.generateResponse(
        'What should I do?',
        []
      )

      expect(result.response).toBe(mockResponse)
      expect(result.metadata.contextUsed).toContain('No specific context found')
    })

    it('should apply tone modifier correctly', async () => {
      const mockResponse = 'Stop making excuses, warrior! You know what needs to be done.'
      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockResponse)
      mockOpenAIClient.analyzeTone.mockResolvedValue({
        primary: 'challenging',
        intensity: 'high',
        themes: ['accountability'],
        visualParameters: {
          pose: 'confrontational',
          expression: 'stern',
          environment: 'cave interior',
          lighting: 'harsh shadows'
        }
      })

      const searchResults: SearchResult[] = [
        {
          content: 'Excuses are the enemy of progress.',
          score: 0.8,
          metadata: { source: 'test-doc' }
        }
      ]

      await responseGenerator.generateResponse(
        'I can\'t do this',
        searchResults,
        { toneModifier: 'challenging' }
      )

      const systemPromptCall = mockOpenAIClient.generateChatResponse.mock.calls[0][0][0]
      expect(systemPromptCall.content).toContain('CHALLENGING TONE MODIFIER')
    })

    it('should regenerate response if validation fails', async () => {
      const invalidResponse = 'It\'s not your fault. Just believe in yourself.'
      const validResponse = 'Warrior, you must take control. Start with these specific actions.'
      
      mockOpenAIClient.generateChatResponse
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse)
      
      mockOpenAIClient.analyzeTone.mockResolvedValue({
        primary: 'instructional',
        intensity: 'medium',
        themes: ['action'],
        visualParameters: {
          pose: 'teaching',
          expression: 'focused',
          environment: 'cave interior',
          lighting: 'clear'
        }
      })

      const result = await responseGenerator.generateResponse(
        'I need help',
        [],
        { includeValidation: true }
      )

      expect(result.response).toBe(validResponse)
      expect(mockOpenAIClient.generateChatResponse).toHaveBeenCalledTimes(2)
    })
  })

  describe('generateResponseWithHistory', () => {
    it('should include conversation history in context', async () => {
      const mockResponse = 'Building on our previous discussion, warrior, now you must execute.'
      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockResponse)
      mockOpenAIClient.analyzeTone.mockResolvedValue({
        primary: 'instructional',
        intensity: 'medium',
        themes: ['execution'],
        visualParameters: {
          pose: 'guiding',
          expression: 'focused',
          environment: 'cave interior',
          lighting: 'steady'
        }
      })

      const conversationHistory: ChatMessage[] = [
        {
          id: '1',
          content: 'How do I start?',
          role: 'user',
          timestamp: new Date()
        },
        {
          id: '2',
          content: 'Warrior, you must begin with discipline.',
          role: 'assistant',
          timestamp: new Date()
        }
      ]

      const searchResults: SearchResult[] = [
        {
          content: 'Discipline is the foundation of transformation.',
          score: 0.9,
          metadata: { source: 'test-doc' }
        }
      ]

      await responseGenerator.generateResponseWithHistory(
        'What\'s the next step?',
        searchResults,
        conversationHistory
      )

      const messagesCall = mockOpenAIClient.generateChatResponse.mock.calls[0][0]
      expect(messagesCall).toHaveLength(4) // system + 2 history + current user message
      expect(messagesCall[1]).toEqual({
        role: 'user',
        content: 'How do I start?'
      })
      expect(messagesCall[2]).toEqual({
        role: 'assistant',
        content: 'Warrior, you must begin with discipline.'
      })
    })

    it('should limit conversation history to recent messages', async () => {
      const mockResponse = 'Focus on the present action, warrior.'
      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockResponse)
      mockOpenAIClient.analyzeTone.mockResolvedValue({
        primary: 'instructional',
        intensity: 'medium',
        themes: ['focus'],
        visualParameters: {
          pose: 'centered',
          expression: 'calm',
          environment: 'cave interior',
          lighting: 'focused beam'
        }
      })

      // Create 10 messages (should only use last 6)
      const conversationHistory: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        content: `Message ${i + 1}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: new Date()
      }))

      await responseGenerator.generateResponseWithHistory(
        'Current question',
        [],
        conversationHistory
      )

      const messagesCall = mockOpenAIClient.generateChatResponse.mock.calls[0][0]
      // Should be: system + 6 history + current = 8 messages
      expect(messagesCall).toHaveLength(8)
      expect(messagesCall[1].content).toBe('Message 5') // Should start from message 5
    })
  })

  describe('determineToneModifier', () => {
    it('should detect challenging tone for excuse-making', () => {
      const excuseMessages = [
        'I can\'t do this',
        'It\'s impossible',
        'Too hard for me',
        'Not my fault',
        'I don\'t have time'
      ]

      excuseMessages.forEach(message => {
        const tone = responseGenerator.determineToneModifier(message)
        expect(tone).toBe('challenging')
      })
    })

    it('should detect instructional tone for how-to questions', () => {
      const instructionalMessages = [
        'How to start cave mode?',
        'What should I do first?',
        'Can you guide me through the steps?',
        'Teach me the process'
      ]

      instructionalMessages.forEach(message => {
        const tone = responseGenerator.determineToneModifier(message)
        expect(tone).toBe('instructional')
      })
    })

    it('should detect motivational tone for discouragement', () => {
      const motivationalMessages = [
        'I want to give up',
        'Feeling hopeless',
        'Need motivation',
        'Want to quit'
      ]

      motivationalMessages.forEach(message => {
        const tone = responseGenerator.determineToneModifier(message)
        expect(tone).toBe('motivational')
      })
    })

    it('should detect supportive tone for progress sharing', () => {
      const supportiveMessages = [
        'I completed the first step',
        'Made some progress today',
        'Finished the exercise',
        'Feeling better now'
      ]

      supportiveMessages.forEach(message => {
        const tone = responseGenerator.determineToneModifier(message)
        expect(tone).toBe('supportive')
      })
    })

    it('should default to instructional for neutral messages', () => {
      const neutralMessages = [
        'Hello',
        'What is cave mode?',
        'Tell me about discipline'
      ]

      neutralMessages.forEach(message => {
        const tone = responseGenerator.determineToneModifier(message)
        expect(tone).toBe('instructional')
      })
    })
  })

  describe('generateFallbackResponse', () => {
    it('should generate fallback response when search results are insufficient', async () => {
      const mockFallbackResponse = 'Warrior, while I don\'t have specific guidance on this topic, remember that Purpose > Focus > Progress.'
      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockFallbackResponse)

      const result = await responseGenerator.generateFallbackResponse(
        'What about something not in the knowledge base?'
      )

      expect(result).toBe(mockFallbackResponse)
      
      const systemPromptCall = mockOpenAIClient.generateChatResponse.mock.calls[0][0][0]
      expect(systemPromptCall.content).toContain('cannot be answered with specific information')
      expect(systemPromptCall.content).toContain('Purpose > Focus > Progress')
    })

    it('should apply tone modifier to fallback response', async () => {
      const mockFallbackResponse = 'Stop looking for excuses, warrior!'
      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockFallbackResponse)

      await responseGenerator.generateFallbackResponse(
        'I can\'t find the answer',
        'challenging'
      )

      const systemPromptCall = mockOpenAIClient.generateChatResponse.mock.calls[0][0][0]
      expect(systemPromptCall.content).toContain('CHALLENGING TONE MODIFIER')
    })
  })

  describe('error handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAIClient.generateChatResponse.mockRejectedValue(new Error('API Error'))

      await expect(
        responseGenerator.generateResponse('Test message', [])
      ).rejects.toThrow('API Error')
    })

    it('should handle tone analysis errors with fallback', async () => {
      const mockResponse = 'Test response'
      mockOpenAIClient.generateChatResponse.mockResolvedValue(mockResponse)
      mockOpenAIClient.analyzeTone.mockRejectedValue(new Error('Analysis failed'))

      await expect(
        responseGenerator.generateResponse('Test message', [])
      ).rejects.toThrow('Analysis failed')
    })
  })

  describe('metadata tracking', () => {
    it('should track processing time and token estimates', async () => {
      const mockResponse = 'Warrior, take action now!'
      
      // Add a small delay to ensure processing time > 0
      mockOpenAIClient.generateChatResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return mockResponse
      })
      
      mockOpenAIClient.analyzeTone.mockResolvedValue({
        primary: 'challenging',
        intensity: 'high',
        themes: ['action'],
        visualParameters: {
          pose: 'commanding',
          expression: 'intense',
          environment: 'cave',
          lighting: 'dramatic'
        }
      })

      const result = await responseGenerator.generateResponse('Test message', [])

      expect(result.metadata.processingTime).toBeGreaterThan(0)
      expect(result.metadata.promptTokens).toBeGreaterThan(0)
      expect(result.metadata.responseTokens).toBeGreaterThan(0)
      expect(typeof result.metadata.contextUsed).toBe('string')
    })
  })
})