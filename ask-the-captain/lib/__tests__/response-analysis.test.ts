/**
 * Tests for Response Analysis Engine
 */

import { describe, it, expect } from 'vitest'
import {
  analyzeResponseTone,
  selectImageFrame,
  analyzeResponseForImageGeneration,
  generateImagePrompt
} from '../response-analysis'

describe('Response Analysis Engine', () => {
  describe('analyzeResponseTone', () => {
    it('should identify supportive tone', () => {
      const response = 'Bem-vindo, guerreiro! Você consegue fazer isso. Estou aqui para apoiar sua jornada.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBe('supportive')
      expect(analysis.themes).toContain('guidance')
      expect(analysis.intensity).toBe('high')
    })

    it('should identify challenging tone', () => {
      const response = 'Chega de desculpas! Pare de procrastinar e tome ação agora. Sem mimimi, só disciplina!'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBe('challenging')
      expect(analysis.themes).toContain('action')
      expect(analysis.intensity).toBe('high')
    })

    it('should identify instructional tone', () => {
      const response = 'Primeiro passo: defina seu objetivo. Segundo: crie um método. Terceiro: execute o protocolo.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBe('instructional')
      expect(analysis.themes).toContain('guidance')
      expect(analysis.intensity).toBe('high')
    })

    it('should identify motivational tone', () => {
      const response = 'Vamos, guerreiro! Esta é sua batalha pela transformação. Força e vitória!'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBe('motivational')
      expect(analysis.themes).toContain('transformation')
      expect(analysis.intensity).toBe('high')
    })

    it('should handle low intensity responses', () => {
      const response = 'Entendo.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.intensity).toBe('low')
      expect(analysis.themes).toEqual(['general'])
    })

    it('should extract multiple themes', () => {
      const response = 'Disciplina e foco são essenciais para sua transformação. Tome ação com responsabilidade.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.themes).toContain('discipline')
      expect(analysis.themes).toContain('focus')
      expect(analysis.themes).toContain('transformation')
      expect(analysis.themes).toContain('action')
      expect(analysis.themes).toContain('responsibility')
    })

    it('should generate appropriate visual parameters', () => {
      const response = 'Bem-vindo, guerreiro! Você consegue fazer isso.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.visualParameters.pose).toContain('welcoming')
      expect(analysis.visualParameters.expression).toContain('encouraging')
      expect(analysis.visualParameters.environment).toContain('inviting')
      expect(analysis.visualParameters.lighting).toContain('warm')
    })
  })

  describe('selectImageFrame', () => {
    it('should select appropriate frame for supportive tone', () => {
      const toneAnalysis = {
        primary: 'supportive' as const,
        intensity: 'medium' as const,
        themes: ['welcome', 'guidance'],
        visualParameters: {
          pose: 'open, welcoming stance',
          expression: 'warm, encouraging smile',
          environment: 'bright, inviting cave area',
          lighting: 'warm, soft illumination'
        }
      }
      
      const frame = selectImageFrame(toneAnalysis)
      
      expect(frame.suitableFor.tones).toContain('supportive')
      expect(['FRAME_01A', 'FRAME_01B', 'FRAME_01C']).toContain(frame.id)
    })

    it('should select appropriate frame for challenging tone', () => {
      const toneAnalysis = {
        primary: 'challenging' as const,
        intensity: 'high' as const,
        themes: ['challenge', 'discipline'],
        visualParameters: {
          pose: 'firm, authoritative stance',
          expression: 'intense, determined gaze',
          environment: 'dramatic cave setting',
          lighting: 'strong, contrasting shadows'
        }
      }
      
      const frame = selectImageFrame(toneAnalysis)
      
      expect(frame.suitableFor.tones).toContain('challenging')
      expect(frame.id).toBe('FRAME_02A')
    })

    it('should select appropriate frame for instructional tone', () => {
      const toneAnalysis = {
        primary: 'instructional' as const,
        intensity: 'medium' as const,
        themes: ['guidance', 'method'],
        visualParameters: {
          pose: 'gesture-based, explanatory',
          expression: 'focused, attentive',
          environment: 'clear, well-lit space',
          lighting: 'even, clear illumination'
        }
      }
      
      const frame = selectImageFrame(toneAnalysis)
      
      expect(frame.suitableFor.tones).toContain('instructional')
      expect(['FRAME_01C', 'FRAME_02A']).toContain(frame.id)
    })

    it('should select appropriate frame for motivational tone', () => {
      const toneAnalysis = {
        primary: 'motivational' as const,
        intensity: 'high' as const,
        themes: ['energy', 'transformation'],
        visualParameters: {
          pose: 'heroic, inspiring stance',
          expression: 'confident, energetic',
          environment: 'elevated, powerful setting',
          lighting: 'dramatic, uplifting'
        }
      }
      
      const frame = selectImageFrame(toneAnalysis)
      
      expect(frame.suitableFor.tones).toContain('motivational')
      expect(frame.id).toBe('FRAME_01B')
    })
  })

  describe('analyzeResponseForImageGeneration', () => {
    it('should provide complete analysis result', () => {
      const response = 'Bem-vindo ao Modo Caverna, guerreiro! Vamos começar sua transformação.'
      const result = analyzeResponseForImageGeneration(response)
      
      expect(result.tone.primary).toBe('motivational')
      expect(result.selectedFrame).toMatch(/^FRAME_/)
      expect(result.promptParameters.pose).toBeDefined()
      expect(result.promptParameters.expression).toBeDefined()
      expect(result.promptParameters.environment).toBeDefined()
      expect(result.promptParameters.lighting).toBeDefined()
      expect(result.promptParameters.cameraAngle).toBeDefined()
      expect(result.promptParameters.emotionalContext).toBeDefined()
    })

    it('should include emotional context in parameters', () => {
      const response = 'Chega de desculpas! Ação agora!'
      const result = analyzeResponseForImageGeneration(response)
      
      expect(result.promptParameters.emotionalContext).toContain('challenging')
      expect(result.promptParameters.emotionalContext).toContain('high')
    })
  })

  describe('generateImagePrompt', () => {
    it('should generate complete DALL-E prompt', () => {
      const analysisResult = {
        tone: {
          primary: 'supportive' as const,
          intensity: 'medium' as const,
          themes: ['welcome'],
          visualParameters: {
            pose: 'open, welcoming stance',
            expression: 'warm, encouraging smile',
            environment: 'bright, inviting cave area',
            lighting: 'warm, soft illumination'
          }
        },
        selectedFrame: 'FRAME_01A',
        promptParameters: {
          pose: 'Center frame, standing still, chest expanded',
          expression: 'Confident but welcoming; half-smile, intense eyes',
          environment: 'Main chamber with monumental rock arches',
          lighting: 'Rim light from cave entrance, warm bounce from wall torches',
          cameraAngle: '35mm lens, medium distance, frontal symmetrical composition',
          emotionalContext: 'supportive tone with medium intensity'
        }
      }
      
      const prompt = generateImagePrompt(analysisResult)
      
      expect(prompt).toContain('CAPITÃO CAVERNA')
      expect(prompt).toContain('Pixar-style stylised wolf')
      expect(prompt).toContain('black hoodie + red △ wolf logo')
      expect(prompt).toContain(analysisResult.promptParameters.pose)
      expect(prompt).toContain(analysisResult.promptParameters.expression)
      expect(prompt).toContain(analysisResult.promptParameters.environment)
      expect(prompt).toContain(analysisResult.promptParameters.lighting)
      expect(prompt).toContain(analysisResult.promptParameters.cameraAngle)
      expect(prompt).toContain('supportive tone with medium intensity')
      expect(prompt).toContain('NEGATIVE PROMPT')
    })

    it('should include technical specifications', () => {
      const analysisResult = {
        tone: {
          primary: 'challenging' as const,
          intensity: 'high' as const,
          themes: ['discipline'],
          visualParameters: {
            pose: 'firm, authoritative stance',
            expression: 'intense, determined gaze',
            environment: 'dramatic cave setting',
            lighting: 'strong, contrasting shadows'
          }
        },
        selectedFrame: 'FRAME_02A',
        promptParameters: {
          pose: 'Feet shoulder-width apart, arms relaxed but firm',
          expression: 'Stoic silhouette, contemplative posture',
          environment: 'High ledge overlooking deep cavern',
          lighting: 'Low cool light on left, warm flickering orange behind',
          cameraAngle: 'Wide establishing shot, 24mm lens, behind and above',
          emotionalContext: 'challenging tone with high intensity'
        }
      }
      
      const prompt = generateImagePrompt(analysisResult)
      
      expect(prompt).toContain('4096 × 2304 px minimum')
      expect(prompt).toContain('8K UDIM maps')
      expect(prompt).toContain('#FF3333')
      expect(prompt).toContain('NO grain/bloom')
    })

    it('should include negative prompts', () => {
      const analysisResult = {
        tone: {
          primary: 'instructional' as const,
          intensity: 'low' as const,
          themes: ['guidance'],
          visualParameters: {
            pose: 'gesture-based, explanatory',
            expression: 'focused, attentive',
            environment: 'clear, well-lit space',
            lighting: 'even, clear illumination'
          }
        },
        selectedFrame: 'FRAME_01C',
        promptParameters: {
          pose: 'Mid-stride, right arm mid-gesture extending hand',
          expression: 'Calm intensity; slightly softened gaze, subtle nod',
          environment: 'Deeper cave near glowing alcove',
          lighting: 'Warm red-orange glow from torch',
          cameraAngle: 'Slow dolly-in from eye level, 45mm lens',
          emotionalContext: 'instructional tone with low intensity'
        }
      }
      
      const prompt = generateImagePrompt(analysisResult)
      
      expect(prompt).toContain('NEGATIVE PROMPT')
      expect(prompt).toContain('cute, kawaii, plush')
      expect(prompt).toContain('five fingers')
      expect(prompt).toContain('subtitles, text, overlays')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty response', () => {
      const response = ''
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBeDefined()
      expect(analysis.intensity).toBe('low')
      expect(analysis.themes).toContain('general')
    })

    it('should handle response with no matching keywords', () => {
      const response = 'Hello world test message'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBeDefined()
      expect(analysis.themes).toContain('general')
    })

    it('should handle mixed tone indicators', () => {
      const response = 'Bem-vindo, guerreiro! Mas chega de desculpas. Primeiro passo é disciplina. Vamos à luta!'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBeDefined()
      expect(analysis.themes.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle very long responses', () => {
      const longResponse = 'Guerreiro, você precisa entender que a transformação é um processo longo e desafiador. '.repeat(50)
      const analysis = analyzeResponseTone(longResponse)
      
      expect(analysis.primary).toBeDefined()
      expect(analysis.intensity).toBeDefined()
      expect(analysis.themes).toBeDefined()
    })

    it('should handle responses with special characters', () => {
      const specialResponse = 'Guerreiro! @#$%^&*() Disciplina é fundamental... 123456 ação agora!'
      const analysis = analyzeResponseTone(specialResponse)
      
      expect(analysis.primary).toBeDefined()
      expect(analysis.themes).toContain('discipline')
      expect(analysis.themes).toContain('action')
    })
  })

  describe('Portuguese Language Support', () => {
    it('should correctly identify Portuguese motivational tone', () => {
      const response = 'Vamos, guerreiro! Esta é sua batalha pela transformação. Força e vitória!'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBe('motivational')
      expect(analysis.themes).toContain('transformation')
      expect(analysis.themes).toContain('energy')
    })

    it('should identify Portuguese challenging tone', () => {
      const response = 'Chega de desculpas! Pare de procrastinar e tome ação agora. Sem mimimi, só disciplina!'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBe('challenging')
      expect(analysis.themes).toContain('action')
      expect(analysis.themes).toContain('discipline')
    })

    it('should identify Portuguese instructional tone', () => {
      const response = 'Primeiro passo: defina seu objetivo. Segundo: crie um método. Terceiro: execute o protocolo.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBe('instructional')
      expect(analysis.themes).toContain('guidance')
      expect(analysis.themes).toContain('method')
    })

    it('should handle mixed Portuguese/English responses', () => {
      const response = 'Warrior, você deve take action agora. Disciplina is fundamental para seu success.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.primary).toBeDefined()
      expect(analysis.themes).toContain('action')
      expect(analysis.themes).toContain('discipline')
    })
  })

  describe('Visual Parameter Generation', () => {
    it('should generate consistent visual parameters for supportive tone', () => {
      const response = 'Bem-vindo, guerreiro! Você consegue fazer isso. Estou aqui para apoiar sua jornada.'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.visualParameters.pose).toContain('welcoming')
      expect(analysis.visualParameters.expression).toContain('encouraging')
      expect(analysis.visualParameters.environment).toContain('inviting')
      expect(analysis.visualParameters.lighting).toContain('warm')
    })

    it('should generate appropriate parameters for challenging tone', () => {
      const response = 'Chega de desculpas! Pare de procrastinar e tome ação agora!'
      const analysis = analyzeResponseTone(response)
      
      expect(analysis.visualParameters.pose).toContain('firm')
      expect(analysis.visualParameters.expression).toContain('intense')
      expect(analysis.visualParameters.environment).toContain('dramatic')
      expect(analysis.visualParameters.lighting).toContain('contrasting')
    })

    it('should adapt parameters based on intensity', () => {
      const lowIntensityResponse = 'Entendo sua situação.'
      const highIntensityResponse = 'CHEGA! AÇÃO AGORA! SEM DESCULPAS!'
      
      const lowAnalysis = analyzeResponseTone(lowIntensityResponse)
      const highAnalysis = analyzeResponseTone(highIntensityResponse)
      
      expect(lowAnalysis.intensity).toBe('low')
      expect(highAnalysis.intensity).toBe('high')
      
      // High intensity should have more dramatic visual parameters
      expect(highAnalysis.visualParameters.lighting).toContain('dramatic')
    })
  })
})