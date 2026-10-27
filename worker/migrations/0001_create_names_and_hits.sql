-- SPEC 7.3
CREATE TABLE names (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  name_key   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  hidden     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE hits (
  ip_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 回数制限の集計と古い行の削除で、接続元と日時で絞り込むため
CREATE INDEX hits_ip_hash_created_at ON hits (ip_hash, created_at);
