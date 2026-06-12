import type { ModuleDb } from '@mosaic/sdk'

export function migrate(db: ModuleDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts_contacts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      first_name TEXT    NOT NULL,
      last_name  TEXT    NOT NULL DEFAULT '',
      email      TEXT    NOT NULL DEFAULT '',
      phone      TEXT    NOT NULL DEFAULT '',
      birthday   TEXT,
      notes      TEXT    NOT NULL DEFAULT '',
      tags       TEXT    NOT NULL DEFAULT '',
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS contacts_contacts_user     ON contacts_contacts(user_id, active)`)
  db.exec(`CREATE INDEX IF NOT EXISTS contacts_contacts_birthday ON contacts_contacts(user_id, birthday)`)
}
