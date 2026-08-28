# APIs API

## Overview

Base URL: `/api/v1/apis`

## Endpoints

### List All APIs

Retrieves a paginated list of published APIs.

**GET `/`**

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field (createdAt, name, rating, price)
- `order`: Sort order (asc, desc)
- `category`: Filter by category ID
- `search`: Search by name or description
- `price`: Filter by price type (free, paid)
- `rating`: Minimum rating (1-5)
- `tags`: Filter by tags (comma-separated)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "apis": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4c",
        "name": "Weather API",
        "slug": "weather-api",
        "description": "Real-time weather data for any location",
        "version": "1.0.0",
        "logo": "https://example.com/logo.png",
        "category": {
          "id": "5f8c9d3e4b4b4b4b4b4b4b4d",
          "name": "Weather",
          "slug": "weather"
        },
        "owner": {
          "id": "5f8c9d3e4b4b4b4b4b4b4b4e",
          "name": "Weather Corp",
          "avatar": "https://example.com/avatar.png"
        },
        "pricing": {
          "free": { "requestsPerMonth": 1000, "rateLimit": 10 },
          "pro": { "price": 29.99, "requestsPerMonth": 100000, "rateLimit": 100 }
        },
        "rating": 4.5,
        "totalReviews": 128,
        "totalSubscribers": 1250,
        "tags": ["weather", "forecast", "climate"],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  },
  "message": "APIs retrieved successfully"
}
```

---

### Get API Details

Retrieves detailed information about a specific API.

**GET `/:id`**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4c",
    "name": "Weather API",
    "slug": "weather-api",
    "description": "Real-time weather data for any location",
    "version": "1.0.0",
    "baseUrl": "https://api.weather.com/v1",
    "docsUrl": "https://docs.weather.com",
    "logo": "https://example.com/logo.png",
    "category": { "id": "...", "name": "Weather", "slug": "weather" },
    "owner": { "id": "...", "name": "Weather Corp", "avatar": "..." },
    "pricing": {
      "free": { "requestsPerMonth": 1000, "rateLimit": 10 },
      "pro": { "price": 29.99, "requestsPerMonth": 100000, "rateLimit": 100 },
      "enterprise": { "price": 99.99, "requestsPerMonth": 1000000, "rateLimit": 1000 }
    },
    "apiSpec": { "openapi": "3.0.0", "info": { "title": "Weather API", "version": "1.0.0" } },
    "rating": 4.5,
    "totalReviews": 128,
    "totalSubscribers": 1250,
    "totalRequests": 5000000,
    "tags": ["weather", "forecast", "climate"],
    "status": "published",
    "isPublic": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-06-01T00:00:00.000Z"
  },
  "message": "API details retrieved successfully"
}
```

**Error Responses:**
- 404: NOT_FOUND - API not found

---

### Create API

Creates a new API listing.

**POST `/`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "My New API",
  "description": "Description of my API",
  "categoryId": "5f8c9d3e4b4b4b4b4b4b4b4d",
  "baseUrl": "https://api.myapi.com/v1",
  "docsUrl": "https://docs.myapi.com",
  "logo": "https://example.com/logo.png",
  "pricing": {
    "free": { "requestsPerMonth": 100, "rateLimit": 5 },
    "pro": { "price": 19.99, "requestsPerMonth": 10000, "rateLimit": 50 }
  },
  "apiSpec": { "openapi": "3.0.0", "info": { "title": "My API", "version": "1.0.0" } },
  "tags": ["tag1", "tag2"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
    "name": "My New API",
    "slug": "my-new-api",
    "status": "draft",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "API created successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated

---

### Update API

Updates an existing API listing.

**PUT `/:id`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "Updated API Name",
  "description": "Updated description",
  "pricing": { "pro": { "price": 39.99 } }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4c",
    "name": "Updated API Name",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  },
  "message": "API updated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - Not the owner
- 404: NOT_FOUND - API not found

---

### Delete API

Deletes an API listing.

**DELETE `/:id`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "API deleted successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - Not the owner
- 404: NOT_FOUND - API not found

---

### Publish API

Publishes an API to make it visible in the marketplace.

**POST `/:id/publish`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "API published successfully"
}
```

---

### Unpublish API

Unpublishes an API from the marketplace.

**POST `/:id/unpublish`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "API unpublished successfully"
}
```

---

### Get API Versions

Retrieves all versions of an API.

**GET `/:id/versions`**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "id": "...",
        "version": "1.0.0",
        "changelog": "Initial release",
        "isDeprecated": false,
        "releasedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "...",
        "version": "1.1.0",
        "changelog": "Added new endpoints",
        "isDeprecated": false,
        "releasedAt": "2024-06-01T00:00:00.000Z"
      }
    ]
  },
  "message": "API versions retrieved successfully"
}
```

---

### Create API Version

Creates a new version for an API.

**POST `/:id/versions`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "version": "2.0.0",
  "apiSpec": { "openapi": "3.0.0" },
  "changelog": "Major version update with breaking changes"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "version": "2.0.0",
    "releasedAt": "2024-07-01T00:00:00.000Z"
  },
  "message": "API version created successfully"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| API_NOT_FOUND | API not found |
| API_SLUG_EXISTS | API slug already exists |
| VERSION_EXISTS | Version already exists |
| NOT_OWNER | User is not the API owner |

## Rate Limits

- List APIs: 60 requests per minute per IP
- API details: 60 requests per minute per IP
- Create/Update: 20 requests per minute per user