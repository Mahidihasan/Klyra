# Playground API

## Overview

Base URL: `/api/v1/playground`

All endpoints require authentication.

## Endpoints

### Execute API Request

Executes a request to a third-party API through the playground proxy.

**POST `/execute`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
  "method": "GET",
  "url": "/forecast",
  "headers": {
    "Content-Type": "application/json"
  },
  "params": {
    "lat": "40.7128",
    "lon": "-74.0060"
  },
  "body": null
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": 200,
    "statusText": "OK",
    "headers": { "content-type": "application/json" },
    "data": {
      "temperature": 72,
      "conditions": "Sunny",
      "humidity": 45
    },
    "duration": 245
  },
  "message": "Request executed successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid request
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - No subscription to API
- 404: NOT_FOUND - API not found

---

### Save Request to Collection

Saves a request to the user's collection.

**POST `/collections`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "Weather Forecast",
  "description": "Get current weather",
  "requests": [
    {
      "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
      "method": "GET",
      "url": "/forecast",
      "headers": {},
      "params": { "lat": "40.7128", "lon": "-74.0060" }
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4e",
    "name": "Weather Forecast",
    "description": "Get current weather",
    "requests": [
      {
        "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
        "method": "GET",
        "url": "/forecast",
        "headers": {},
        "params": { "lat": "40.7128", "lon": "-74.0060" }
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Request saved to collection successfully"
}
```

---

### Get User Collections

Retrieves all collections for the authenticated user.

**GET `/collections`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `isFavorite`: Filter favorites (true/false)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4e",
        "name": "Weather Forecast",
        "description": "Get current weather",
        "requestsCount": 3,
        "isPublic": false,
        "isFavorite": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  },
  "message": "Collections retrieved successfully"
}
```

---

### Get Request History

Retrieves the user's request execution history.

**GET `/history`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `apiId`: Filter by API ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
        "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
        "apiName": "Weather API",
        "method": "GET",
        "url": "/forecast",
        "status": 200,
        "duration": 245,
        "executedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  },
  "message": "Request history retrieved successfully"
}
```

---

### Generate Client Code

Generates client code for a request in various languages.

**POST `/codegen`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "language": "javascript",
  "apiId": "5f8c9d3e4b4b4b4b4b4b4b4c",
  "method": "GET",
  "url": "/forecast",
  "headers": { "X-API-Key": "${API_KEY}" },
  "params": { "lat": "40.7128", "lon": "-74.0060" }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "language": "javascript",
    "code": "// Generated code sample\nconst response = await fetch('https://api.weather.com/v1/forecast?lat=40.7128&lon=-74.0060', {\n  method: 'GET',\n  headers: {\n    'X-API-Key': process.env.API_KEY\n  }\n});\n\nconst data = await response.json();\nconsole.log(data);"
  },
  "message": "Client code generated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Unsupported language

## Supported Languages

| Language | Value |
|----------|-------|
| JavaScript | `javascript` |
| Python | `python` |
| PHP | `php` |
| Java | `java` |
| Go | `go` |
| Curl | `curl` |

## Error Codes

| Code | Description |
|------|-------------|
| API_NOT_FOUND | API not found |
| NO_SUBSCRIPTION | User has no subscription |
| UNSUPPORTED_LANGUAGE | Language not supported |
| COLLECTION_EXISTS | Collection name exists |

## Rate Limits

- Execute requests: 30 requests per minute per user
- Collections: 10 requests per minute per user
- History: 30 requests per minute per user
- Code generation: 10 requests per minute per user