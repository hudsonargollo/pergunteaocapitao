-- Create GeneratedImages table for storing image metadata
CREATE TABLE GeneratedImages (
  image_id TEXT PRIMARY KEY,
  r2_object_key TEXT NOT NULL,
  prompt_parameters TEXT, -- JSON
  response_context TEXT,
  tone_analysis TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX idx_generated_images_created_at ON GeneratedImages(created_at);