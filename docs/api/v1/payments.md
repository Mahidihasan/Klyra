# Payments API

## Overview

Base URL: `/api/v1/payments`

All endpoints require authentication except the webhook endpoint.

## Endpoints

### Create Checkout Session

Creates a Stripe checkout session for a subscription.

**POST `/checkout`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "apiId": "5f8c9d3e4b4b4b4b4b4b4b4d",
  "planId": "5f8c9d3e4b4b4b4b4b4b4b4e",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
    "sessionId": "cs_test_1MqM5W2eZvKYlo2CvsXqLsHt",
    "expiresAt": "2024-01-01T01:00:00.000Z"
  },
  "message": "Checkout session created successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Not authenticated

---

### Stripe Webhook

Handles Stripe webhook events.

**POST `/webhook`**

**Headers:**
```
Stripe-Signature: <signature>
```

**Request:**
```json
{
  "id": "evt_1MqM5W2eZvKYlo2CvsXqLsHt",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_1MqM5W2eZvKYlo2CvsXqLsHt",
      "customer_email": "user@example.com",
      "payment_status": "paid",
      "metadata": {
        "userId": "5f8c9d3e4b4b4b4b4b4b4b4b",
        "apiId": "5f8c9d3e4b4b4b4b4b4b4b4d",
        "planId": "5f8c9d3e4b4b4b4b4b4b4b4e"
      }
    }
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "received": true
}
```

**Supported Event Types:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `refund.created`

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid payload
- 401: UNAUTHORIZED - Invalid signature

---

### Get User Invoices

Retrieves all invoices for the authenticated user.

**GET `/invoices`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by status (paid, unpaid, void)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "5f8c9d3e4b4b4b4b4b4b4b4f",
        "invoiceNumber": "INV-2024-0001",
        "subscription": {
          "id": "5f8c9d3e4b4b4b4b4b4b4b4e",
          "api": {
            "id": "5f8c9d3e4b4b4b4b4b4b4b4d",
            "name": "Weather API"
          },
          "plan": { "name": "Pro" }
        },
        "amount": 29.99,
        "currency": "usd",
        "status": "paid",
        "pdfUrl": "https://example.com/invoices/INV-2024-0001.pdf",
        "dueDate": "2024-01-01T00:00:00.000Z",
        "paidAt": "2024-01-01T00:00:00.000Z",
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
  "message": "Invoices retrieved successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Not authenticated

---

### Get Payment Methods

Retrieves all payment methods for the authenticated user.

**GET `/methods`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentMethods": [
      {
        "id": "pm_1MqM5W2eZvKYlo2CvsXqLsHt",
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2025,
        "isDefault": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  },
  "message": "Payment methods retrieved successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Not authenticated

---

### Add Payment Method

Adds a new payment method for the authenticated user.

**POST `/methods`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "paymentMethodId": "pm_1MqM5W2eZvKYlo2CvsXqLsHt",
  "setAsDefault": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "pm_1MqM5W2eZvKYlo2CvsXqLsHt",
    "brand": "visa",
    "last4": "4242",
    "isDefault": true
  },
  "message": "Payment method added successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid payment method
- 401: UNAUTHORIZED - Not authenticated

---

### Delete Payment Method

Removes a payment method from the authenticated user's account.

**DELETE `/methods/:id`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment method deleted successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Cannot delete default method
- 401: UNAUTHORIZED - Not authenticated
- 404: NOT_FOUND - Payment method not found

## Error Codes

| Code | Description |
|------|-------------|
| CHECKOUT_FAILED | Stripe checkout creation failed |
| INVALID_SIGNATURE | Invalid webhook signature |
| PAYMENT_METHOD_NOT_FOUND | Payment method not found |
| INVOICE_NOT_FOUND | Invoice not found |

## Rate Limits

- Checkout: 10 requests per minute per user
- Invoices: 30 requests per minute per user
- Payment methods: 10 requests per minute per user
- Webhook: No limit (IP restricted)