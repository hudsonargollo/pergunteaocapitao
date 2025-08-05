/**
 * Conversation State Management
 * 
 * Manages conversation state, message history, and persistence
 * for the Ask the Captain chat interface.
 */

import type { ChatMessage, ChatResponse } from '@/types'

export interface ConversationState {
  id: string
  messages: ChatMessage[]
  isActive: boolean
  lastActivity: Date
  metadata?: {
    totalMessages: number
    startedAt: Date
    lastImageUrl?: string
  }
}

export interface ConversationManagerOptions {
  maxMessages?: number
  persistToStorage?: boolean
  storageKey?: string
  autoCleanup?: boolean
  cleanupThreshold?: number // hours
}

export interface AddMessageOptions {
  generateId?: boolean
  updateLastActivity?: boolean
}

/**
 * Conversation Manager class
 */
export class ConversationManager {
  private conversations: Map<string, ConversationState> = new Map()
  private activeConversationId: string | null = null
  private options: Required<ConversationManagerOptions>
  private changeCallbacks: Set<(conversations: ConversationState[]) => void> = new Set()

  constructor(options: ConversationManagerOptions = {}) {
    this.options = {
      maxMessages: 100,
      persistToStorage: true,
      storageKey: 'ask-captain-conversations',
      autoCleanup: true,
      cleanupThreshold: 24, // 24 hours
      ...options
    }

    // Load from storage if enabled
    if (this.options.persistToStorage && typeof window !== 'undefined') {
      this.loadFromStorage()
    }

    // Setup auto cleanup
    if (this.options.autoCleanup) {
      this.setupAutoCleanup()
    }
  }

  /**
   * Subscribe to conversation changes
   */
  onChange(callback: (conversations: ConversationState[]) => void): () => void {
    this.changeCallbacks.add(callback)
    return () => this.changeCallbacks.delete(callback)
  }

  /**
   * Notify subscribers of changes
   */
  private notifyChange() {
    const conversations = Array.from(this.conversations.values())
    this.changeCallbacks.forEach(callback => callback(conversations))
  }

  /**
   * Create a new conversation
   */
  createConversation(id?: string): ConversationState {
    const conversationId = id || this.generateConversationId()
    
    const conversation: ConversationState = {
      id: conversationId,
      messages: [],
      isActive: true,
      lastActivity: new Date(),
      metadata: {
        totalMessages: 0,
        startedAt: new Date()
      }
    }

    this.conversations.set(conversationId, conversation)
    this.activeConversationId = conversationId
    
    this.persistToStorage()
    this.notifyChange()
    
    return conversation
  }

  /**
   * Get conversation by ID
   */
  getConversation(id: string): ConversationState | null {
    return this.conversations.get(id) || null
  }

  /**
   * Get active conversation
   */
  getActiveConversation(): ConversationState | null {
    if (!this.activeConversationId) {
      return null
    }
    return this.getConversation(this.activeConversationId)
  }

  /**
   * Set active conversation
   */
  setActiveConversation(id: string): boolean {
    if (this.conversations.has(id)) {
      this.activeConversationId = id
      this.notifyChange()
      return true
    }
    return false
  }

  /**
   * Get all conversations
   */
  getAllConversations(): ConversationState[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  }

  /**
   * Add message to conversation
   */
  addMessage(
    conversationId: string, 
    content: string, 
    role: 'user' | 'assistant',
    options: AddMessageOptions = {}
  ): ChatMessage | null {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) {
      return null
    }

    const message: ChatMessage = {
      id: options.generateId !== false ? this.generateMessageId() : '',
      content,
      role,
      timestamp: new Date()
    }

    conversation.messages.push(message)
    
    // Enforce message limit
    if (conversation.messages.length > this.options.maxMessages) {
      conversation.messages = conversation.messages.slice(-this.options.maxMessages)
    }

    // Update metadata
    if (conversation.metadata) {
      conversation.metadata.totalMessages = conversation.messages.length
    }

    // Update last activity
    if (options.updateLastActivity !== false) {
      conversation.lastActivity = new Date()
    }

    this.persistToStorage()
    this.notifyChange()
    
