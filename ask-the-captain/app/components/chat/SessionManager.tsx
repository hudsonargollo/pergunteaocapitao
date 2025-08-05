'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useChatConversation } from '@/app/hooks/useConversation';
import { useCaptainImages } from '@/app/hooks/useCaptainImages';
import SessionRecovery from './SessionRecovery';

interface SessionManagerProps {
  children: React.ReactNode;
  onSessionInitialized?: (sessionId: string) => void;
  onSessionRecovered?: (sessionId: string) => void;
  onSessionCleanup?: () => void;
  enableSessionPersistence?: boolean;
  sessionTimeout?: number; // in minutes
}

interface SessionState {
  id: string;
  startedAt: Date;
  lastActivity: Date;
  isActive: boolean;
  conversationId?: string;
  captainImageUrl?: string;
  messageCount: number;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  children,
  onSessionInitialized,
  onSessionRecovered,
  onSessionCleanup,
  enableSessionPersistence = true,
  sessionTimeout = 60 // 1 hour default
}) => {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoverySession, setRecoverySession] = useState<SessionState | null>(null);

  // Conversation management
  const conversation = useChatConversation({
    autoCreateConversation: false, // We'll handle this manually
    onConversationChanged: (conv) => {
      if (sessionState && conv) {
        updateSessionState({
          conversationId: conv.id,
          messageCount: conv.messages?.length || 0
        });
      }
    }
  });

  // Captain images for session
  const {
    currentImage: captainImage,
    updateImage: updateCaptainImage
  } = useCaptainImages({
    initialImage: '/placeholder-captain.svg',
    enableAutoPreload: true
  });

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, []);

  // Update session activity on user interaction
  useEffect(() => {
    const handleUserActivity = () => {
      updateLastActivity();
    };

    // Listen for user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [sessionState]);

  // Session cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionState?.isActive) {
        cleanupSession();
      }
    };
  }, [sessionState]);

  // Initialize or recover session
  const initializeSession = useCallback(async () => {
    setIsInitializing(true);

    try {
      // Try to recover existing session
      const existingSession = enableSessionPersistence ? loadSessionFromStorage() : null;
      
      if (existingSession && isSessionValid(existingSession)) {
        console.log('Session Manager: Found existing session, showing recovery dialog:', existingSession.id);
        
        // Show recovery dialog instead of auto-recovering
        setRecoverySession(existingSession);
        setShowRecovery(true);
        setIsInitializing(false);
        return;
        
      } else {
        console.log('Session Manager: Creating new session');
        
        // Create new session
        const newSession: SessionState = {
          id: generateSessionId(),
          startedAt: new Date(),
          lastActivity: new Date(),
          isActive: true,
          messageCount: 0,
          captainImageUrl: '/placeholder-captain.svg'
        };
        
        setSessionState(newSession);
        
        // Initialize with default captain image
        await updateCaptainImage('/placeholder-captain.svg', false);
        
        // Save to storage
        if (enableSessionPersistence) {
          saveSessionToStorage(newSession);
        }
        
        onSessionInitialized?.(newSession.id);
      }
      
    } catch (error) {
      console.error('Session Manager: Failed to initialize session:', error);
      
      // Fallback to basic session
      const fallbackSession: SessionState = {
        id: generateSessionId(),
        startedAt: new Date(),
        lastActivity: new Date(),
        isActive: true,
        messageCount: 0
      };
      
      setSessionState(fallbackSession);
    } finally {
      setIsInitializing(false);
    }
  }, [enableSessionPersistence, conversation, updateCaptainImage, onSessionInitialized, onSessionRecovered]);

  // Update session state
  const updateSessionState = useCallback((updates: Partial<SessionState>) => {
    setSessionState(prev => {
      if (!prev) return null;
      
      const updated = {
        ...prev,
        ...updates,
        lastActivity: new Date()
      };
      
      // Save to storage
      if (enableSessionPersistence) {
        saveSessionToStorage(updated);
      }
      
      return updated;
    });
  }, [enableSessionPersistence]);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    if (sessionState?.isActive) {
      updateSessionState({ lastActivity: new Date() });
    }
  }, [sessionState, updateSessionState]);

  // Start new conversation within session
  const startConversation = useCallback(() => {
    if (!sessionState) return null;
    
    console.log('Session Manager: Starting new conversation');
    
    // Create new conversation
    const newConversation = conversation.createConversation();
    
    if (newConversation) {
      updateSessionState({
        conversationId: newConversation.id,
        messageCount: 0
      });
      
      return newConversation;
    }
    
    return null;
  }, [sessionState, conversation, updateSessionState]);

  // Update captain image in session
  const updateSessionCaptainImage = useCallback(async (imageUrl: string) => {
    if (!sessionState) return;
    
    console.log('Session Manager: Updating captain image in session:', imageUrl);
    
    await updateCaptainImage(imageUrl, true);
    updateSessionState({ captainImageUrl: imageUrl });
  }, [sessionState, updateCaptainImage, updateSessionState]);

  // Clean up session
  const cleanupSession = useCallback(() => {
    console.log('Session Manager: Cleaning up session');
    
    if (sessionState) {
      updateSessionState({ isActive: false });
    }
    
    onSessionCleanup?.();
  }, [sessionState, updateSessionState, onSessionCleanup]);

  // Handle session recovery
  const handleRecoverSession = useCallback(async () => {
    if (!recoverySession) return;
    
    console.log('Session Manager: Recovering session:', recoverySession.id);
    
    try {
      // Recover session state
      setSessionState(recoverySession);
      
      // Recover conversation if exists
      if (recoverySession.conversationId) {
        conversation.switchConversation(recoverySession.conversationId);
      }
      
      // Recover captain image if exists
      if (recoverySession.captainImageUrl) {
        await updateCaptainImage(recoverySession.captainImageUrl, false);
      }
      
      setShowRecovery(false);
      setRecoverySession(null);
      
      onSessionRecovered?.(recoverySession.id);
      
    } catch (error) {
      console.error('Session Manager: Failed to recover session:', error);
      handleStartFreshSession();
    }
  }, [recoverySession, conversation, updateCaptainImage, onSessionRecovered]);

  // Handle starting fresh session
  const handleStartFreshSession = useCallback(async () => {
    console.log('Session Manager: Starting fresh session');
    
    // Clear recovery state
    setShowRecovery(false);
    setRecoverySession(null);
    
    // Create new session
    const newSession: SessionState = {
      id: generateSessionId(),
      startedAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      messageCount: 0,
      captainImageUrl: '/placeholder-captain.svg'
    };
    
    setSessionState(newSession);
    
    // Initialize with default captain image
    await updateCaptainImage('/placeholder-captain.svg', false);
    
    // Save to storage
    if (enableSessionPersistence) {
      saveSessionToStorage(newSession);
    }
    
    onSessionInitialized?.(newSession.id);
  }, [enableSessionPersistence, updateCaptainImage, onSessionInitialized]);

  // Handle dismissing recovery dialog
  const handleDismissRecovery = useCallback(() => {
    console.log('Session Manager: Dismissing recovery dialog');
    setShowRecovery(false);
    setRecoverySession(null);
    
    // Continue with fresh session
    handleStartFreshSession();
  }, [handleStartFreshSession]);

  // Generate unique session ID
  const generateSessionId = (): string => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${randomPart}`;
  };

  // Check if session is still valid
  const isSessionValid = (session: SessionState): boolean => {
    if (!session.isActive) return false;
    
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
    
    return minutesSinceActivity < sessionTimeout;
  };

  // Save session to localStorage
  const saveSessionToStorage = (session: SessionState): void => {
    try {
      const sessionData = {
        ...session,
        startedAt: session.startedAt.toISOString(),
        lastActivity: session.lastActivity.toISOString()
      };
      
      localStorage.setItem('ask-captain-session', JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Session Manager: Failed to save session to storage:', error);
    }
  };

  // Load session from localStorage
  const loadSessionFromStorage = (): SessionState | null => {
    try {
      const stored = localStorage.getItem('ask-captain-session');
      if (!stored) return null;
      
      const sessionData = JSON.parse(stored);
      
      return {
        ...sessionData,
        startedAt: new Date(sessionData.startedAt),
        lastActivity: new Date(sessionData.lastActivity)
      };
      
    } catch (error) {
      console.warn('Session Manager: Failed to load session from storage:', error);
      return null;
    }
  };

  // Provide session context to children
  const sessionContext = {
    session: sessionState,
    isInitializing,
    startConversation,
    updateCaptainImage: updateSessionCaptainImage,
    updateLastActivity,
    cleanupSession,
    captainImage
  };

  // Clone children with session context
  const childrenWithContext = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { sessionContext } as any);
    }
    return child;
  });

  return (
    <>
      {childrenWithContext}
      
      {/* Session Recovery Dialog */}
      {showRecovery && recoverySession && (
        <SessionRecovery
          sessionId={recoverySession.id}
          conversationId={recoverySession.conversationId}
          messageCount={recoverySession.messageCount}
          lastActivity={recoverySession.lastActivity}
          onRecover={handleRecoverSession}
          onStartFresh={handleStartFreshSession}
          onDismiss={handleDismissRecovery}
          autoRecoverAfter={10}
        />
      )}
      
      {/* Session Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && sessionState && (
        <div className="fixed bottom-4 right-4 p-3 glass-subtle rounded-lg text-xs text-cave-secondary/70 max-w-xs">
          <h4 className="font-semibold text-cave-accent mb-2">Session Debug</h4>
          <div className="space-y-1">
            <p>ID: {sessionState.id.split('_')[1]}</p>
            <p>Active: {sessionState.isActive ? 'Yes' : 'No'}</p>
            <p>Messages: {sessionState.messageCount}</p>
            <p>Started: {sessionState.startedAt.toLocaleTimeString()}</p>
            <p>Last Activity: {sessionState.lastActivity.toLocaleTimeString()}</p>
            {sessionState.conversationId && (
              <p>Conversation: {sessionState.conversationId.split('_')[1]}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SessionManager;

// Export session context type for use in other components
export type { SessionState };
export interface SessionContextType {
  session: SessionState | null;
  isInitializing: boolean;
  startConversation: () => any;
  updateCaptainImage: (imageUrl: string) => Promise<void>;
  updateLastActivity: () => void;
  cleanupSession: () => void;
  captainImage: string;
}