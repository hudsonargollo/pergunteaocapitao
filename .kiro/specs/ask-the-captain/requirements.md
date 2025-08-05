# Requirements Document

## Introduction

The "Ask the Captain" platform is a strategic refuge and mental battleground for individuals committed to escaping mediocrity. This immersive self-help tool features an AI assistant embodying the "Capitão Caverna" persona - a direct, uncompromising mentor who guides users through action and discipline. The platform embodies the core philosophy of Cave Mode: Purpose > Focus > Progress.

The MVP focuses on two critical capabilities: (1) State-of-the-art semantic search accuracy over a defined knowledge base, and (2) Dynamic, context-aware image generation of the Captain character with every interaction. The architecture must be 100% Cloudflare-native and designed for future scalability.

## Requirements

### Requirement 1: Immersive Chat Interface

**User Story:** As a warrior seeking self-mastery, I want a clean, high-contrast, and immersive chat interface so that I can focus entirely on my conversation with Capitão Caverna without distractions.

#### Acceptance Criteria

1. WHEN the user visits the platform THEN the system SHALL display a minimalist, single-column chat interface
2. WHEN the interface loads THEN the system SHALL ensure high contrast ratios for accessibility and visual clarity
3. WHEN accessed from any device THEN the system SHALL provide a fully responsive design across desktop and mobile
4. WHEN the session starts THEN the system SHALL display Capitão Caverna with a greeting and clear call to action
5. IF the user is on mobile THEN the system SHALL maintain full functionality and readability

### Requirement 2: Dynamic Captain Presence

**User Story:** As a user engaging with the platform, I want to see Capitão Caverna's image dynamically update with each response so that I feel his presence and connection to the conversation context.

#### Acceptance Criteria

1. WHEN the platform loads THEN the system SHALL display a visually rendered image of Capitão Caverna at all times
2. WHEN the AI generates a new response THEN the system SHALL dynamically update the Captain's image to reflect the conversation context
3. WHEN the image is generated THEN the system SHALL ensure it matches the tone and theme of the AI's response
4. WHEN the image updates THEN the system SHALL provide smooth visual transitions without disrupting the conversation flow

### Requirement 3: High-Performance Semantic Search

**User Story:** As a user asking questions, I want the AI to provide accurate, contextually relevant answers based on the Modo Caverna knowledge base so that I receive authentic guidance aligned with the methodology.

#### Acceptance Criteria

1. WHEN a user submits a question THEN the system SHALL generate an embedding for the query using OpenAI
2. WHEN the embedding is created THEN the system SHALL perform semantic search against the Cloudflare Vectorize index
3. WHEN relevant content is found THEN the system SHALL retrieve the top N most relevant chunks from the knowledge base
4. WHEN constructing the AI prompt THEN the system SHALL include only the retrieved contextual information
5. WHEN generating responses THEN the system SHALL instruct the AI to answer based ONLY on the provided context
6. WHEN no relevant context is found THEN the system SHALL respond as Capitão Caverna would, acknowledging the limitation

### Requirement 4: Knowledge Base Processing

**User Story:** As a system administrator, I want an automated knowledge base ingestion pipeline so that all Modo Caverna content is properly processed and searchable through semantic search.

#### Acceptance Criteria

1. WHEN the ingestion script runs THEN the system SHALL process all documents in modocaverna-docs.md
2. WHEN processing PDF files THEN the system SHALL extract text from all files in the aulas-modocaverna-cavefocus folder
3. WHEN documents are processed THEN the system SHALL chunk them into meaningful segments
4. WHEN chunks are created THEN the system SHALL generate embeddings using OpenAI models
5. WHEN embeddings are generated THEN the system SHALL store them in the Cloudflare Vectorize index
6. WHEN the process completes THEN the system SHALL provide confirmation of successful ingestion

### Requirement 5: Contextual Image Generation

**User Story:** As a user receiving responses from Capitão Caverna, I want each response to be accompanied by a unique, contextually appropriate image of the Captain so that the interaction feels dynamic and personalized.

#### Acceptance Criteria

