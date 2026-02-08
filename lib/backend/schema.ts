/**
 * PocketBase Schema Types
 *
 * These types are derived from the PocketBase migrations in /pb_migrations.
 * They represent the EXACT structure of the database collections.
 *
 * IMPORTANT: All collections use `created_at` and `updated_at` (NOT `created`/`updated`).
 *
 * This file re-exports all types from the schema folder for backwards compatibility.
 * You can import directly from '@/lib/backend/schema' - no changes to existing imports needed.
 */

export * from "./schema/sessions";
export * from "./schema/logs";
export * from "./schema/variables";
