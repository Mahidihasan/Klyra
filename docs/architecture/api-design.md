# API Design

## Overview

This document describes the API design principles and conventions used throughout the API Marketplace platform.

## Base URL

```
https://api.your-domain.com/api/v1
```

## Authentication

Most endpoints require authentication. Two methods are supported:

### 1. JWT Authentication
For web application users, use Bearer tokens:

```
Authorization: Bearer <jwt_token>
```

### 2. API Key Authentication
For third-party API consumers, use API keys:

```
X-API-Key: <api_key>
```

## Response Format

All responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## API Endpoints

### Authentication (`/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh-token` | Refresh access token | Yes |
| POST | `/auth/forgot-password` | Send password reset email | No |
| POST | `/auth/reset-password` | Reset password | No |
| POST | `/auth/logout` | Logout user | Yes |

### Users (`/users`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/profile` | Get user profile | Yes |
| PUT | `/users/profile` | Update user profile | Yes |
| PUT | `/users/password` | Change password | Yes |
| GET | `/users/apis` | Get user's APIs | Yes |
| DELETE | `/users/account` | Delete account | Yes |

### APIs (`/apis`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/apis` | List all APIs | No |
| GET | `/apis/:id` | Get API details | No |
| POST | `/apis` | Create new API | Yes |
| PUT | `/apis/:id` | Update API | Yes (Owner) |
| DELETE | `/apis/:id` | Delete API | Yes (Owner) |
| POST | `/apis/:id/publish` | Publish API | Yes (Owner) |
| POST | `/apis/:id/unpublish` | Unpublish API | Yes (Owner) |
| GET | `/apis/:id/versions` | Get API versions | No |
| POST | `/apis/:id/versions` | Create API version | Yes (Owner) |

### Categories (`/categories`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/categories` | List all categories | No |
| GET | `/categories/:id` | Get category details | No |
| POST | `/categories` | Create category | Admin |
| PUT | `/categories/:id` | Update category | Admin |
| DELETE | `/categories/:id` | Delete category | Admin |

### Playground (`/playground`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/playground/execute` | Execute API request | Yes |
| POST | `/playground/collections` | Save to collections | Yes |
| GET | `/playground/collections` | Get user collections | Yes |
| GET | `/playground/history` | Get request history | Yes |
| POST | `/playground/codegen` | Generate client code | Yes |

### AI Tools (`/ai`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/ai/generate-docs` | Generate API documentation | Yes |
| POST | `/ai/security-audit` | Audit API security | Yes |
| POST | `/ai/chat` | Chat with AI assistant | Yes |
| POST | `/ai/generate-ideas` | Generate API ideas | Yes |

### Subscriptions (`/subscriptions`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/subscriptions/plans` | List subscription plans | No |
| GET | `/subscriptions/mine` | Get user's subscriptions | Yes |
| POST | `/subscriptions` | Subscribe to API | Yes |
| PUT | `/subscriptions/:id` | Update subscription | Yes |
| DELETE | `/subscriptions/:id` | Cancel subscription | Yes |

### Payments (`/payments`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/checkout` | Create checkout session | Yes |
| POST | `/payments/webhook` | Stripe webhook handler | Yes |
| GET | `/payments/invoices` | Get user invoices | Yes |
| GET | `/payments/methods` | Get payment methods | Yes |

### Analytics (`/analytics`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/analytics/overview` | Get analytics overview | Yes |
| GET | `/analytics/usage` | Get API usage stats | Yes |
| GET | `/analytics/revenue` | Get revenue statistics | Yes (Provider) |
| GET | `/analytics/performance` | Get performance metrics | Yes (Provider) |

### Reviews (`/reviews`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/reviews` | Get API reviews | No |
| POST | `/reviews` | Create review | Yes |
| PUT | `/reviews/:id` | Update review | Yes (Owner) |
| DELETE | `/reviews/:id` | Delete review | Yes (Owner) |

### Notifications (`/notifications`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | Get user notifications | Yes |
| GET | `/notifications/unread` | Get unread count | Yes |
| PUT | `/notifications/:id/read` | Mark as read | Yes |
| PUT | `/notifications/read-all` | Mark all as read | Yes |

## Pagination

List endpoints support pagination:

```
GET /apis?page=2&limit=20&sort=createdAt&order=desc
```

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field
- `order`: Sort order (asc/desc)

## Filtering

List endpoints support filtering:

```
GET /apis?category=5f8c9d3e4b4b4b4b4b4b4b4b&price=free&rating=4.5
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Rate limit exceeded |
| SERVER_ERROR | 500 | Internal server error |

## Rate Limiting

- **General:** 100 requests per minute per IP
- **Authenticated:** 200 requests per minute per user
- **API Keys:** Based on subscription tier