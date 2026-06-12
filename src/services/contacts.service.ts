import type { Database } from 'better-sqlite3'

export interface Contact {
  id:         number
  user_id:    number
  first_name: string
  last_name:  string
  email:      string
  phone:      string
  birthday:   string | null
  notes:      string
  tags:       string
  active:     number
  created_at: string
  updated_at: string
}

export interface CreateContactInput {
  first_name:  string
  last_name?:  string
  email?:      string
  phone?:      string
  birthday?:   string
  notes?:      string
  tags?:       string
}

export function createContact(db: Database, userId: number, data: CreateContactInput): Contact {
  if (!data.first_name || !data.first_name.trim()) throw new Error('first_name is required')

  const stmt = db.prepare(`
    INSERT INTO contacts_contacts (user_id, first_name, last_name, email, phone, birthday, notes, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    userId,
    data.first_name.trim(),
    data.last_name  ?? '',
    data.email      ?? '',
    data.phone      ?? '',
    data.birthday   ?? null,
    data.notes      ?? '',
    data.tags       ?? '',
  )
  return getContact(db, userId, result.lastInsertRowid as number)!
}

export function listContacts(
  db: Database,
  userId: number,
  opts: { search?: string; includeArchived?: boolean },
): Contact[] {
  const { search, includeArchived } = opts

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`
    return db.prepare(`
      SELECT * FROM contacts_contacts
      WHERE user_id = ?
        AND (? = 1 OR active = 1)
        AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)
      ORDER BY last_name ASC, first_name ASC
    `).all(userId, includeArchived ? 1 : 0, pattern, pattern, pattern, pattern) as Contact[]
  }

  return db.prepare(`
    SELECT * FROM contacts_contacts
    WHERE user_id = ?
      AND (? = 1 OR active = 1)
    ORDER BY last_name ASC, first_name ASC
  `).all(userId, includeArchived ? 1 : 0) as Contact[]
}

export function getContact(db: Database, userId: number, id: number): Contact | null {
  return (db.prepare(`
    SELECT * FROM contacts_contacts WHERE id = ? AND user_id = ?
  `).get(id, userId) as Contact | undefined) ?? null
}

export function updateContact(
  db: Database,
  userId: number,
  id: number,
  data: Partial<CreateContactInput>,
): Contact | null {
  const existing = getContact(db, userId, id)
  if (!existing) return null

  db.prepare(`
    UPDATE contacts_contacts
    SET first_name = ?,
        last_name  = ?,
        email      = ?,
        phone      = ?,
        birthday   = ?,
        notes      = ?,
        tags       = ?,
        updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    data.first_name ?? existing.first_name,
    data.last_name  ?? existing.last_name,
    data.email      ?? existing.email,
    data.phone      ?? existing.phone,
    data.birthday   !== undefined ? data.birthday : existing.birthday,
    data.notes      ?? existing.notes,
    data.tags       ?? existing.tags,
    id,
    userId,
  )
  return getContact(db, userId, id)
}

export function archiveContact(db: Database, userId: number, id: number): void {
  db.prepare(`
    UPDATE contacts_contacts SET active = 0, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(id, userId)
}
