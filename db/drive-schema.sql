CREATE TABLE IF NOT EXISTS salvoai_drive_connections (
  owner text PRIMARY KEY, token_envelope text NOT NULL, account_email text NOT NULL,
  owner_key text NOT NULL, generation text NOT NULL DEFAULT '', folder_id text, connected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS salvoai_backup_state (
  owner text PRIMARY KEY, revision bigint NOT NULL DEFAULT 0, dirty boolean NOT NULL DEFAULT true,
  last_success timestamptz, last_checked timestamptz, last_hash text, last_file_id text,
  last_error text, error_code text, lease_id text, lease_until timestamptz
);
ALTER TABLE salvoai_drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE salvoai_backup_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE salvoai_drive_connections ADD COLUMN IF NOT EXISTS generation text NOT NULL DEFAULT '';
