Database setup (PostgreSQL)

1. Create a database and set DATABASE_URL in .env (see .env.example)
2. Apply schema:
   psql $DATABASE_URL -f db/schema.sql
3. Apply seeds (optional):
   psql $DATABASE_URL -f db/seed.sql

Notes:
- The app uses Supabase Auth for authentication; the users table stores profile metadata only.
- For local development, consider running PostgreSQL in Docker and mapping ports.
- For migrations in CI/production, use your preferred migration tool (node-pg-migrate, flyway, liquibase, etc.).
