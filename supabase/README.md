# ShiftProof — Supabase

Supabase is ShiftProof's backend: **Postgres database, authentication, Row Level Security, and file storage**. This directory holds the versioned database contracts. The repo is canonical; the Supabase project reflects what's here.

## Files

- **`schema.sql`** — the database schema: tables, enums, constraints, indexes, and the `updated_at` trigger. Owns the *structure* of the data.
- **`policies.sql`** — Row Level Security: enabling RLS and defining who can read/write what. Owns *access control*.

Apply them in order: `schema.sql` first, then `policies.sql`.

## Schema ownership

- The schema is defined **only** in `schema.sql`, versioned in this repo.
- Changes are made in the file first, reviewed via pull request, then applied to the Supabase project (SQL editor for MVP; migrations later).
- Keep `schema.sql` aligned with `docs/DATA_MODEL.md` — they describe the same entities and must not drift.
- Conventions: UUID primary keys, `created_at`/`updated_at` where sensible (with a trigger to maintain `updated_at`), foreign keys with sensible `on delete` behavior, and enums/check constraints for controlled values.

## Policy ownership

- All Row Level Security lives in `policies.sql`.
- Access is **location-based** (via the `user_locations` membership) and **role-aware** (`owner`, `manager`, `staff`).
- RLS is the primary authorization boundary — both client (anon key) and server access are governed by it. The service role key bypasses RLS and must only be used server-side, sparingly.
- Policies in the initial version are **provisional** and marked as such in comments; tighten them as the app's real access patterns are implemented.

## Storage usage for photos

- Proof photos are stored in a Supabase **Storage bucket** (suggested name: `shift-photos`), **not** in the database.
- The `photos` table holds the reference (`storage_path`), the owning `location_id` and `task_run_id`, and who uploaded it.
- The bucket should be **private**; the app serves images via signed URLs or authenticated access.
- Storage access must be scoped consistently with table RLS (by location). Storage policies are **not yet defined here** — add them alongside the upload implementation, mirroring the location-based access model. (Marked as a gap for the next step.)

## Migration expectations (later)

- For the MVP, apply `schema.sql` / `policies.sql` directly to the Supabase project.
- Once the schema stabilizes, adopt **Supabase CLI migrations**: introduce a `supabase/migrations/` directory, capture the current schema as the baseline migration, and make all subsequent changes as ordered migration files.
- Until then, treat `schema.sql` and `policies.sql` as the single, hand-applied source of truth and keep every change reviewable in the repo.
