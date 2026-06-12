import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/migrate.js'
import {
  listContacts, getContact, createContact, updateContact, archiveContact,
} from '../../src/services/contacts.service.js'

function makeDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
  db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()
  db.prepare(`INSERT INTO users VALUES (2,'b@b.com')`).run()
  migrate({ exec: (sql: string) => db.exec(sql), prepare: db.prepare.bind(db), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db } as any)
  return db
}

let db: ReturnType<typeof makeDb>
beforeEach(() => { db = makeDb() })

describe('createContact', () => {
  it('creates with first_name only', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    expect(c.id).toBeTypeOf('number')
    expect(c.first_name).toBe('Jane')
    expect(c.last_name).toBe('')
    expect(c.active).toBe(1)
  })

  it('stores all fields', () => {
    const c = createContact(db, 1, {
      first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com',
      phone: '+1 555 0100', birthday: '1990-06-15', notes: 'Met at PyCon', tags: 'friend,tech',
    })
    expect(c.last_name).toBe('Doe')
    expect(c.email).toBe('jane@x.com')
    expect(c.birthday).toBe('1990-06-15')
    expect(c.tags).toBe('friend,tech')
  })

  it('throws if first_name is empty', () => {
    expect(() => createContact(db, 1, { first_name: '' })).toThrow('first_name is required')
    expect(() => createContact(db, 1, { first_name: '   ' })).toThrow('first_name is required')
  })
})

describe('listContacts', () => {
  it('returns empty array when no contacts', () => {
    expect(listContacts(db, 1, {})).toEqual([])
  })

  it('excludes archived by default', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    archiveContact(db, 1, c.id)
    expect(listContacts(db, 1, {})).toHaveLength(0)
  })

  it('includes archived when asked', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    archiveContact(db, 1, c.id)
    expect(listContacts(db, 1, { includeArchived: true })).toHaveLength(1)
  })

  it('sorts by last_name then first_name', () => {
    createContact(db, 1, { first_name: 'Zara', last_name: 'Adams' })
    createContact(db, 1, { first_name: 'Alice', last_name: 'Adams' })
    createContact(db, 1, { first_name: 'Bob', last_name: 'Brown' })
    const list = listContacts(db, 1, {})
    expect(list[0].first_name).toBe('Alice')
    expect(list[1].first_name).toBe('Zara')
    expect(list[2].first_name).toBe('Bob')
  })

  it('searches by first_name', () => {
    createContact(db, 1, { first_name: 'Jane', last_name: 'Doe' })
    createContact(db, 1, { first_name: 'Bob', last_name: 'Smith' })
    expect(listContacts(db, 1, { search: 'jane' })).toHaveLength(1)
  })

  it('searches by email', () => {
    createContact(db, 1, { first_name: 'Jane', email: 'jane@test.com' })
    createContact(db, 1, { first_name: 'Bob', email: 'bob@other.com' })
    expect(listContacts(db, 1, { search: 'jane@test' })).toHaveLength(1)
  })

  it('searches by phone', () => {
    createContact(db, 1, { first_name: 'Jane', phone: '+1 555 0100' })
    createContact(db, 1, { first_name: 'Bob', phone: '+1 555 9999' })
    expect(listContacts(db, 1, { search: '0100' })).toHaveLength(1)
  })

  it('isolates contacts by user_id', () => {
    createContact(db, 1, { first_name: 'Jane' })
    createContact(db, 2, { first_name: 'Bob' })
    expect(listContacts(db, 1, {})).toHaveLength(1)
    expect(listContacts(db, 2, {})).toHaveLength(1)
  })
})

describe('getContact', () => {
  it('returns contact for correct user', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    expect(getContact(db, 1, c.id)).not.toBeNull()
  })

  it('returns null for wrong user', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    expect(getContact(db, 2, c.id)).toBeNull()
  })

  it('returns null for missing id', () => {
    expect(getContact(db, 1, 9999)).toBeNull()
  })
})

describe('updateContact', () => {
  it('updates fields and sets updated_at', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    const updated = updateContact(db, 1, c.id, { last_name: 'Doe', email: 'jane@x.com' })
    expect(updated?.last_name).toBe('Doe')
    expect(updated?.email).toBe('jane@x.com')
    expect(updated?.first_name).toBe('Jane')
  })

  it('returns null for missing contact', () => {
    expect(updateContact(db, 1, 9999, { last_name: 'Doe' })).toBeNull()
  })

  it('returns null for wrong user', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    expect(updateContact(db, 2, c.id, { last_name: 'Doe' })).toBeNull()
  })
})

describe('archiveContact', () => {
  it('sets active=0', () => {
    const c = createContact(db, 1, { first_name: 'Jane' })
    archiveContact(db, 1, c.id)
    const found = getContact(db, 1, c.id)
    expect(found?.active).toBe(0)
  })
})
