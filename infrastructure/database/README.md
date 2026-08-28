# Database Schema & Deployment

## Overview

This directory contains the production-ready PostgreSQL database schema for the API Marketplace platform. The schema is designed for PostgreSQL 15+ and includes features for scalability, security, and maintainability.

## Files

- `schema.sql` - Complete database schema with tables, indexes, views, triggers, and seed data

## Deployment

### Prerequisites

- PostgreSQL 15 or higher
- Required extensions (auto-created by schema):
  - `uuid-ossp`, `pgcrypto`, `citext`, `pg_trgm`, `btree_gin`

### Applying the Schema

```bash
# Apply schema to a new database
psql -U postgres -d api_marketplace -f schema.sql

# Or via Docker
docker exec -i api-marketplace-postgres psql -U api_marketplace -d api_marketplace_dev < schema.sql
```

### Schema Features

#### Scalability
- **UUID primary keys** with `gen_random_uuid()` for distributed-friendly IDs
- **Monthly partitioning** on `api_analytics` table for billions of records
- **Partial indexes** on high-volume tables
- **Trigram indexes** (`pg_trgm`) for efficient text search
- **GIN indexes** on JSONB and array columns

#### Security
- **Row-Level Security (RLS)** implemented on all data tables
- **Application roles** (`app_user`, `app_provider`, `app_admin`) for least-privilege access
- **Encrypted sensitive fields** (passwords, API keys, TOTP secrets)
- **Case-insensitive emails** using `CITEXT`

#### Maintainability
- **Auto-updating `updated_at`** via trigger functions
- **Materialized views** for dashboard performance
- **Soft deletes** (`deleted_at`) on all primary entities
- **Comprehensive comments** for all tables and columns

### Maintenance

#### Monthly Partition Management

```sql
-- Create a new partition for next month
SELECT create_analytics_partition('2026-09-01');

-- Drop old partitions (data retention)
SELECT drop_analytics_partition('2024-01-01');
```

#### Refreshing Materialized Views

```sql
-- Schedule via cron/pg_cron, e.g., every 15 minutes
SELECT refresh_materialized_views();
```

Suggest adding to postgresql.conf or pg_cron:

```sql
SELECT cron.schedule(
    'refresh-materialized-views',
    '*/15 * * * *',
    'SELECT refresh_materialized_views();'
);
```

### Monitoring

Consider setting up:

1. **pg_stat_statements** - Query performance monitoring
2. **pg_stat_activity** - Connection monitoring
3. **pg_stat_user_tables** - Table-level statistics
4. **Prometheus + Grafana** - Via existing infrastructure/monitoring setup

### Backup Strategy

Recommended backup approach:

```bash
# Daily full backup
pg_dump -Fc -d api_marketplace > backup_$(date +%Y%m%d).dump

# Restore
pg_restore -d api_marketplace backup.dump

# Or use continuous archiving (WAL) for PITR:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /backup/wal/%f'
```

### Initial Credentials

The seed data creates an admin user:

```
Email: admin@apimarketplace.com
Password: ChangeMe123!
```

**IMPORTANT**: Change this password immediately after deployment.

## Schema Evolution

Migrations should be added incrementally:

1. Create migration file in this directory (e.g., `2026_08_09_001_add_webhooks.sql`)
2. Test on a staging database first
3. Apply to production during low-traffic windows
4. Always backup before applying migrations