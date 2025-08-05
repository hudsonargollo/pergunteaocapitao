/**
 * Test script for character consistency system
 * 
 * This script demonstrates how to use the enhanced image generation
 * with character reference images for consistent Capitão Caverna appearance.
 */

import { generateCaptainImage, generateCaptainImageWithReferences } from '../lib/image-generation'
import { createCharacterReferenceManager } from '../lib/character-reference'
import type { CloudflareEnv } from '../types'

// Mock environment for testing
const mockEnv: CloudflareEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
  DB: {} as any,
  VECTORIZE_INDEX: {} as any,
  R2_BUCKET: {} as any,
  ASSETS: {} as any
}

async function testCharacterConsistency() {
  console.log('🎨 Testing Character Consistency System')
  console.log('=====================================')
  
  // Test 1: Basic character-consistent generation
  console.log('\n1. Testing basic character consistency...')
  try {
    const result1 = await generateCaptainImage(
      'Bem-vindo ao Modo Caverna, guerreiro! Vamos começar sua transformação.',
      mockEnv,
      {
        characterConsistency: {
          useReferenceImages: true,
          enhancedPrompting: true
        }
      }
    )
    console.log('✅ Basic generation successful:', result1.imageId)
  } catch (error) {
    console.log('❌ Basic generation failed:', error)
  }
  
  // Test 2: Generation with specific reference images
  console.log('\n2. Testing with specific reference images...')
  try {
    const result2 = await generateCaptainImageWithReferences(
      'Chega de desculpas! É hora de agir com disciplina.',
      mockEnv,
      ['ref-front-neutral', 'ref-front-winking-thumbsup'],
      {
        quality: 'hd',
        size: '1024x1024'
      }
    )
    console.log('✅ Reference-specific generation successful:', result2.imageId)
  } catch (error) {
    console.log('❌ Reference-specific generation failed:', error)
  }
  
  // Test 3: Character reference manager
  console.log('\n3. Testing character reference manager...')
  const referenceManager = createCharacterReferenceManager(mockEnv)
  
  const allReferences = referenceManager.getAllReferences()
  console.log(`📚 Available references: ${allReferences.length}`)
  allReferences.forEach(ref => {
    console.log(`  - ${ref.id}: ${ref.name} (${ref.angle}, ${ref.expression})`)
  })
  
  // Test reference selection
  const frontSmiling = referenceManager.selectReferenceImages('front', 'smiling', 1)
  console.log(`🎯 Selected for front/smiling: ${frontSmiling.map(r => r.id).join(', ')}`)
  
  const neutralAny = referenceManager.selectReferenceImages(undefined, 'neutral', 2)
  console.log(`🎯 Selected for neutral expression: ${neutralAny.map(r => r.id).join(', ')}`)
  
  // Test character description generation
  const description = referenceManager.generateCharacterDescription(frontSmiling)
  console.log('\n📝 Generated character description:')
  console.log(description.substring(0, 200) + '...')
  
  console.log('\n✨ Character consistency testing complete!')
}

// Run tests if this file is executed directly
if (require.main === module) {
  testCharacterConsistency().catch(console.error)
}

export { testCharacterConsistency }