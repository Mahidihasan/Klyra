# Users API

## Overview

Base URL: `/api/v1/users`

All endpoints require authentication unless otherwise specified.

## Endpoints

### Get User Profile

Retrieves the authenticated user's profile.

**GET `/profile`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4b",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "avatar": "https://example.com/avatar.png",
    "bio": "Full-stack developer",
    "company": "Tech Corp",
    "website": "https://johndoe.com",
    "isEmailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Profile retrieved successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Not authenticated

---

### Update User Profile

Updates the authenticated user's profile.

**PUT `/profile`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "John Smith",
  "avatar": "https://example.com/new-avatar.png",
  "bio": "Senior developer",
  "company": "New Tech Corp",
  "website": "https://johnsmith.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4b",
    "email": "user@example.com",
    "name": "John Smith",
    "role": "USER",
    "avatar": "https://example.com/new-avatar.png",
    "bio": "Senior developer",
    "company": "New Tech Corp",
    "website": "https://johnsmith.com",
    "isEmailVerified": true,
    "updatedAt": "2024-01-01T10:00:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated

---

### Change Password

Changes the authenticated user's password.

**PUT `/password`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "currentPassword": "currentpassword123",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Wrong current password

---

### Get User's APIs

Retrieves all APIs owned by the authenticated user.

**GET `/apis`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by API status (draft, published, archived)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "apis": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4c",
        "name": "Weather API",
        "description": "Real-time weather data",
        "version": "1.0.0",
        "status": "published",
        "category": {
          "id": "5f8c9d3e4b4b4b4b4b4b4b4d",
          "name": "Weather"
        },
        "pricing": {
          "free": { "requestsPerMonth": 1000, "rateLimit": 10 },
          "pro": { "price": 29.99, "requestsPerMonth": 100000, "rateLimit": 100 }
        },
        "rating": 4.5,
        "totalSubscribers": 1250,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  },
  "message": "User APIs retrieved successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Not authenticated

---

### Delete Account

Permanently deletes the authenticated user's account.

**DELETE `/account`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "password": "userpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid password
- 401: UNAUTHORIZED - Not authenticated

## Error Codes

| Code | Description |
|------|-------------|
| USER_NOT_FOUND | User not found |
| INVALID_PASSWORD | Wrong password |
| EMAIL_EXISTS | Email already registered |

## Rate Limits

- Profile updates: 10 requests per minute per user
- Password changes: 5 requests per hour per user
- API listing: 30 requests per minute per user