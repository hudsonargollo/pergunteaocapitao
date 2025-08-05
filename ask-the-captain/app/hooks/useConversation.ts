/**
 * React Hook for Conversation Management
 * 
 * Provides React integration for conversation state management
 * with automatic updates and cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ConversationManager, 
  conversationManager as defaultManager,
  type ConversationState,
  formatConversationTitle,
  getConversationStats
} from '@/app/lib/conversation-manager'
import type { ChatMessage, ChatResponse } from '@/types'

export interface UseConversationOptions {
  manager?: ConversationManager
  autoCreateConversation?: boolean
  conversationId?: string
}

export interface UseConversationResult {
  // Current conversation state
  conversation: ConversationState | null
  messages: ChatMessage[]
  isActive: boolean
  
  // Conversation management
  createConversation: (id?: string) => ConversationState
  switchConversation: (id: string) => boolean
  deleteConversation: (id: string) => boolean
  
  // Message management
  addUserMessage: (content: string) => ChatMessage | null
  addAssistantMessage: (content: string, imageUrl?: string) => ChatMessage | null
  processChatResponse: (userMessage: string, response: ChatResponse) => void
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => boolean
  
  // Utility
  conversationTitle: string
  conversationStats: ReturnType<typeof getConversationStats>
  
  // All conversations (for sidebar, etc.)
  allConversations: ConversationState[]
}

/**
 * Main conversation hook
 */
export function useConversation(options: UseConversationOptions = {}): UseConversationResult {
  const { 
    manager = defaultManager, 
    autoCreateConversation = true,
    conversationId 
  } = options

  // State
  const [conversations, setConversations] = useState<ConversationState[]>(
    manager.getAllConversations()
  )
  const [activeConversation, setActiveConversation] = useState<ConversationState | null>(
    manager.getActiveConversation()
  )

  // Track if we've initialized
  const initializedRef = useRef(false)

  // Subscribe to conversation changes
  useEffect(() => {
    const unsubscribe = manager.onChange((updatedConversations) => {
      setConversations([...updatedConversations])
      setActiveConversation(manager.getActiveConversation())
    })

    return unsubscribe
  }, [manager])

  // Handle initial setup
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (conversationId) {
      // Try to switch to specified conversation
      const success = manager.setActiveConversation(conversationId)
      if (!success && autoCreateConversation) {
        // Create conversation with specified ID if it doesn't exist
        manager.createConversation(conversationId)
      }
    } else if (autoCreateConversation && !manager.getActiveConversation()) {
      // Create new conversation if none exists
      manager.createConversation()
    }
  }, [manager, conversationId, autoCreateConversation])

  // Conversation management methods
  const createConversation = useCallback((id?: string) => {
    return manager.createConversation(id)
  }, [manager])

  const switchConversation = useCallback((id: string) => {
    return manager.setActiveConversation(id)
  }, [manager])

  const deleteConversation = useCallback((id: string) => {
    return manager.deleteConversation(id)
  }, [manager])

  // Message management methods
  const addUserMessage = useCallback((content: string) => {
    if (!activeConversation) return null
    return manager.addUserMessage(activeConversation.id, content)
  }, [manager, activeConversation])

  const addAssistantMessage = useCallback((content: string, imageUrl?: string) => {
    if (!activeConversation) return null
    return manager.addAssistantMessage(activeConversation.id, content, imageUrl)
  }, [manager, activeConversation])

  const processChatResponse = useCallback((userMessage: string, response: ChatResponse) => {
    if (!activeConversation) return
    manager.processChatResponse(activeConversation.id, userMessage, response)
  }, [manager, activeConversation])

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    if (!activeConversation) return false
    return manager.updateMessage(activeConversation.id, messageId, updates)
  }, [manager, activeConversation])

  // Computed values
  const conversationTitle = activeConversation ? formatConversationTitle(activeConversation) : ''
  const conversationStats = activeConversation ? getConversationStats(activeConversation) : {
    userMessages: 0,
    assistantMessages: 0,
    imagesGenerated: 0,
    totalMessages: 0
  }

  return {
    conversation: activeConversation,
    messages: activeConversation?.messages || [],
    isActive: activeConversation?.isActive || false,
    createConversation,
    switchConversation,
    deleteConversation,
    addUserMessage,
    addAssistantMessage,
    processChatResponse,
    updateMessage,
    conversationTitle,
    conversationStats,
    allConversations: conversations
  }
}

