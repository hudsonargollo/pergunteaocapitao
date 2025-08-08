-- Training feedback table
CREATE TABLE IF NOT EXISTS training_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  captain_response TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('good', 'bad', 'correction')),
  correction TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Improved responses lookup table
CREATE TABLE IF NOT EXISTS improved_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_message_hash TEXT UNIQUE NOT NULL,
  original_response TEXT NOT NULL,
  improved_response TEXT NOT NULL,
  feedback_reason TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_training_feedback_message_id ON training_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_training_feedback_created_at ON training_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_improved_responses_hash ON improved_responses(user_message_hash);