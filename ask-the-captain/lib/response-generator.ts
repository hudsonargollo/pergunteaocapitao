/**
 * Response Generation Logic with Capitão Caverna Persona Integration
 * 
 * This module handles the complete response generation flow:
 * 1. Context injection with knowledge base results
 * 2. Persona-consistent response generation
 * 3. Response validation and quality assurance
 */

import type { SearchResult, ToneAnalysis, ChatMessage } from '@/types'
import { OpenAIClient } from './openai'
import { 
  buildPersonaPrompt, 
  validatePersonaResponse,
  CAPITAO_CAVERNA_PERSONA 
} from './persona-prompts'

export interface ResponseGenerationOptions {
  temperature?: number
  maxTokens?: number
  toneModifier?: 'supportive' | 'challenging' | 'instructional' | 'motivational'
  includeValidation?: boolean
}

export interface ResponseGenerationResult {
  response: string
  toneAnalysis: ToneAnalysis
  validation: {
    isValid: boolean
    violations: string[]
    suggestions: string[]
  }
  metadata: {
    contextUsed: string
    promptTokens: number
    responseTokens: number
    processingTime: number
  }
}

export class ResponseGenerator {
  private openaiClient: OpenAIClient

  constructor(openaiApiKey: string) {
    this.openaiClient = new OpenAIClient(openaiApiKey)
  }

  /**
   * Generate a response with full persona integration and context injection
   */
  async generateResponse(
    userMessage: string,
    searchResults: SearchResult[],
    options: ResponseGenerationOptions = {}
  ): Promise<ResponseGenerationResult> {
    const startTime = Date.now()
    
    const {
      temperature = 0.7,
      maxTokens = 1000,
      toneModifier,
      includeValidation = true
    } = options

    // Build context from search results
    const context = this.buildContextFromSearchResults(searchResults)
    
    // Build persona prompt with context and tone modifier
    const systemPrompt = buildPersonaPrompt(context, toneModifier)
    
    // Generate the response
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]

    const response = await this.openaiClient.generateChatResponse(messages, {
      temperature,
      maxTokens
    })

    // Validate response against persona requirements
    const validation = includeValidation 
      ? validatePersonaResponse(response)
      : { isValid: true, violations: [], suggestions: [] }

    // If validation fails, attempt to regenerate with stricter parameters
    let finalResponse = response
    if (!validation.isValid && includeValidation) {
      finalResponse = await this.regenerateWithCorrections(
        userMessage,
        context,
        response,
        validation.violations,
        toneModifier
      )
    }

    // Analyze tone for image generation
    const toneAnalysis = await this.openaiClient.analyzeTone(finalResponse)

    const processingTime = Date.now() - startTime

