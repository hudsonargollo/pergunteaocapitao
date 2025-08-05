'use client';

import RealTimeChatInterface from '@/app/components/chat/RealTimeChatInterface';
import SessionManager from '@/app/components/chat/SessionManager';

export default function Home() {
  return (
    <SessionManager
      onSessionInitialized={(sessionId) => {
        console.log('Main page: Session initialized:', sessionId);
      }}
      onSessionRecovered={(sessionId) => {
        console.log('Main page: Session recovered:', sessionId);
      }}
      onSessionCleanup={() => {
        console.log('Main page: Session cleanup completed');
      }}
      enableSessionPersistence={true}
      sessionTimeout={60} // 1 hour
    >
      <RealTimeChatInterface 
        onConversationChange={(conversationId) => {
          console.log('Main page: Conversation changed to', conversationId);
        }}
        onMessageSent={(message) => {
          console.log('Main page: Message sent', message.content);
        }}
        onResponseReceived={(response) => {
          console.log('Main page: Response received', {
            hasImage: !!response.imageUrl,
            responseLength: response.response.length
          });
        }}
        onImageUpdated={(imageUrl) => {
          console.log('Main page: Captain image updated to', imageUrl);
        }}
        enableDebugInfo={process.env.NODE_ENV === 'development'}
      />
    </SessionManager>
  );
}
