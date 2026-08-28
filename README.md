# API Marketplace

A comprehensive API marketplace platform where developers can publish, discover, test, and subscribe to APIs. Built with a modern tech stack including Node.js, Express, TypeScript, React, Prisma, PostgreSQL, and Redis.

## Features

- **API Publishing & Management** - Publish and manage your APIs with versioning, documentation, and pricing
- **API Discovery & Consumption** - Browse, search, and subscribe to APIs from various providers
- **Interactive Playground** - Test APIs directly in the browser with a built-in request builder
- **AI-Powered Tools** - Documentation generation, security auditing, chat assistant, and API idea generation
- **Subscription & Billing** - Flexible subscription plans with Stripe payment integration
- **Analytics & Monitoring** - Track API usage, performance metrics, and revenue analytics
- **Reviews & Ratings** - Community feedback system with ratings and reviews
- **Notifications** - Real-time notifications for API updates, billing, and activity

## Tech Stack

### Backend
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Cache:** Redis
- **Queue:** Bull (Redis-backed job queue)
- **Payment:** Stripe
- **AI:** OpenAI API
- **Storage:** AWS S3 / Cloud Storage
- **Email:** Nodemailer / SendGrid
- **Auth:** JWT / OAuth2.0

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **State Management:** Redux Toolkit
- **Styling:** Tailwind CSS
- **Router:** React Router v6
- **HTTP Client:** Axios
- **Form Handling:** React Hook Form
- **Testing:** Jest + React Testing Library

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **Reverse Proxy:** Nginx
- **Monitoring:** Prometheus & Grafana
- **CI/CD:** GitHub Actions

## Project Structure

```
api-marketplace/
├── backend/          # Express.js API server
├── frontend/         # React client application
├── infrastructure/   # Docker, Nginx, monitoring configs
├── docs/            # Documentation
├── scripts/         # Utility scripts
└── .github/         # GitHub Actions workflows
```

## Getting Started

### Prerequisites

- Node.js >= 18.x
- pnpm >= 8.x
- Docker & Docker Compose
- PostgreSQL
- Redis

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Mahidihasan/Klyra.git
cd api-marketplace
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development environment:
```bash
make dev
```

5. Run database migrations:
```bash
make migrate
```

6. Seed the database:
```bash
make seed
```

7. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Documentation: http://localhost:4000/api/v1/docs

## Development

### Available Commands

```bash
make dev          # Start development environment
make build        # Build production assets
make lint         # Run linter
make test         # Run tests
make migrate      # Run database migrations
make seed         # Seed database
make deploy       # Deploy to production
```

### Environment Variables

See `.env.example` for all required environment variables.

## API Documentation

Full API documentation is available at `/api/v1/docs` when the server is running.

## Contributing

Please read [CONTRIBUTING.md](docs/developer/contribution-guide.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
