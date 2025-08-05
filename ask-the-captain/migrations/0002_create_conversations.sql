-- Create Conversations table for future conversation history
CREATE TABLE Conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- nullable for MVP
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  image_id TEXT,
  embedding_query TEXT,
  search_results TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES GeneratedImages(image_id)
);

-- Create indexes for performance
CREATE INDEX idx_conversations_user_id ON Conversations(user_id);
CREATE INDEX idx_conversations_created_at ON Conversations(created_at);
CREATE INDEX idx_conversations_image_id ON Conversations(image_id);