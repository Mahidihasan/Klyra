# System Architecture

## Overview

The API Marketplace is a full-stack web application built with a microservices-oriented architecture. It consists of a React frontend, an Express.js backend, and supporting infrastructure services.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                 │
│                    Port 80/443 (HTTPS)                       │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
             ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│   Frontend (React)      │    │   Backend (Express.js)      │
│   Port: 3000            │    │   Port: 4000                │
│   • Vite Dev Server     │    │   • REST API                │
│   • Redux Toolkit       │    │   • JWT Auth               │
│   • Tailwind CSS        │    │   • API Key Management     │
└─────────────────────────┘    └─────────────┬───────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
        ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
        │   PostgreSQL      │    │      Redis        │    │   External APIs   │
        │   (Primary DB)    │    │   (Cache/Queue)   │    │   • OpenAI        │
        │   Port: 5432      │    │   Port: 6379      │    │   • Stripe        │
        └───────────────────┘    └───────────────────┘    │   • SMTP          │
                                                          └───────────────────┘
```

## Core Components

### 1. Frontend Application
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **State Management:** Redux Toolkit with RTK Query
- **Styling:** Tailwind CSS
- **Key Features:**
  - API marketplace browsing and search
  - Interactive API playground
  - AI-powered tools (documentation generator, security audit, chat assistant)
  - User dashboards (provider, consumer, admin)
  - Subscription management
  - Real-time notifications

### 2. Backend API Server
- **Framework:** Express.js with TypeScript
- **ORM:** Prisma
- **Authentication:** JWT with refresh tokens
- **Key Features:**
  - RESTful API with versioning
  - API key management for third-party access
  - Rate limiting and security middleware
  - Webhook handling for payments
  - Background job processing with Bull
  - AI integration with OpenAI

### 3. Database Layer
- **Primary Database:** PostgreSQL 15
- **ORM:** Prisma
- **Caching:** Redis 7
- **Key Data Models:**
  - Users and roles
  - APIs and categories
  - Subscriptions and payments
  - API keys
  - Reviews and ratings
  - Analytics events
  - Notifications

### 4. Infrastructure Services
- **Reverse Proxy:** Nginx
- **Containerization:** Docker & Docker Compose
- **Monitoring:** Prometheus & Grafana
- **CI/CD:** GitHub Actions

## Data Flow

### API Request Flow
1. Client sends request to Nginx
2. Nginx routes to appropriate service
3. Backend validates authentication (JWT/API key)
4. Rate limiting check
5. Request validation
6. Business logic execution
7. Database operations via Prisma
8. Response formatting and caching
9. Response returned to client

### Payment Flow
1. User selects subscription plan
2. Backend creates Stripe checkout session
3. User completes payment on Stripe
4. Stripe webhook notifies backend
5. Backend updates subscription status
6. Notification sent to user

## Security Architecture

- **Authentication:** JWT with refresh token rotation
- **Authorization:** Role-based access control (RBAC)
- **API Security:** API key authentication for third-party access
- **Data Protection:** Encrypted sensitive data, HTTPS in production
- **Rate Limiting:** Per-user and per-IP rate limits
- **Input Validation:** Zod schema validation
- **Security Headers:** Helmet middleware
- **CORS:** Configurable origin whitelist

## Scalability

- **Horizontal Scaling:** Stateless backend can be scaled horizontally
- **Database:** Connection pooling, read replicas
- **Caching:** Redis for session and data caching
- **Queue:** BullMQ for background jobs
- **CDN:** Static assets served via CDN

## Deployment

- **Development:** Docker Compose
- **Production:** Docker Compose with production configuration
- **CI/CD:** GitHub Actions for automated testing and deployment