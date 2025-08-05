# Ask the Captain - API Documentation

This document describes the core API endpoints for the Ask the Captain platform.

## Base URL

```
https://your-domain.com/api
```

## Authentication

Currently, the MVP does not require authentication. All endpoints are publicly accessible.

## Endpoints

### POST /api/chat

Main conversation endpoint that handles the complete chat flow: embedding generation, semantic search, response generation, and contextual image creation.

#### Request

```json
{
  "message": "Como posso melhorar minha disciplina?",
  "conversationId": "conv_optional_id" // Optional
}
```

#### Response

```json
{
  "response": "Guerreiro, a disciplina não é um dom, é uma escolha diária...",
  "imageUrl": "https://r2-bucket.com/images/generated/2024/01/image-id.png",
  "conversationId": "conv_1234567890_abcdef"
}
```

#### Headers

- `X-Processing-Time`: Total processing time in milliseconds
- `X-Search-Results`: Number of search results found
- `X-Fallback-Used`: Whether fallback search was used (true/false)

#### Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message is required and must be a string",
    "details": {},
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "fallback": {
    "response": "Fallback response from Capitão Caverna",
    "imageUrl": ""
  }
}
```

#### Validation Rules

- `message`: Required, string, 1-2000 characters
- `conversationId`: Optional, string

### POST /api/v1/images/generate

Dedicated image generation endpoint for creating contextual Capitão Caverna images.

#### Request

```json
{
  "responseContent": "Guerreiro, é hora de agir com disciplina e foco.",
  "tone": "instructional", // Optional: supportive, challenging, instructional, motivational
  "themes": ["discipline", "action"], // Optional: array of theme strings
  "promptParameters": {}, // Optional: custom parameters
  "customPrompt": "Custom DALL-E prompt" // Optional: override default prompt
}
```

#### Response

```json
{
  "imageUrl": "https://r2-bucket.com/images/generated/2024/01/image-id.png",
  "imageId": "img_1234567890_abcdef",
  "promptParameters": {
    "prompt": "Generated DALL-E prompt",
    "toneAnalysis": {
      "primary": "instructional",
      "intensity": "medium",
      "themes": ["discipline", "action"],
      "visualParameters": {
        "pose": "confident stance",
        "expression": "focused determination",
        "environment": "cave interior",
        "lighting": "dramatic shadows"
      }
    },
    "responseContext": "Guerreiro, é hora de agir...",
    "generationTimestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Headers

- `X-Processing-Time`: Total processing time in milliseconds
- `X-Image-ID`: Generated image ID
- `X-Tone-Primary`: Primary tone detected
- `X-Tone-Intensity`: Tone intensity level

### GET /api/v1/images/generate

Retrieve metadata for a previously generated image.

#### Request

```
GET /api/v1/images/generate?imageId=img_1234567890_abcdef
```

#### Response

```json
{
  "imageId": "img_1234567890_abcdef",
  "imageUrl": "https://r2-bucket.com/images/generated/2024/01/image-id.png",
  "promptParameters": {
    "prompt": "Generated DALL-E prompt",
    "toneAnalysis": {...}
  },
  "responseContext": "Guerreiro, é hora de agir...",
  "toneAnalysis": {
    "primary": "instructional",
    "intensity": "medium",
    "themes": ["discipline", "action"]
  },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `MISSING_API_KEY` | OpenAI API key not configured |
| `INVALID_JSON` | Invalid JSON in request body |
| `IMAGE_GENERATION_FAILED` | DALL-E image generation failed |
| `IMAGE_DOWNLOAD_FAILED` | Failed to download generated image |
| `STORAGE_FAILED` | Failed to store image in R2/D1 |
| `METADATA_RETRIEVAL_FAILED` | Failed to retrieve image metadata |
| `IMAGE_NOT_FOUND` | Requested image not found |
| `MISSING_PARAMETER` | Required parameter missing |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limits

Currently, no rate limits are enforced at the API level. Rate limiting is handled by:

- OpenAI API limits (requests per minute, tokens per minute)
- Cloudflare Workers CPU time limits
- Cloudflare R2 request limits

## Image Generation Details

### Character Specifications

All generated images feature Capitão Caverna with consistent characteristics:

- **Style**: Pixar-style 3D rendering
- **Character**: Anthropomorphic wolf, athletic build, 6-head proportions
- **Attire**: Black hoodie with red triangle logo, black sweatpants, asymmetric sneakers
- **Environment**: Natural cave interior with dramatic lighting

### Tone-Based Variations

| Tone | Pose & Expression | Lighting | Atmosphere |
|------|------------------|----------|------------|
| `supportive` | Encouraging, open posture | Warm, golden lighting | Welcoming sanctuary |
| `challenging` | Intense gaze, firm stance | High-contrast, dramatic | Intense and focused |
| `instructional` | Teaching pose, authoritative | Clear, balanced lighting | Place of learning |
| `motivational` | Heroic pose, inspiring | Dynamic, uplifting rays | Transformational power |

### Quality Standards

- **Resolution**: 1024x1024 pixels
- **Quality**: HD (high definition)
- **Style**: Vivid (enhanced colors and contrast)
- **Format**: PNG with transparency support
- **Storage**: Cloudflare R2 with public URLs

## Development

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key
CLOUDFLARE_ACCOUNT_ID=your_account_id
D1_DATABASE_ID=your_d1_database_id
VECTORIZE_INDEX_ID=your_vectorize_index_id
R2_BUCKET_NAME=your_r2_bucket_name
```

### Testing

```bash
# Run API endpoint tests
npm test -- lib/__tests__/api-endpoints.test.ts

# Run integration tests
npm test -- lib/__tests__/api-integration.test.ts
```

### Local Development

```bash
# Start development server
npm run dev

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Como posso melhorar minha disciplina?"}'

# Test image generation endpoint
curl -X POST http://localhost:3000/api/v1/images/generate \
  -H "Content-Type: application/json" \
  -d '{"responseContent": "Guerreiro, é hora de agir!", "tone": "motivational"}'
```

## Architecture

The API endpoints follow a clean architecture pattern:

1. **Request Validation**: Input sanitization and validation
2. **Service Orchestration**: Coordinate multiple services (search, generation, storage)
3. **Error Handling**: Comprehensive error handling with fallbacks
4. **Response Formatting**: Consistent response structure
5. **Performance Monitoring**: Request timing and metrics

### Service Dependencies

- **SemanticSearchService**: Knowledge base search
- **ResponseGenerator**: AI response generation with persona
- **ImageStorageService**: Image storage coordination
- **OpenAIClient**: OpenAI API integration
- **VectorizeClient**: Cloudflare Vectorize operations
- **R2Client**: Cloudflare R2 storage
- **D1Client**: Cloudflare D1 database

## Security Considerations

- Input sanitization to prevent injection attacks
- Request size limits to prevent abuse
- Error message sanitization to prevent information leakage
- No sensitive data in error responses
- Secure environment variable handling

## Performance Optimization

- Parallel processing where possible (search + image generation)
- Efficient error handling with early returns
- Optimized context window management
- Image storage with CDN distribution
- Request timing and monitoring