    return {
      response: finalResponse,
      toneAnalysis,
      validation: includeValidation ? validatePersonaResponse(finalResponse) : validation,
      metadata: {
        contextUsed: context,
        promptTokens: this.estimateTokens(systemPrompt + userMessage),
        responseTokens: this.estimateTokens(finalResponse),
        processingTime
      }
    }
  }

  /**
   * Generate response with conversation history context
   */
  async generateResponseWithHistory(
    userMessage: string,
    searchResults: SearchResult[],
    conversationHistory: ChatMessage[],
    options: ResponseGenerationOptions = {}
  ): Promise<ResponseGenerationResult> {
    const startTime = Date.now()
    
    const {
      temperature = 0.7,
      maxTokens = 1000,
      toneModifier,
      includeValidation = true
    } = options

    // Build context from search results
    const context = this.buildContextFromSearchResults(searchResults)
    
    // Build persona prompt with context and tone modifier
    const systemPrompt = buildPersonaPrompt(context, toneModifier)
    
    // Build conversation messages with history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ]

    // Add recent conversation history (last 6 messages to stay within context limits)
    const recentHistory = conversationHistory.slice(-6)
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage })

    const response = await this.openaiClient.generateChatResponse(messages, {
      temperature,
      maxTokens
    })

    // Validate response against persona requirements
    const validation = includeValidation 
      ? validatePersonaResponse(response)
      : { isValid: true, violations: [], suggestions: [] }

    // If validation fails, attempt to regenerate with stricter parameters
    let finalResponse = response
    if (!validation.isValid && includeValidation) {
      finalResponse = await this.regenerateWithCorrections(
        userMessage,
        context,
        response,
        validation.violations,
        toneModifier
      )
    }

    // Analyze tone for image generation
    const toneAnalysis = await this.openaiClient.analyzeTone(finalResponse)

    const processingTime = Date.now() - startTime

    return {
      response: finalResponse,
      toneAnalysis,
      validation: includeValidation ? validatePersonaResponse(finalResponse) : validation,
      metadata: {
        contextUsed: context,
        promptTokens: this.estimateTokens(systemPrompt + userMessage),
        responseTokens: this.estimateTokens(finalResponse),
        processingTime
      }
    }
  }

  /**
   * Build context string from search results
   */
  private buildContextFromSearchResults(searchResults: SearchResult[]): string {
    if (!searchResults || searchResults.length === 0) {
      return 'No specific context found in the knowledge base. Respond as Capitão Caverna would, acknowledging the limitation while providing general guidance based on the Modo Caverna philosophy.'
    }

    const contextParts = searchResults.map((result, index) => {
      const source = result.metadata.source || 'Unknown'
      const section = result.metadata.section ? ` - ${result.metadata.section}` : ''
      
      return `[Context ${index + 1}] (Source: ${source}${section})\n${result.content.trim()}`
    })

    return contextParts.join('\n\n')
  }

  /**
   * Regenerate response with corrections based on validation failures
   */
  private async regenerateWithCorrections(
    userMessage: string,
    context: string,
    originalResponse: string,
    violations: string[],
    toneModifier?: 'supportive' | 'challenging' | 'instructional' | 'motivational'
  ): Promise<string> {
    const correctionPrompt = `
The previous response had these issues:
${violations.join('\n- ')}

Original response: "${originalResponse}"

Generate a corrected response that:
- Includes specific actionable steps
- Emphasizes personal responsibility and accountability
- Uses direct, uncompromising language appropriate for Capitão Caverna
- Avoids victim mentality or excuse-enabling language
- Maintains the warrior mentor persona
`

    const systemPrompt = buildPersonaPrompt(context, toneModifier) + '\n\n' + correctionPrompt

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]

    return await this.openaiClient.generateChatResponse(messages, {
      temperature: 0.5, // Lower temperature for more consistent corrections
      maxTokens: 1000
    })
  }

  /**
   * Determine appropriate tone modifier based on user message content
   */
  determineToneModifier(userMessage: string): 'supportive' | 'challenging' | 'instructional' | 'motivational' {
    const message = userMessage.toLowerCase()

    // Check for excuse-making or victim mentality
    const excusePatterns = [
      'can\'t', 'impossible', 'too hard', 'not my fault', 'unfair', 
      'don\'t have time', 'too busy', 'tried everything'
    ]
    if (excusePatterns.some(pattern => message.includes(pattern))) {
      return 'challenging'
    }

    // Check for requests for specific guidance or how-to
    const instructionalPatterns = [
      'how to', 'how do i', 'what should i', 'steps', 'guide', 'teach me'
    ]
    if (instructionalPatterns.some(pattern => message.includes(pattern))) {
      return 'instructional'
    }

    // Check for motivation-seeking language
    const motivationalPatterns = [
      'motivation', 'inspire', 'give up', 'quit', 'hopeless', 'discouraged'
    ]
    if (motivationalPatterns.some(pattern => message.includes(pattern))) {
      return 'motivational'
    }

    // Check for progress sharing or positive updates
    const supportivePatterns = [
      'did', 'completed', 'finished', 'accomplished', 'progress', 'better'
    ]
    if (supportivePatterns.some(pattern => message.includes(pattern))) {
      return 'supportive'
    }

    // Default to instructional for neutral queries
    return 'instructional'
  }

  /**
   * Simple token estimation (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Generate fallback response when search results are insufficient
   */
  async generateFallbackResponse(
    userMessage: string,
    toneModifier?: 'supportive' | 'challenging' | 'instructional' | 'motivational'
  ): Promise<string> {
    const fallbackContext = `
The user's question cannot be answered with specific information from the Modo Caverna knowledge base. 
Respond as Capitão Caverna would, acknowledging this limitation while providing general guidance 
based on the core philosophy of Purpose > Focus > Progress and the warrior mindset.
`

    const systemPrompt = buildPersonaPrompt(fallbackContext, toneModifier)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]

    return await this.openaiClient.generateChatResponse(messages, {
      temperature: 0.8,
      maxTokens: 800
    })
  }
}