    return message
  }

  /**
   * Add user message
   */
  addUserMessage(conversationId: string, content: string): ChatMessage | null {
    return this.addMessage(conversationId, content, 'user')
  }

  /**
   * Add assistant message with optional image
   */
  addAssistantMessage(
    conversationId: string, 
    content: string, 
    imageUrl?: string
  ): ChatMessage | null {
    const message = this.addMessage(conversationId, content, 'assistant')
    
    if (message && imageUrl) {
      message.imageUrl = imageUrl
      
      // Update conversation metadata
      const conversation = this.conversations.get(conversationId)
      if (conversation?.metadata) {
        conversation.metadata.lastImageUrl = imageUrl
      }
      
      this.persistToStorage()
      this.notifyChange()
    }
    
    return message
  }

  /**
   * Process chat response and add messages
   */
  processChatResponse(
    conversationId: string,
    userMessage: string,
    response: ChatResponse
  ): { userMsg: ChatMessage | null; assistantMsg: ChatMessage | null } {
    // Add user message
    const userMsg = this.addUserMessage(conversationId, userMessage)
    
    // Add assistant message with image
    const assistantMsg = this.addAssistantMessage(
      conversationId, 
      response.response, 
      response.imageUrl
    )

    return { userMsg, assistantMsg }
  }

  /**
   * Update message (e.g., to add image URL after generation)
   */
  updateMessage(
    conversationId: string, 
    messageId: string, 
    updates: Partial<ChatMessage>
  ): boolean {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) {
      return false
    }

    const messageIndex = conversation.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) {
      return false
    }

    conversation.messages[messageIndex] = {
      ...conversation.messages[messageIndex],
      ...updates
    }

    this.persistToStorage()
    this.notifyChange()
    
    return true
  }

  /**
   * Delete conversation
   */
  deleteConversation(id: string): boolean {
    const deleted = this.conversations.delete(id)
    
    if (deleted) {
      if (this.activeConversationId === id) {
        this.activeConversationId = null
      }
      
      this.persistToStorage()
      this.notifyChange()
    }
    
    return deleted
  }

  /**
   * Clear all conversations
   */
  clearAllConversations(): void {
    this.conversations.clear()
    this.activeConversationId = null
    
    this.persistToStorage()
    this.notifyChange()
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(id: string): {
    messageCount: number
    lastMessage?: string
    lastActivity: Date
    duration: number // in minutes
  } | null {
    const conversation = this.conversations.get(id)
    if (!conversation) {
      return null
    }

    const lastMessage = conversation.messages[conversation.messages.length - 1]
    const duration = conversation.metadata?.startedAt 
      ? (conversation.lastActivity.getTime() - conversation.metadata.startedAt.getTime()) / (1000 * 60)
      : 0

    return {
      messageCount: conversation.messages.length,
      lastMessage: lastMessage?.content.substring(0, 100),
      lastActivity: conversation.lastActivity,
      duration
    }
  }

  /**
   * Generate unique conversation ID
   */
  private generateConversationId(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 8)
    return `conv_${timestamp}_${randomPart}`
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 6)
    return `msg_${timestamp}_${randomPart}`
  }

  /**
   * Persist conversations to localStorage
   */
  private persistToStorage(): void {
    if (!this.options.persistToStorage || typeof window === 'undefined') {
      return
    }

    try {
      const data = {
        conversations: Array.from(this.conversations.entries()).map(([id, conv]) => ({
          ...conv,
          lastActivity: conv.lastActivity.toISOString(),
          metadata: conv.metadata ? {
            ...conv.metadata,
            startedAt: conv.metadata.startedAt.toISOString()
          } : undefined
        })),
        activeConversationId: this.activeConversationId
      }

      localStorage.setItem(this.options.storageKey, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to persist conversations to storage:', error)
    }
  }

  /**
   * Load conversations from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.options.storageKey)
      if (!stored) {
        return
      }

      const data = JSON.parse(stored)
      
      // Restore conversations
      for (const convData of data.conversations || []) {
        const conversation: ConversationState = {
          ...convData,
          lastActivity: new Date(convData.lastActivity),
          metadata: convData.metadata ? {
            ...convData.metadata,
            startedAt: new Date(convData.metadata.startedAt)
          } : undefined
        }
        
        this.conversations.set(conversation.id, conversation)
      }

      // Restore active conversation
      this.activeConversationId = data.activeConversationId || null

      // Clean up old conversations
      this.cleanupOldConversations()
      
    } catch (error) {
      console.warn('Failed to load conversations from storage:', error)
    }
  }

  /**
   * Setup automatic cleanup of old conversations
   */
  private setupAutoCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldConversations()
    }, 60 * 60 * 1000)
  }

  /**
   * Clean up old conversations
   */
  private cleanupOldConversations(): void {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - this.options.cleanupThreshold)

    let cleaned = false
    
    for (const [id, conversation] of this.conversations.entries()) {
      if (conversation.lastActivity < cutoffTime && !conversation.isActive) {
        this.conversations.delete(id)
        cleaned = true
        
        if (this.activeConversationId === id) {
          this.activeConversationId = null
        }
      }
    }

    if (cleaned) {
      this.persistToStorage()
      this.notifyChange()
    }
  }
}

/**
 * Default conversation manager instance
 */
export const conversationManager = new ConversationManager()

/**
 * Utility functions
 */
export function formatConversationTitle(conversation: ConversationState): string {
  if (conversation.messages.length === 0) {
    return 'Nova Conversa'
  }

  const firstUserMessage = conversation.messages.find(m => m.role === 'user')
  if (firstUserMessage) {
    return firstUserMessage.content.substring(0, 30) + 
           (firstUserMessage.content.length > 30 ? '...' : '')
  }

  return `Conversa ${conversation.id.split('_')[1]}`
}

export function getConversationStats(conversation: ConversationState) {
  const userMessages = conversation.messages.filter(m => m.role === 'user').length
  const assistantMessages = conversation.messages.filter(m => m.role === 'assistant').length
  const imagesGenerated = conversation.messages.filter(m => m.imageUrl).length

  return {
    userMessages,
    assistantMessages,
    imagesGenerated,
    totalMessages: conversation.messages.length
  }
}