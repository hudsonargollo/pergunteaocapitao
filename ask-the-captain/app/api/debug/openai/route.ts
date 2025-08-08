import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { OpenAIClient } from '@/lib/openai'

export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext()
    
    // Check if API key exists
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OPENAI_API_KEY not configured',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
    // Check API key format
    const apiKeyInfo = {
      exists: !!env.OPENAI_API_KEY,
      length: env.OPENAI_API_KEY?.length || 0,
      prefix: env.OPENAI_API_KEY?.substring(0, 7) || 'none',
      isValidFormat: env.OPENAI_API_KEY?.startsWith('sk-') || false
    }
    
    // Test direct OpenAI API call with fetch
    const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello from Cloudflare Workers!" in Portuguese.' }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    })
    
    const responseData = await testResponse.json()
    
    return NextResponse.json({
      success: testResponse.ok,
      status: testResponse.status,
      apiKeyInfo,
      response: responseData,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      type: error.constructor.name,
      status: error.status,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}