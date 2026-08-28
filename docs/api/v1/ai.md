# AI Tools API

## Overview

Base URL: `/api/v1/ai`

All endpoints require authentication.

## Endpoints

### Generate Documentation

Uses AI to generate documentation from an API specification.

**POST `/generate-docs`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
  "format": "markdown",
  "includeExamples": true,
  "language": "en"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "documentation": "# Weather API Documentation\n\n## Overview\nThe Weather API provides real-time weather data for any location worldwide.\n\n## Authentication\nAPI keys are required for all requests.\n\n## Endpoints\n\n### GET /forecast\nReturns weather forecast for a location.",
    "stats": {
      "endpoints": 5,
      "parameters": 12,
      "examples": 5
    }
  },
  "message": "Documentation generated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated
- 404: NOT_FOUND - API not found

---

### Security Audit

Runs an AI-powered security audit on an API specification.

**POST `/security-audit`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
  "depth": "comprehensive"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overallScore": 78,
    "summary": "The API has good security practices but has some areas for improvement.",
    "issues": [
      {
        "severity": "high",
        "category": "authentication",
        "title": "Missing rate limiting",
        "description": "No rate limiting is configured on API endpoints.",
        "recommendation": "Implement rate limiting middleware",
        "location": "endpoints"
      },
      {
        "severity": "medium",
        "category": "data-protection",
        "title": "Sensitive data exposure",
        "description": "API responses include internal user IDs.",
        "recommendation": "Use UUIDs instead of sequential IDs",
        "location": "response-schema"
      }
    ],
    "recommendations": [
      "Add rate limiting to all endpoints",
      "Implement input validation",
      "Use HTTPS in production"
    ]
  },
  "message": "Security audit completed successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated

---

### Chat with AI Assistant

Chat with the AI assistant for guidance and support.

**POST `/chat`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "message": "How do I implement API key authentication?",
  "context": {
    "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
    "language": "javascript"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reply": "To implement API key authentication in JavaScript, you can use the following approach:\n\n```javascript\nconst express = require('express');\nconst app = express();\n\n// Middleware to check API key\napp.use((req, res, next) => {\n  const apiKey = req.headers['x-api-key'];\n  if (!apiKey || apiKey !== process.env.API_KEY) {\n    return res.status(401).json({ error: 'Invalid API key' });\n  }\n  next();\n});\n```",
    "conversationId": "5f8c9d3e4b4b4b4b4b4b4b4f"
  },
  "message": "Response generated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated

---

### Generate API Ideas

Generates new API ideas based on market trends and user preferences.

**POST `/generate-ideas`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "category": "finance",
  "techStack": ["nodejs", "python"],
  "count": 5
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "ideas": [
      {
        "title": "Invoice Automation API",
        "description": "API for automatic invoice generation and management",
        "category": "finance",
        "marketDemand": "high",
        "competition": "medium",
        "estimatedRevenue": "$10k/month",
        "difficulty": "medium",
        "why": "Many businesses struggle with manual invoice processing"
      },
      {
        "title": "Financial Analytics API",
        "description": "Real-time financial data analytics and reporting",
        "category": "finance",
        "marketDemand": "medium",
        "competition": "low",
        "estimatedRevenue": "$8k/month",
        "difficulty": "high",
        "why": "Growing demand for financial insights"
      }
    ]
  },
  "message": "API ideas generated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated

## Error Codes

| Code | Description |
|------|-------------|
| API_NOT_FOUND | API not found |
| AI_QUOTA_EXCEEDED | User's AI quota exceeded |
| INVALID_MESSAGE | Empty or invalid message |

## Rate Limits

- Documentation generation: 10 requests per hour per user
- Security audit: 5 requests per hour per user
- Chat: 30 messages per hour per user
- Idea generation: 10 requests per hour per user