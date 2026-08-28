.PHONY: help dev build lint test clean migrate seed deploy backup restore

help:
	@echo 'Available commands:'
	@echo '  make dev        - Start development environment with hot reload'
	@echo '  make build      - Build production assets'
	@echo '  make lint       - Run linter'
	@echo '  make test       - Run tests'
	@echo '  make clean      - Clean build artifacts'
	@echo '  make migrate    - Run database migrations'
	@echo '  make seed       - Seed database with initial data'
	@echo '  make deploy     - Deploy to production'
	@echo '  make backup     - Backup database'
	@echo '  make restore    - Restore database from backup'

dev:
	pnpm dev

build:
	pnpm build

lint:
	pnpm lint

test:
	pnpm test

clean:
	rm -rf backend/dist frontend/dist
	rm -rf **/node_modules
	rm -rf **/.turbo

migrate:
	cd backend && pnpm prisma migrate dev

seed:
	cd backend && pnpm prisma db seed

deploy:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

backup:
	@echo 'Creating database backup...'
	@docker exec api-marketplace-postgres pg_dump -U $(POSTGRES_USER) $(POSTGRES_DB) > backup_$$(date +%Y%m%d_%H%M%S).sql

restore:
	@echo 'Restoring database from backup...'
	@cat $(backup_file) | docker exec -i api-marketplace-postgres psql -U $(POSTGRES_USER) $(POSTGRES_DB)