/**
 * Specialized hook for chat interface
 */
export interface UseChatConversationOptions extends UseConversationOptions {
  onMessageAdded?: (message: ChatMessage) => void
  onConversationChanged?: (conversation: ConversationState | null) => void
}

export interface UseChatConversationResult extends UseConversationResult {
  sendMessage: (message: string) => Promise<ChatMessage | null>
  isWaitingForResponse: boolean
  lastUserMessage: ChatMessage | null
  lastAssistantMessage: ChatMessage | null
}

export function useChatConversation(options: UseChatConversationOptions = {}): UseChatConversationResult {
  const { onMessageAdded, onConversationChanged, ...conversationOptions } = options
  const conversation = useConversation(conversationOptions)
  
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)

  // Track message additions
  const prevMessagesLength = useRef(conversation.messages.length)
  useEffect(() => {
    if (conversation.messages.length > prevMessagesLength.current) {
      const newMessage = conversation.messages[conversation.messages.length - 1]
      onMessageAdded?.(newMessage)
    }
    prevMessagesLength.current = conversation.messages.length
  }, [conversation.messages, onMessageAdded])

  // Track conversation changes
  useEffect(() => {
    onConversationChanged?.(conversation.conversation)
  }, [conversation.conversation, onConversationChanged])

  // Send message method
  const sendMessage = useCallback(async (message: string): Promise<ChatMessage | null> => {
    setIsWaitingForResponse(true)
    
    try {
      const userMessage = conversation.addUserMessage(message)
      return userMessage
    } finally {
      setIsWaitingForResponse(false)
    }
  }, [conversation.addUserMessage])

  // Get last messages
  const lastUserMessage = conversation.messages
    .filter(m => m.role === 'user')
    .pop() || null

  const lastAssistantMessage = conversation.messages
    .filter(m => m.role === 'assistant')
    .pop() || null

  return {
    ...conversation,
    sendMessage,
    isWaitingForResponse,
    lastUserMessage,
    lastAssistantMessage
  }
}

/**
 * Hook for conversation list management (for sidebar)
 */
export interface UseConversationListOptions {
  manager?: ConversationManager
  sortBy?: 'lastActivity' | 'created' | 'messageCount'
  filterActive?: boolean
}

export interface UseConversationListResult {
  conversations: ConversationState[]
  activeConversationId: string | null
  createConversation: () => ConversationState
  switchToConversation: (id: string) => boolean
  deleteConversation: (id: string) => boolean
  clearAllConversations: () => void
  getConversationSummary: (id: string) => ReturnType<ConversationManager['getConversationSummary']>
}

export function useConversationList(options: UseConversationListOptions = {}): UseConversationListResult {
  const { 
    manager = defaultManager, 
    sortBy = 'lastActivity',
    filterActive = false 
  } = options

  const [conversations, setConversations] = useState<ConversationState[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  // Subscribe to changes
  useEffect(() => {
    const updateState = () => {
      let allConversations = manager.getAllConversations()
      
      // Apply filtering
      if (filterActive) {
        allConversations = allConversations.filter(c => c.isActive)
      }

      // Apply sorting
      switch (sortBy) {
        case 'created':
          allConversations.sort((a, b) => 
            (b.metadata?.startedAt?.getTime() || 0) - (a.metadata?.startedAt?.getTime() || 0)
          )
          break
        case 'messageCount':
          allConversations.sort((a, b) => b.messages.length - a.messages.length)
          break
        case 'lastActivity':
        default:
          allConversations.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
          break
      }

      setConversations(allConversations)
      setActiveConversationId(manager.getActiveConversation()?.id || null)
    }

    updateState()
    const unsubscribe = manager.onChange(updateState)
    return unsubscribe
  }, [manager, sortBy, filterActive])

  // Management methods
  const createConversation = useCallback(() => {
    return manager.createConversation()
  }, [manager])

  const switchToConversation = useCallback((id: string) => {
    return manager.setActiveConversation(id)
  }, [manager])

  const deleteConversation = useCallback((id: string) => {
    return manager.deleteConversation(id)
  }, [manager])

  const clearAllConversations = useCallback(() => {
    manager.clearAllConversations()
  }, [manager])

  const getConversationSummary = useCallback((id: string) => {
    return manager.getConversationSummary(id)
  }, [manager])

  return {
    conversations,
    activeConversationId,
    createConversation,
    switchToConversation,
    deleteConversation,
    clearAllConversations,
    getConversationSummary
  }
}