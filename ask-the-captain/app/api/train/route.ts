import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

interface TrainingFeedback {
  messageId: string
  userMessage: string
  captainResponse: string
  feedback: 'good' | 'bad' | 'correction'
  correction?: string
  reason?: string
  timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext()
    
    const body = await request.json()
    const { messageId, userMessage, captainResponse, feedback, correction, reason } = body

    if (!messageId || !userMessage || !captainResponse || !feedback) {
      return NextResponse.json({
        error: 'Dados incompletos para treinamento'
      }, { status: 400 })
    }

    // Store training feedback in D1 database
    const trainingData: TrainingFeedback = {
      messageId,
      userMessage,
      captainResponse,
      feedback,
      correction,
      reason,
      timestamp: new Date().toISOString()
    }

    // Insert into training_feedback table
    await env.DB.prepare(`
      INSERT INTO training_feedback (
        message_id, user_message, captain_response, feedback_type, 
        correction, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      trainingData.messageId,
      trainingData.userMessage,
      trainingData.captainResponse,
      trainingData.feedback,
      trainingData.correction || null,
      trainingData.reason || null,
      trainingData.timestamp
    ).run()

    // If it's a correction, also update the improved_responses table
    if (feedback === 'correction' && correction) {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO improved_responses (
          user_message_hash, original_response, improved_response, 
          feedback_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        hashMessage(userMessage),
        captainResponse,
        correction,
        reason || 'User correction',
        trainingData.timestamp,
        trainingData.timestamp
      ).run()
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback registrado! O Capitão aprenderá com isso.',
      trainingId: messageId
    })

  } catch (error: any) {
    console.error('Training feedback error:', error)
    
    return NextResponse.json({
      error: 'Erro ao registrar feedback de treinamento',
      details: error.message
    }, { status: 500 })
  }
}

// Get training analytics
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext()
    
    // Get feedback statistics
    const stats = await env.DB.prepare(`
      SELECT 
        feedback_type,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM training_feedback 
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY feedback_type, DATE(created_at)
      ORDER BY created_at DESC
    `).all()

    // Get recent corrections
    const recentCorrections = await env.DB.prepare(`
      SELECT 
        user_message, original_response, improved_response, 
        feedback_reason, created_at
      FROM improved_responses 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all()

    return NextResponse.json({
      stats: stats.results,
      recentCorrections: recentCorrections.results,
      summary: {
        totalFeedback: stats.results?.reduce((sum: number, row: any) => sum + row.count, 0) || 0,
        corrections: recentCorrections.results?.length || 0
      }
    })

  } catch (error: any) {
    console.error('Training analytics error:', error)
    
    return NextResponse.json({
      error: 'Erro ao buscar dados de treinamento',
      details: error.message
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