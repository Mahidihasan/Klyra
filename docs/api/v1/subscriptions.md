# Subscriptions API

## Overview

Base URL: `/api/v1/subscriptions`

## Endpoints

### List Subscription Plans

Retrieves a list of available subscription plans for an API.

**GET `/plans`**

**Query Parameters:**
- `apiId`: Filter plans by API ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4c",
        "apiId": "5f8c9d3e4b4b4b4b4b4b4b4d",
        "name": "Free",
        "description": "Access to basic endpoints",
        "price": 0,
        "billingPeriod": "monthly",
        "features": {
          "requestsPerMonth": 1000,
          "rateLimit": 10,
          "webhooks": false,
          "support": "community"
        }
      },
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4e",
        "apiId": "5f8c9d3e4b4b4b4b4b4b4b4d",
        "name": "Pro",
        "description": "Advanced features for growing businesses",
        "price": 29.99,
        "billingPeriod": "monthly",
        "features": {
          "requestsPerMonth": 100000,
          "rateLimit": 100,
          "webhooks": true,
          "support": "priority"
        }
      }
    ]
  },
  "message": "Subscription plans retrieved successfully"
}
```

---

### Get User's Subscriptions

Retrieves all subscriptions for the authenticated user.

**GET `/mine`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Filter by status (active, paused, cancelled, expired)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
        "api": {
          "id": "5f8c9d3e4b4b4b4b4b4b4b4d",
          "name": "Weather API",
          "logo": "https://example.com/logo.png"
        },
        "plan": {
          "id": "5f8c9d3e4b4b4b4b4b4b4b4e",
          "name": "Pro",
          "price": 29.99
        },
        "status": "active",
        "periodStart": "2024-01-01T00:00:00.000Z",
        "periodEnd": "2024-01-31T00:00:00.000Z",
        "autoRenew": true,
        "usage": {
          "requestsThisMonth": 45000,
          "quota": 100000
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  },
  "message": "Subscriptions retrieved successfully"
}
```

---

### Subscribe to API

Creates a new subscription for the user.

**POST `/`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "apiId": "5f8c9d3e4b4b4b4b4b4b4b4d",
  "planId": "5f8c9d3e4b4b4b4b4b4b4b4e",
  "paymentMethodId": "pm_1MqM5W2eZvKYlo2CvsXqLsHt"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
    "apiId": "5f8c9d3e4b4b4b4b4b4b4b4d",
    "planId": "5f8c9d3e4b4b4b4b4b4b4b4e",
    "status": "active",
    "periodStart": "2024-01-01T00:00:00.000Z",
    "periodEnd": "2024-01-31T00:00:00.000Z",
    "autoRenew": true,
    "stripeSubscriptionId": "sub_1MqM5W2eZvKYlo2CvsXqLsHt"
  },
  "message": "Subscribed successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated
- 402: PAYMENT_REQUIRED - Payment failed
- 409: CONFLICT - Already subscribed

---

### Update Subscription

Updates an existing subscription (change plan, pause, resume).

**PUT `/:id`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "action": "change_plan",
  "planId": "5f8c9d3e4b4b4b4b4b4b4b4c"
}
```

Alternative actions:
```json
{ "action": "pause" }
{ "action": "resume" }
{ "action": "toggle_autorenew" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
    "status": "active",
    "planId": "5f8c9d3e4b4b4b4b4b4b4b4c",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  },
  "message": "Subscription updated successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid action
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - Not the subscriber
- 404: NOT_FOUND - Subscription not found

---

### Cancel Subscription

Cancels an existing subscription.

**DELETE `/:id`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "reason": "No longer needed",
  "cancelImmediately": false
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Not authenticated
- 403: FORBIDDEN - Not the subscriber
- 404: NOT_FOUND - Subscription not found

## Error Codes

| Code | Description |
|------|-------------|
| ALREADY_SUBSCRIBED | User already subscribed |
| PLAN_NOT_FOUND | Plan not found |
| PAYMENT_FAILED | Payment processing failed |
| SUBSCRIPTION_NOT_FOUND | Subscription not found |
| INVALID_ACTION | Invalid subscription action |

## Rate Limits

- List plans: 30 requests per minute per IP
- View subscriptions: 30 requests per minute per user
- Create/Update/Cancel: 10 requests per minute per user