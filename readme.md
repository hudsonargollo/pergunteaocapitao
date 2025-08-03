
Kiro AI Spec Prompt: "Ask the Captain" v2.1 Rebuild
Primary Objective:
Execute a ground-up rebuild of the "Ask the Captain" chat application. The new platform will serve as an immersive self-help tool where users engage with an AI assistant embodying the "Capitão Caverna" persona. The absolute focus for this MVP is twofold: (1) State-of-the-art semantic search accuracy over a defined knowledge base, and (2) Dynamic, context-aware image generation of the Captain character with every interaction. The architecture must be 100% Cloudflare-native and architected for future scalability.

Part 1: Project Steering Files (.kiro/steering/)
File: product.md


Product Vision: The "Ask the Captain" platform is a strategic refuge and mental battleground for individuals committed to escaping mediocrity. It embodies the core philosophy of the Cave Mode: 

Purpose > Focus > Progress. The assistant, Capitão Caverna, is not a simple chatbot; he is a direct, uncompromising mentor who guides users through action and discipline. The tool's primary function is to help users combat internal enemies such as procrastination, anxiety, fear of failure, and constant comparison .

Target Audience: This platform is for the warriors who refuse to settle. It is for those who understand that change requires action and are ready to abandon the comfort zones that hold them back. It is explicitly 

not for those seeking easy answers, quick fixes, or motivational platitudes .

Core Persona: Capitão Caverna:

Tone of Voice: Direct, firm, disciplined, and action-oriented. He treats the user as a "warrior who has finally awakened". There is no room for victimhood or excuses.


Guiding Principle: Every interaction must guide the user toward taking responsibility and definitive steps for self-mastery. The Captain is a guardian of the user's focus and discipline.

File: tech.md

Architecture Philosophy: Edge-First. The entire stack must be built using the Cloudflare developer platform to minimize latency and unify the operational toolchain .

Deployment Target: Cloudflare Workers.


Web Framework: Next.js (utilizing the create-cloudflare CLI with the OpenNext adapter).

Relational Database: Cloudflare D1. This will be used for storing metadata for generated images. The schema must be designed to later accommodate conversation histories linked to user IDs.

Vector Database: Cloudflare Vectorize. This is critical for high-performance semantic search. It will store the embeddings of the knowledge base documents.

Object Storage: Cloudflare R2. This will be used to store all generated PNG images of Capitão Caverna, leveraging zero egress fees.

Large Language Model (LLM): OpenAI (via API). Use the existing Google credentials and OpenAI API key from the original repository for making calls.

Authentication (MVP): None. The initial release will be public and will not require user login.

Part 2: Detailed Feature Specifications
Feature 1: User Interface & Experience (UI/UX)
Objective: Create a clean, high-contrast, and immersive interface that promotes absolute focus on the conversation.

Requirements:

Visual Style: Implement a UI based on the github.com/hudsonargollo/glass-ask-ai repository but with a significantly improved contrast ratio. The aesthetic should be robust, sharp, and aligned with the strong, disciplined brand of Modo Caverna. Avoid ambiguity in visual elements.

Layout: A minimalist, single-column chat interface that is fully responsive across desktop and mobile devices.

The Captain's Presence:

A visually rendered image of Capitão Caverna must be present on the screen at all times.

With every new response from the AI, this image must be dynamically updated to reflect the context of the conversation.

Upon session start, the Captain should appear with a greeting and a clear call to action, prompting the user to ask a question (e.g., "The cave is open. Ask what you need to move forward.") .

Feature 2: Semantic Conversation Core
Objective: Build a high-performance, highly accurate semantic search and response generation engine. This is the highest priority of the MVP.

Requirements:

Knowledge Base Ingestion Pipeline:

Create an automated script (to be run during the build process or manually at first) that processes all provided knowledge base documents (.txt, .md files).

This script must chunk the documents into meaningful segments, generate embeddings for each segment using an OpenAI model, and store these embeddings in a Cloudflare Vectorize index.

Initial Knowledge Base:

modocaverna-docs.md

Base Template Prompts:

base-image-prompts.md

API Endpoint (POST /api/chat):

Create a Next.js API route that runs on a Cloudflare Worker.

Step A: Receive Query: The endpoint accepts a JSON payload with the user's question.

Step B: Vectorize Query: Generate an embedding for the user's question.

Step C: Semantic Search: Query the Cloudflare Vectorize index with the user's query vector to retrieve the top N most relevant chunks of text from the knowledge base.

Step D: Construct Prompt: Create a detailed system prompt for the OpenAI API. This prompt must include:

Persona Definition: Clear instructions to act exactly as Capitão Caverna (direct, mentor, no excuses).

Contextual Grounding: The relevant text chunks retrieved from Vectorize.

Strict Instruction: An explicit command to formulate the answer based ONLY on the provided context. The AI must be instructed not to use its general knowledge.

Step E: Generate Response: Send the complete prompt and the user's question to the OpenAI chat completions API.

Step F: Return Response: The endpoint returns the generated text answer to the frontend.

Feature 3: Contextual Image Generation Engine
Objective: Enhance user immersion by generating a unique image of Capitão Caverna that visually represents the AI's response.

Requirements:

Post-Response Analysis: After the text response is generated by the LLM (Feature 2), a new function must analyze its content, tone, and key themes (e.g., discipline, planning, overcoming fear, system features).


Programmatic Prompt Selection: Based on the analysis, this logic will programmatically select the most fitting parameters (e.g., pose, outfit, footwear, prop) from the structured options detailed in the CAPITAO CAVERNA ULTIMATE PROMPTS and ONBOARDING documents .

Image Generation API Endpoint (POST /api/v1/images/generate):

This endpoint receives the selected parameters.

Step A: Construct Image Prompt: It assembles the final, detailed text prompt for the image generation service (e.g., DALL-E 3) by combining the base character description with the selected parameters.

Step B: Call Image Service: It makes an API call to the image generation service.

Step C: Process Image in Worker: The service will return an image URL. The Cloudflare Worker must then fetch this image and handle it as a data blob/buffer.

Step D: Store in R2: The Worker uploads the image blob directly to a Cloudflare R2 bucket using a unique identifier (e.g., UUID) as the object key.

Step E: Store Metadata in D1: The Worker inserts a new record into a GeneratedImages table in Cloudflare D1. The table schema must include image_id (PK), r2_object_key, prompt_parameters (JSON), and created_at.

Step F: Return Public URL: The endpoint responds with the public URL of the newly stored image in R2.

Frontend Display: The UI receives this URL and updates the Captain's image display.

Part 3: Architecture for Future Evolution (Post-MVP)
Objective: Ensure the MVP's architecture is not a dead-end. Kiro must design the system with the following future features in mind.

Requirements:

Admin Knowledge Base Management:

The data ingestion pipeline should be designed as a reusable module. Plan for a future secure API endpoint that can be called by an admin panel to trigger the ingestion of a new uploaded document.

User Authentication & Conversation History:

While not implementing authentication now, the database schema in D1 should be designed with a nullable user_id field in the future Conversations table.

The core application logic should be structured to easily accommodate an authentication layer later, which will link conversations to users in our external MySQL database. The goal is to make this a straightforward integration rather than a full rewrite.
