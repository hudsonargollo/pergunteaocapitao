/**
 * Tests for Capitão Caverna Persona Prompt Templates
 */

import { describe, it, expect } from 'vitest'
import {
  CAPITAO_CAVERNA_PERSONA,
  buildPersonaPrompt,
  validatePersonaResponse
} from '../persona-prompts'

describe('Capitão Caverna Persona Prompts', () => {
  describe('CAPITAO_CAVERNA_PERSONA', () => {
    it('should have all required properties', () => {
      expect(CAPITAO_CAVERNA_PERSONA).toHaveProperty('systemPrompt')
      expect(CAPITAO_CAVERNA_PERSONA).toHaveProperty('contextualModifiers')
      expect(CAPITAO_CAVERNA_PERSONA).toHaveProperty('prohibitedLanguage')
      expect(CAPITAO_CAVERNA_PERSONA).toHaveProperty('requiredElements')
    })

    it('should have a comprehensive system prompt', () => {
      const { systemPrompt } = CAPITAO_CAVERNA_PERSONA
      
      expect(systemPrompt).toContain('Capitão Caverna')
      expect(systemPrompt).toContain('Purpose > Focus > Progress')
      expect(systemPrompt).toContain('warrior')
      expect(systemPrompt).toContain('discipline')
      expect(systemPrompt).toContain('action-oriented')
    })

    it('should have all contextual modifiers', () => {
      const { contextualModifiers } = CAPITAO_CAVERNA_PERSONA
      
      expect(contextualModifiers).toHaveProperty('supportive')
      expect(contextualModifiers).toHaveProperty('challenging')
      expect(contextualModifiers).toHaveProperty('instructional')
      expect(contextualModifiers).toHaveProperty('motivational')
      
      // Each modifier should be non-empty
      Object.values(contextualModifiers).forEach(modifier => {
        expect(modifier.trim()).not.toBe('')
      })
    })

    it('should have prohibited language list', () => {
      const { prohibitedLanguage } = CAPITAO_CAVERNA_PERSONA
      
      expect(Array.isArray(prohibitedLanguage)).toBe(true)
      expect(prohibitedLanguage.length).toBeGreaterThan(0)
      
      // Should include victim mentality phrases
      expect(prohibitedLanguage).toContain("it's not your fault")
      expect(prohibitedLanguage).toContain("you're a victim")
      
      // Should include empty motivational platitudes
      expect(prohibitedLanguage).toContain("just believe in yourself")
      expect(prohibitedLanguage).toContain("positive vibes only")
    })

    it('should have required elements list', () => {
      const { requiredElements } = CAPITAO_CAVERNA_PERSONA
      
      expect(Array.isArray(requiredElements)).toBe(true)
      expect(requiredElements.length).toBeGreaterThan(0)
      
      expect(requiredElements).toContain('actionable_step')
      expect(requiredElements).toContain('responsibility_focus')
      expect(requiredElements).toContain('discipline_emphasis')
    })
  })

  describe('buildPersonaPrompt', () => {
    it('should build basic prompt with context', () => {
      const context = 'Test knowledge base context'
      const prompt = buildPersonaPrompt(context)
      
      expect(prompt).toContain('Capitão Caverna')
      expect(prompt).toContain('KNOWLEDGE BASE CONTEXT:')
      expect(prompt).toContain(context)
      expect(prompt).toContain('RESPONSE REQUIREMENTS:')
    })

    it('should include tone modifier when specified', () => {
      const context = 'Test context'
      const prompt = buildPersonaPrompt(context, 'challenging')
      
      expect(prompt).toContain('CHALLENGING TONE MODIFIER:')
      expect(prompt).toContain('Call out excuses')
    })

    it('should work with empty context', () => {
      const prompt = buildPersonaPrompt('')
      
      expect(prompt).toContain('Capitão Caverna')
      expect(prompt).toContain('RESPONSE REQUIREMENTS:')
    })

    it('should include all tone modifiers correctly', () => {
      const context = 'Test context'
      
      const supportivePrompt = buildPersonaPrompt(context, 'supportive')
      expect(supportivePrompt).toContain('SUPPORTIVE TONE MODIFIER:')
      
      const challengingPrompt = buildPersonaPrompt(context, 'challenging')
      expect(challengingPrompt).toContain('CHALLENGING TONE MODIFIER:')
      
      const instructionalPrompt = buildPersonaPrompt(context, 'instructional')
      expect(instructionalPrompt).toContain('INSTRUCTIONAL TONE MODIFIER:')
      
      const motivationalPrompt = buildPersonaPrompt(context, 'motivational')
      expect(motivationalPrompt).toContain('MOTIVATIONAL TONE MODIFIER:')
    })
  })

  describe('validatePersonaResponse', () => {
    it('should validate a good response', () => {
      const goodResponse = `Warrior, you must take immediate action. Your responsibility is to create a daily discipline routine. Focus on what you can control and execute these steps today. The cave demands commitment from those who seek transformation.`
      
      const result = validatePersonaResponse(goodResponse)
      
      expect(result.isValid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should detect prohibited language', () => {
      const badResponse = `It's not your fault that you're struggling. Just believe in yourself and everything will work out. Don't be too hard on yourself.`
      
      const result = validatePersonaResponse(badResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations.some(v => v.includes('prohibited phrase'))).toBe(true)
    })

    it('should detect missing actionable steps', () => {
      const responseWithoutAction = `You are a great warrior and you have potential. The cave is a place of transformation.`
      
      const result = validatePersonaResponse(responseWithoutAction)
      
      expect(result.isValid).toBe(false)
      expect(result.violations).toContain('Missing actionable step')
      expect(result.suggestions).toContain('Add specific action the warrior should take')
    })

    it('should detect missing responsibility emphasis', () => {
      const responseWithoutResponsibility = `You should start exercising and eating better. This will help you feel good.`
      
      const result = validatePersonaResponse(responseWithoutResponsibility)
      
      expect(result.isValid).toBe(false)
      expect(result.violations).toContain('Missing responsibility emphasis')
      expect(result.suggestions).toContain('Emphasize personal responsibility and accountability')
    })

    it('should provide suggestions for improvement', () => {
      const okResponse = `You must start exercising. Take control of your health today.`
      
      const result = validatePersonaResponse(okResponse)
      
      // Should be valid but might have suggestions
      expect(result.isValid).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
    })

    it('should handle case-insensitive prohibited language detection', () => {
      const responseWithMixedCase = `IT'S NOT YOUR FAULT that things are difficult. Just BELIEVE IN YOURSELF.`
      
      const result = validatePersonaResponse(responseWithMixedCase)
      
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
    })

    it('should detect multiple violations', () => {
      const badResponse = `It's not your fault. Just believe in yourself. Don't worry about it. Everything happens for a reason.`
      
      const result = validatePersonaResponse(badResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(1)
    })
  })

  describe('Persona Consistency', () => {
    it('should maintain cave metaphor references', () => {
      const { systemPrompt } = CAPITAO_CAVERNA_PERSONA
      
      expect(systemPrompt).toContain('cave')
      expect(systemPrompt).toContain('transformation')
    })

    it('should emphasize action over comfort', () => {
      const { systemPrompt, prohibitedLanguage } = CAPITAO_CAVERNA_PERSONA
      
      expect(systemPrompt).toContain('action-oriented')
      expect(prohibitedLanguage).toContain('take it easy')
      expect(prohibitedLanguage).toContain("don't be too hard on yourself")
    })

    it('should reject victim mentality consistently', () => {
      const { prohibitedLanguage } = CAPITAO_CAVERNA_PERSONA
      
      const victimPhrases = prohibitedLanguage.filter(phrase => 
        phrase.includes('fault') || 
        phrase.includes('victim') || 
        phrase.includes('unfair')
      )
      
      expect(victimPhrases.length).toBeGreaterThan(0)
    })

    it('should include Purpose > Focus > Progress philosophy', () => {
      const { systemPrompt } = CAPITAO_CAVERNA_PERSONA
      
      expect(systemPrompt).toContain('Purpose > Focus > Progress')
      expect(systemPrompt).toContain('Purpose drives everything')
    })

    it('should address users as warriors', () => {
      const { systemPrompt } = CAPITAO_CAVERNA_PERSONA
      
      expect(systemPrompt).toContain('warrior')
      expect(systemPrompt).toContain('guerreiro')
    })

    it('should emphasize discipline and responsibility', () => {
      const { systemPrompt, requiredElements } = CAPITAO_CAVERNA_PERSONA
      
      expect(systemPrompt).toContain('discipline')
      expect(systemPrompt).toContain('responsibility')
      expect(requiredElements).toContain('responsibility_focus')
      expect(requiredElements).toContain('discipline_emphasis')
    })

    it('should combat internal enemies', () => {
      const { systemPrompt } = CAPITAO_CAVERNA_PERSONA
      
      expect(systemPrompt).toContain('procrastination')
      expect(systemPrompt).toContain('anxiety')
      expect(systemPrompt).toContain('fear of failure')
      expect(systemPrompt).toContain('constant comparison')
    })
  })

  describe('Advanced Response Validation', () => {
    it('should detect subtle victim mentality language', () => {
      const subtleVictimResponse = `I understand that circumstances have been difficult for you. It's completely understandable that you're struggling with this situation.`
      
      const result = validatePersonaResponse(subtleVictimResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.violations.some(v => v.includes('understandable'))).toBe(true)
    })

    it('should validate presence of cave metaphor when relevant', () => {
      const responseWithoutCave = `You must start exercising daily. Take responsibility for your health and commit to discipline.`
      
      const result = validatePersonaResponse(responseWithoutCave)
      
      // Should be valid but might suggest cave metaphor
      expect(result.isValid).toBe(true)
      expect(result.suggestions.some(s => s.includes('cave') || s.includes('transformation'))).toBe(true)
    })

    it('should validate actionable steps are specific', () => {
      const vagueResponse = `You should do better and try harder. Be more disciplined in your approach.`
      
      const result = validatePersonaResponse(vagueResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.violations).toContain('Missing actionable step')
      expect(result.suggestions).toContain('Add specific action the warrior should take')
    })

    it('should accept strong Capitão Caverna responses', () => {
      const strongResponse = `Guerreiro, chega de desculpas! Você deve criar um protocolo de disciplina agora mesmo. Primeiro: defina 3 objetivos claros. Segundo: elimine todas as distrações do seu ambiente. Terceiro: execute por 7 dias consecutivos sem exceções. A caverna exige compromisso total - tome controle da sua transformação hoje!`
      
      const result = validatePersonaResponse(strongResponse)
      
      expect(result.isValid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should handle mixed language responses (Portuguese/English)', () => {
      const mixedResponse = `Warrior, você must take action now. Create a daily routine and stick to it. Disciplina é fundamental para seu progresso.`
      
      const result = validatePersonaResponse(mixedResponse)
      
      expect(result.isValid).toBe(true)
      // Should detect both Portuguese and English action words
    })
  })
})