1. WHEN the AI generates a text response THEN the system SHALL analyze the content, tone, and key themes
2. WHEN the analysis is complete THEN the system SHALL programmatically select appropriate visual parameters from base prompts
3. WHEN parameters are selected THEN the system SHALL construct a detailed image prompt combining base character description with selected parameters
4. WHEN the prompt is ready THEN the system SHALL call the image generation service (DALL-E 3)
5. WHEN the image is generated THEN the system SHALL store it in Cloudflare R2 with a unique identifier
6. WHEN the image is stored THEN the system SHALL save metadata in Cloudflare D1 including image_id, r2_object_key, prompt_parameters, and created_at
7. WHEN metadata is saved THEN the system SHALL return the public R2 URL to the frontend

### Requirement 6: Capitão Caverna Persona Consistency

**User Story:** As a user seeking guidance, I want Capitão Caverna to maintain a consistent persona of being direct, firm, disciplined, and action-oriented so that I receive authentic mentorship aligned with Cave Mode philosophy.

#### Acceptance Criteria

1. WHEN generating responses THEN the system SHALL ensure the AI embodies the Captain's direct and firm tone
2. WHEN addressing the user THEN the system SHALL treat them as a "warrior who has finally awakened"
3. WHEN providing guidance THEN the system SHALL focus on taking responsibility and definitive steps for self-mastery
4. WHEN the user makes excuses THEN the system SHALL redirect toward action and accountability
5. WHEN responding to questions THEN the system SHALL avoid victimhood language and motivational platitudes

### Requirement 7: Cloudflare-Native Architecture

**User Story:** As a system operator, I want the entire platform built on Cloudflare's developer platform so that we achieve minimal latency, unified operations, and optimal performance.

#### Acceptance Criteria

1. WHEN deploying the application THEN the system SHALL run entirely on Cloudflare Workers
2. WHEN storing relational data THEN the system SHALL use Cloudflare D1 for image metadata and future conversation histories
3. WHEN performing vector operations THEN the system SHALL use Cloudflare Vectorize for semantic search
4. WHEN storing images THEN the system SHALL use Cloudflare R2 for all generated Captain images
5. WHEN serving the web application THEN the system SHALL use Next.js with OpenNext adapter optimized for Cloudflare

### Requirement 8: API Endpoint Architecture

**User Story:** As a frontend developer, I want well-defined API endpoints so that I can integrate the chat functionality and image generation seamlessly.

#### Acceptance Criteria

1. WHEN implementing chat functionality THEN the system SHALL provide a POST /api/chat endpoint
2. WHEN the chat endpoint receives a request THEN the system SHALL accept JSON payload with the user's question
3. WHEN processing the request THEN the system SHALL return the AI-generated text response
4. WHEN implementing image generation THEN the system SHALL provide a POST /api/v1/images/generate endpoint
5. WHEN the image endpoint receives parameters THEN the system SHALL return the public URL of the generated image
6. WHEN either endpoint encounters errors THEN the system SHALL return appropriate HTTP status codes and error messages

### Requirement 9: Database Schema Design

**User Story:** As a system architect, I want a database schema that supports current MVP needs while being extensible for future features like user authentication and conversation history.

#### Acceptance Criteria

1. WHEN creating the GeneratedImages table THEN the system SHALL include image_id (PK), r2_object_key, prompt_parameters (JSON), and created_at fields
2. WHEN designing for future expansion THEN the system SHALL plan for a Conversations table with nullable user_id field
3. WHEN storing image metadata THEN the system SHALL ensure referential integrity between conversations and images
4. WHEN implementing the schema THEN the system SHALL use appropriate data types and constraints for Cloudflare D1

### Requirement 10: Future-Ready Architecture

**User Story:** As a product owner, I want the MVP architecture to support future features like user authentication and admin knowledge base management so that we can evolve the platform without major rewrites.

#### Acceptance Criteria

1. WHEN designing the ingestion pipeline THEN the system SHALL create it as a reusable module for future admin functionality
2. WHEN implementing core application logic THEN the system SHALL structure it to easily accommodate authentication layers
3. WHEN designing database schemas THEN the system SHALL include nullable user_id fields for future user linking
4. WHEN building API endpoints THEN the system SHALL design them to support future authentication middleware
5. WHEN creating the knowledge base system THEN the system SHALL plan for future secure API endpoints for document uploads