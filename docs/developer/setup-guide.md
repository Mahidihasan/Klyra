# Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.x
- **pnpm** >= 8.x
- **Docker** & **Docker Compose**
- **Git**
- **Make** (optional, for Makefile commands)
- **PostgreSQL** 15 (if not using Docker)
- **Redis** 7 (if not using Docker)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/api-marketplace.git
cd api-marketplace
```

### 2. Install Dependencies

Using pnpm workspace:

```bash
pnpm install
```

This installs dependencies for the root, backend, and frontend packages.

### 3. Configure Environment Variables

Copy the example environment files:

```bash
# Root environment
cp .env.example .env

# Backend environment
cd backend
cp .env.example .env
cd ..

# Frontend environment
cd frontend
cp .env.example .env
cd ..
```

Update the `.env` files with your configuration values.

### 4. Start Infrastructure Services

Start PostgreSQL and Redis using Docker:

```bash
docker-compose up -d postgres redis
```

To verify services are running:

```bash
docker-compose ps
```

### 5. Run Database Migrations

```bash
cd backend
pnpm prisma migrate dev
cd ..
```

### 6. Seed the Database

```bash
cd backend
pnpm prisma db seed
cd ..
```

## Development

### Start the Development Server

From the project root:

```bash
pnpm dev
```

This starts both:
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:4000

### Alternative: Individual Services

Start backend only:
```bash
cd backend
pnpm dev
```

Start frontend only:
```bash
cd frontend
pnpm dev
```

### Using Docker Compose

To run everything in Docker:

```bash
docker-compose up --build
```

This starts PostgreSQL, Redis, backend, frontend, and Nginx.

## Testing

### Run All Tests

```bash
pnpm test
```

### Backend Tests

```bash
cd backend
pnpm test           # Run all tests
pnpm test:unit      # Unit tests only
pnpm test:integration # Integration tests
pnpm test:e2e       # E2E tests
```

### Frontend Tests

```bash
cd frontend
pnpm test           # Run all tests
pnpm test:unit      # Unit tests
pnpm test:e2e       # E2E tests
```

## Linting & Formatting

```bash
# Lint
pnpm lint

# Format
pnpm format

# Check formatting
pnpm format:check
```

## Building for Production

```bash
pnpm build
```

Build output:
- Backend: `backend/dist/`
- Frontend: `frontend/dist/`

## Troubleshooting

### Port Already in Use

If port 3000 or 4000 is in use:

```bash
# Check what's using the port (Windows)
netstat -ano | findstr :3000

# Kill the process (Windows)
taskkill /PID <PID> /F
```

### Database Connection Issues

1. Verify PostgreSQL is running:
```bash
docker-compose ps postgres
```

2. Check connection string in `.env`

3. Verify credentials match `docker-compose.yml`

### Redis Connection Issues

1. Verify Redis is running:
```bash
docker-compose ps redis
```

2. Check `REDIS_URL` in `.env`

## Additional Resources

- [Coding Standards](coding-standards.md)
- [Contribution Guide](contribution-guide.md)
- [System Architecture](../architecture/system-architecture.md)
- [API Design](../architecture/api-design.md)