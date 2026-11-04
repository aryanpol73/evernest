import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

// The parts of a Supabase project the migrations depend on, including the
// default privileges that make new public tables and functions API-reachable.
const SUPABASE_STUB = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;

  CREATE SCHEMA auth;
  CREATE SCHEMA storage;
  CREATE SCHEMA extensions;

  CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'
  );

  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb
  $$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT (auth.jwt() ->> 'sub')::uuid
  $$;

  CREATE TABLE storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    public boolean NOT NULL DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  CREATE TABLE storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text NOT NULL
  );
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  CREATE PUBLICATION supabase_realtime;

  GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
}

export async function createDatabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  return db;
}

export async function applyMigrations(db: PGlite, files: string[]): Promise<void> {
  for (const file of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
}

export async function createUser(db: PGlite, id: string): Promise<string> {
  await db.query("INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, $2)", [
    id,
    JSON.stringify({ full_name: "Test User" }),
  ]);
  const { rows } = await db.query<{ id: string }>("SELECT id FROM public.families WHERE owner_id = $1", [id]);
  return rows[0].id;
}

type Claims = Record<string, unknown>;

async function asRole<T>(db: PGlite, role: string, claims: Claims, run: (tx: Transaction) => Promise<T>): Promise<T> {
  const result = await db.transaction(async tx => {
    await tx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(`SET LOCAL ROLE ${role}`);
    return run(tx);
  });
  return result as T;
}

export function asUser<T>(db: PGlite, userId: string, run: (tx: Transaction) => Promise<T>, claims: Claims = {}): Promise<T> {
  return asRole(db, "authenticated", { sub: userId, role: "authenticated", ...claims }, run);
}

export function asAnon<T>(db: PGlite, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return asRole(db, "anon", { role: "anon" }, run);
}
