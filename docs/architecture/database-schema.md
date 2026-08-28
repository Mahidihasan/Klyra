# Database Schema

## Overview

This document describes the database schema for the API Marketplace platform. The application uses PostgreSQL with Prisma ORM.

## Entity Relationships

```
User 1───* Api
User 1───* ApiKey
User 1───* Subscription
User 1───* Review
User 1───* Notification
User 1───* PaymentMethod
User 1───* Invoice

Category 1───* Api
Api 1───* ApiVersion
Api 1───* Subscription
Api 1───* Review
Api 1───* AnalyticsEvent
Api 1───* Collection

Subscription 1───* Payment
Subscription 1───* Invoice
```

## Tables

### User
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique email |
| password | VARCHAR(255) | Hashed password |
| name | VARCHAR(100) | Full name |
| role | ENUM | USER, PROVIDER, ADMIN |
| avatar | VARCHAR(500) | Profile image URL |
| bio | TEXT | User bio |
| company | VARCHAR(255) | Company name |
| website | VARCHAR(500) | Personal website |
| isEmailVerified | BOOLEAN | Email verification status |
| isActive | BOOLEAN | Account status |
| lastLoginAt | TIMESTAMP | Last login time |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

### Category
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Category name |
| slug | VARCHAR(150) | URL-friendly name |
| description | TEXT | Category description |
| icon | VARCHAR(500) | Category icon URL |
| parentId | UUID | Parent category (nullable) |
| isActive | BOOLEAN | Category status |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

### Api
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(200) | API name |
| slug | VARCHAR(255) | URL-friendly name |
| description | TEXT | API description |
| version | VARCHAR(20) | Current version |
| baseUrl | VARCHAR(500) | API base URL |
| docsUrl | VARCHAR(500) | Documentation URL |
| logo | VARCHAR(500) | API logo URL |
| categoryId | UUID | FK to Category |
| ownerId | UUID | FK to User |
| pricing | JSON | Pricing structure |
| status | ENUM | DRAFT, PENDING, PUBLISHED, ARCHIVED |
| isPublic | BOOLEAN | Public visibility |
| apiSpec | JSON | OpenAPI specification |
| tags | JSON | Array of tags |
| rating | DECIMAL(3,2) | Average rating |
| totalReviews | INTEGER | Number of reviews |
| totalSubscribers | INTEGER | Number of subscribers |
| totalRequests | BIGINT | Total API requests |
| lastPublishAt | TIMESTAMP | Last published time |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

### ApiVersion
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| apiId | UUID | FK to Api |
| version | VARCHAR(20) | Version number |
| apiSpec | JSON | Version-specific spec |
| changelog | TEXT | Version changes |
| isDeprecated | BOOLEAN | Deprecation status |
| releasedAt | TIMESTAMP | Release date |
| createdAt | TIMESTAMP | Creation time |

### ApiKey
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| name | VARCHAR(100) | Key name |
| key | VARCHAR(64) | Hashed API key |
| keyPrefix | VARCHAR(10) | Display prefix |
| permissions | JSON | Key permissions |
| rateLimit | INTEGER | Requests per minute |
| expiresAt | TIMESTAMP | Expiration date |
| lastUsedAt | TIMESTAMP | Last usage time |
| isActive | BOOLEAN | Key status |
| createdAt | TIMESTAMP | Creation time |
| revokedAt | TIMESTAMP | Revocation time |

### Subscription
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| apiId | UUID | FK to Api |
| planId | VARCHAR(50) | Stripe plan ID |
| status | ENUM | ACTIVE, PAUSED, CANCELLED, EXPIRED |
| periodStart | TIMESTAMP | Billing period start |
| periodEnd | TIMESTAMP | Billing period end |
| autoRenew | BOOLEAN | Auto-renewal flag |
| stripeSubscriptionId | VARCHAR(255) | Stripe subscription ID |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

### Payment
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| subscriptionId | UUID | FK to Subscription |
| amount | DECIMAL(10,2) | Payment amount |
| currency | VARCHAR(3) | Currency code |
| status | ENUM | PENDING, SUCCEEDED, FAILED, REFUNDED |
| stripePaymentId | VARCHAR(255) | Stripe payment ID |
| paymentMethod | VARCHAR(50) | Payment method |
| createdAt | TIMESTAMP | Creation time |

### Invoice
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| subscriptionId | UUID | FK to Subscription |
| invoiceNumber | VARCHAR(50) | Unique invoice number |
| amount | DECIMAL(10,2) | Invoice amount |
| currency | VARCHAR(3) | Currency code |
| status | ENUM | DRAFT, SENT, PAID, OVERDUE, VOID |
| stripeInvoiceId | VARCHAR(255) | Stripe invoice ID |
| pdfUrl | VARCHAR(500) | Invoice PDF URL |
| dueDate | TIMESTAMP | Payment due date |
| paidAt | TIMESTAMP | Payment date |
| createdAt | TIMESTAMP | Creation time |

### Review
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| apiId | UUID | FK to Api |
| rating | INTEGER | 1-5 rating |
| title | VARCHAR(200) | Review title |
| content | TEXT | Review content |
| isVerified | BOOLEAN | Verified purchase |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

### Notification
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| type | ENUM | EMAIL, IN_APP, PUSH |
| category | ENUM | BILLING, SYSTEM, API, SECURITY |
| title | VARCHAR(200) | Notification title |
| content | TEXT | Notification content |
| data | JSON | Additional data |
| isRead | BOOLEAN | Read status |
| readAt | TIMESTAMP | Read time |
| createdAt | TIMESTAMP | Creation time |

### AnalyticsEvent
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| apiId | UUID | FK to Api |
| apiKeyId | UUID | FK to ApiKey |
| userId | UUID | FK to User |
| eventType | ENUM | REQUEST, ERROR, LATENCY |
| statusCode | INTEGER | HTTP status code |
| latency | INTEGER | Response time (ms) |
| endpoint | VARCHAR(500) | Requested endpoint |
| method | VARCHAR(10) | HTTP method |
| userAgent | VARCHAR(500) | Client user agent |
| ipAddress | VARCHAR(45) | Client IP |
| timestamp | TIMESTAMP | Event timestamp |

### Collection
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| name | VARCHAR(200) | Collection name |
| description | TEXT | Collection description |
| requests | JSON | Array of saved requests |
| isPublic | BOOLEAN | Public visibility |
| isFavorite | BOOLEAN | Favorite flag |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

## Indexes

### User
- `idx_user_email` - UNIQUE on email
- `idx_user_role` - on role

### Api
- `idx_api_slug` - UNIQUE on slug
- `idx_api_category` - on categoryId
- `idx_api_owner` - on ownerId
- `idx_api_status` - on status
- `idx_api_rating` - on rating

### ApiKey
- `idx_apikey_user` - on userId
- `idx_apikey_key` - UNIQUE on key

### Subscription
- `idx_subscription_user` - on userId
- `idx_subscription_api` - on apiId
- `idx_subscription_status` - on status

### AnalyticsEvent
- `idx_analytics_api` - on apiId
- `idx_analytics_timestamp` - on timestamp
- `idx_analytics_apikey` - on apiKeyId

## Prisma Schema Location

The Prisma schema file is located at:
```
backend/prisma/schema.prisma
```

## Migrations

Database migrations are managed with Prisma Migrate:
```bash
pnpm prisma migrate dev     # Development
pnpm prisma migrate deploy  # Production