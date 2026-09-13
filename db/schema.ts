export const createGameStateTable = `
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    script_id TEXT NOT NULL,
    day_number INTEGER NOT NULL,
    phase TEXT NOT NULL,
    game_started INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

export const createGameLogsTable = `
  CREATE TABLE IF NOT EXISTS game_logs (
    id TEXT PRIMARY KEY,
    day_number INTEGER NOT NULL,
    phase TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT,
    created_at INTEGER NOT NULL
  )
`;

export const createGameLogsOrderIndex = `
  CREATE INDEX IF NOT EXISTS game_logs_created_at_idx ON game_logs(created_at)
`;

export const createGameSnapshotsTable = `
  CREATE TABLE IF NOT EXISTS game_snapshots (
    client_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;
