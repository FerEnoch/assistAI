import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for AssistAI MVP.
 *
 * Tables: users, workspaces, workspace_members, model_endpoints,
 * content_sources, source_sync_runs, documents, document_versions,
 * document_chunks (with pgvector), editor_sessions, completion_requests,
 * completion_retrieval_hits, usage_events.
 *
 * Uses raw SQL because TypeORM's schema diff does not support
 * pgvector's `vector` type or HNSW indexes.
 */
export class InitialSchema1711900000000 implements MigrationInterface {
  name = 'InitialSchema1711900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector and uuid-ossp extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector";`);

    // ──────────────────────────────────────────
    // ENUM types
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
    `);

    await queryRunner.query(`
      CREATE TYPE workspace_member_role AS ENUM ('owner', 'admin', 'member');
    `);

    await queryRunner.query(`
      CREATE TYPE provider_type AS ENUM ('managed', 'byo');
    `);

    await queryRunner.query(`
      CREATE TYPE endpoint_status AS ENUM ('active', 'validating', 'error');
    `);

    await queryRunner.query(`
      CREATE TYPE source_type AS ENUM ('google_drive');
    `);

    await queryRunner.query(`
      CREATE TYPE source_status AS ENUM ('connected', 'syncing', 'error', 'disconnected');
    `);

    await queryRunner.query(`
      CREATE TYPE sync_run_status AS ENUM ('running', 'completed', 'failed');
    `);

    await queryRunner.query(`
      CREATE TYPE ingest_status AS ENUM ('queued', 'processing', 'indexed', 'failed');
    `);

    await queryRunner.query(`
      CREATE TYPE completion_outcome AS ENUM ('completed', 'error', 'timeout', 'cancelled');
    `);

    await queryRunner.query(`
      CREATE TYPE usage_event_type AS ENUM (
        'completion_request', 'completion_accepted',
        'source_connected', 'source_disconnected',
        'document_indexed', 'document_deleted'
      );
    `);

    // ──────────────────────────────────────────
    // users
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE users (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email       VARCHAR(320) NOT NULL,
        display_name VARCHAR(255),
        locale      VARCHAR(10) NOT NULL DEFAULT 'es-ES',
        status      user_status NOT NULL DEFAULT 'active',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,

        CONSTRAINT uq_users_email UNIQUE (email)
      );
    `);

    // ──────────────────────────────────────────
    // workspaces
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE workspaces (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name            VARCHAR(255) NOT NULL,
        primary_language VARCHAR(10) NOT NULL DEFAULT 'es',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_workspaces_owner ON workspaces(owner_user_id);
    `);

    // ──────────────────────────────────────────
    // workspace_members
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE workspace_members (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role          workspace_member_role NOT NULL DEFAULT 'member',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
      );
    `);

    // ──────────────────────────────────────────
    // model_endpoints
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE model_endpoints (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider_type     provider_type NOT NULL,
        base_url          VARCHAR(2048),
        model_name        VARCHAR(255) NOT NULL,
        encrypted_api_key TEXT,
        key_version       INT NOT NULL DEFAULT 1,
        is_default        BOOLEAN NOT NULL DEFAULT false,
        status            endpoint_status NOT NULL DEFAULT 'validating',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_model_endpoints_workspace ON model_endpoints(workspace_id);
    `);

    // ──────────────────────────────────────────
    // content_sources
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE content_sources (
        id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id              UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_type               source_type NOT NULL,
        google_refresh_token_enc  TEXT,
        root_locator              VARCHAR(2048),
        status                    source_status NOT NULL DEFAULT 'connected',
        last_synced_at            TIMESTAMPTZ,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_content_sources_workspace ON content_sources(workspace_id);
    `);

    // ──────────────────────────────────────────
    // source_sync_runs
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE source_sync_runs (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source_id        UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
        started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at      TIMESTAMPTZ,
        status           sync_run_status NOT NULL DEFAULT 'running',
        discovered_count INT NOT NULL DEFAULT 0,
        error_summary    TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_sync_runs_source ON source_sync_runs(source_id);
    `);

    // ──────────────────────────────────────────
    // documents
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE documents (
        id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_id            UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
        external_document_id VARCHAR(1024),
        title                VARCHAR(1024),
        mime_type            VARCHAR(255),
        checksum             VARCHAR(128),
        ingest_status        ingest_status NOT NULL DEFAULT 'queued',
        indexed_at           TIMESTAMPTZ,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_documents_workspace_source ON documents(workspace_id, source_id);
      CREATE INDEX idx_documents_checksum ON documents(checksum);
    `);

    // ──────────────────────────────────────────
    // document_versions
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE document_versions (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        version       INT NOT NULL DEFAULT 1,
        checksum      VARCHAR(128) NOT NULL,
        size_bytes    BIGINT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_doc_versions_document ON document_versions(document_id);
    `);

    // ──────────────────────────────────────────
    // document_chunks (pgvector)
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE document_chunks (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        chunk_index   INT NOT NULL,
        content       TEXT NOT NULL,
        token_count   INT,
        embedding     vector(1024),
        model_version VARCHAR(100),
        content_hash  VARCHAR(128),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_chunks_document ON document_chunks(document_id);
      CREATE INDEX idx_chunks_workspace ON document_chunks(workspace_id);
    `);

    // HNSW index for vector similarity search (cosine distance)
    // Parameters locked per backlog §2.5: m=16, ef_construction=64
    await queryRunner.query(`
      CREATE INDEX idx_chunks_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    `);

    // ──────────────────────────────────────────
    // editor_sessions
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE editor_sessions (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        active_language   VARCHAR(10),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_editor_sessions_workspace ON editor_sessions(workspace_id);
    `);

    // ──────────────────────────────────────────
    // completion_requests
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE completion_requests (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        editor_session_id     UUID REFERENCES editor_sessions(id) ON DELETE SET NULL,
        model_endpoint_id     UUID REFERENCES model_endpoints(id) ON DELETE SET NULL,
        retrieved_chunk_count INT NOT NULL DEFAULT 0,
        latency_ms            INT,
        provider_latency_ms   INT,
        outcome_status        completion_outcome,
        accepted_by_user      BOOLEAN,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_completion_requests_workspace ON completion_requests(workspace_id);
      CREATE INDEX idx_completion_requests_created ON completion_requests(created_at);
    `);

    // ──────────────────────────────────────────
    // completion_retrieval_hits
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE completion_retrieval_hits (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        completion_request_id UUID NOT NULL REFERENCES completion_requests(id) ON DELETE CASCADE,
        document_chunk_id     UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
        rank                  INT NOT NULL,
        similarity_score      REAL NOT NULL
      );
      CREATE INDEX idx_retrieval_hits_request ON completion_retrieval_hits(completion_request_id);
    `);

    // ──────────────────────────────────────────
    // usage_events
    // ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE usage_events (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type    usage_event_type NOT NULL,
        units         INT NOT NULL DEFAULT 1,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_usage_events_workspace_type_created
        ON usage_events(workspace_id, event_type, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS usage_events CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS completion_retrieval_hits CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS completion_requests CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS editor_sessions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS document_chunks CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS document_versions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS documents CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS source_sync_runs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_sources CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS model_endpoints CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_members CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspaces CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE;`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS usage_event_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS completion_outcome;`);
    await queryRunner.query(`DROP TYPE IF EXISTS ingest_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS sync_run_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS source_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS source_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS endpoint_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS provider_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS workspace_member_role;`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_status;`);

    // Drop extensions (only if we own them — safe to leave)
    await queryRunner.query(`DROP EXTENSION IF EXISTS "vector";`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp";`);
  }
}
