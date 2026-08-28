# Categories API

## Overview

Base URL: `/api/v1/categories`

## Endpoints

### List All Categories

Retrieves a list of all categories.

**GET `/`**

**Query Parameters:**
- `parentId`: Filter by parent category
- `includeApis`: Include API count (true/false)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4d",
        "name": "Weather",
        "slug": "weather",
        "description": "Weather data and forecasts",
        "icon": "https://example.com/icons/weather.png",
        "parentId": null,
        "apiCount": 25,
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4e",
        "name": "Finance",
        "slug": "finance",
        "description": "Financial data and market information",
        "icon": "https://example.com/icons/finance.png",
        "parentId": null,
        "apiCount": 40,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  },
  "message": "Categories retrieved successfully"
}
```

---

### Get Category Details

Retrieves details for a specific category including its subcategories and APIs.

**GET `/:id`**

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4d",
    "name": "Weather",
    "slug": "weather",
    "description": "Weather data and forecasts",
    "icon": "https://example.com/icons/weather.png",
    "parentId": null,
    "subcategories": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
        "name": "Forecasts",
        "slug": "forecasts",
        "apiCount": 10
      }
    ],
    "apis": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4c",
        "name": "Weather API",
        "description": "Real-time weather data",
        "rating": 4.5,
        "totalSubscribers": 1250
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    }
  },
  "message": "Category details retrieved successfully"
}
```

**Error Responses:**
- 404: NOT_FOUND - Category not found

---

### Create Category

Creates a new category. Admin only.

**POST `/`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "Machine Learning",
  "description": "AI and machine learning APIs",
  "icon": "https://example.com/icons/ml.png",
  "parentId": null
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
    "name": "Machine Learning",
    "slug": "machine-learning",
    "description": "AI and machine learning APIs",
    "icon": "https://example.com/icons/ml.png",
    "parentId": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Category created successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - Not an admin
- 409: CONFLICT - Category name already exists

---

### Update Category

Updates an existing category. Admin only.

**PUT `/:id`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "AI & Machine Learning",
  "description": "AI, ML, and data science APIs"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
    "name": "AI & Machine Learning",
    "slug": "ai-machine-learning",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  },
  "message": "Category updated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - Not an admin
- 404: NOT_FOUND - Category not found

---

### Delete Category

Deletes a category. Admin only.

**DELETE `/:id`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - Not an admin
- 404: NOT_FOUND - Category not found
- 409: CONFLICT - Category has APIs

## Error Codes

| Code | Description |
|------|-------------|
| CATEGORY_NOT_FOUND | Category not found |
| CATEGORY_EXISTS | Category name already exists |
| CATEGORY_HAS_APIS | Cannot delete category with APIs |

## Rate Limits

- List categories: 60 requests per minute per IP
- Category details: 60 requests per minute per IP
- Create/Update/Delete: 10 requests per minute per admin