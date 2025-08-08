import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext()
    
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: {
          code: 'MISSING_API_KEY',
          message: 'Configuração técnica pendente, guerreiro. O Capitão retornará em breve.',
          timestamp: new Date().toISOString()
        }
      }, { status: 500 })
    }

    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Fale claramente, guerreiro. Sua mensagem é necessária.',
          timestamp: new Date().toISOString()
        }
      }, { status: 400 })
    }

    // Check for improved response first
    const messageHash = hashMessage(message)
    const improvedResponse = await env.DB.prepare(`
      SELECT improved_response, usage_count 
      FROM improved_responses 
      WHERE user_message_hash = ?
    `).bind(messageHash).first()

    if (improvedResponse) {
      // Update usage count
      await env.DB.prepare(`
        UPDATE improved_responses 
        SET usage_count = usage_count + 1, updated_at = ? 
        WHERE user_message_hash = ?
      `).bind(new Date().toISOString(), messageHash).run()

      return NextResponse.json({
        response: improvedResponse.improved_response,
        imageUrl: '/reference1-capitao-caverna-front-20250422_0526_3D Cartoon Figure_remix_01jse9j3vrfkmasmwvaw81ps2f.webp',
        conversationId: `simple_${Date.now()}`,
        timestamp: new Date().toISOString(),
        isImproved: true
      })
    }

    // Simple direct OpenAI call with Captain persona
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é o Capitão Caverna, mentor direto e implacável do Modo Caverna.

REGRAS ESSENCIAIS:
- SEJA CONCISO: Máximo 2-3 frases por resposta
- SEJA DIRETO: Vá direto ao ponto, sem enrolação
- SEJA PRÁTICO: Dê 1 ação específica, não listas longas
- Trate como "guerreiro"
- Foque em AÇÃO imediata, não teoria

FILOSOFIA: Propósito > Foco > Progresso

ESTILO: Firme, motivador, sem rodeios. Como um sargento que quer ver resultados.

EXEMPLO DE RESPOSTA BOA:
"Guerreiro, pare de pensar e comece a agir. Escolha UMA coisa hoje e execute. O resto é conversa fiada."

Responda sempre em português, sendo CONCISO e DIRETO.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const captainResponse = data.choices[0]?.message?.content || 'Guerreiro, algo inesperado aconteceu. Tente novamente.'

    return NextResponse.json({
      response: captainResponse,
      imageUrl: '/reference1-capitao-caverna-front-20250422_0526_3D Cartoon Figure_remix_01jse9j3vrfkmasmwvaw81ps2f.webp',
      conversationId: `simple_${Date.now()}`,
      timestamp: new Date().toISOString(),
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    })

  } catch (error: any) {
    console.error('Simple chat error:', error)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do sistema, guerreiro. Mesmo na adversidade, o guerreiro encontra oportunidades de crescimento.',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }
    }, { status: 500 })
  }
}

// Simple hash function for message deduplication
function hashMessage(message: string): string {
  let hash = 0
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}