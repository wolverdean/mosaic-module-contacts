import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/migrate.js'
import { createRouter } from '../../src/routes/index.js'
import type { ModuleContext } from '@mosaic/sdk'

function makeApp() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
  db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()

  const modDb = {
    prepare: db.prepare.bind(db),
    exec:    (sql: string) => db.exec(sql),
    transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() },
    raw: db,
  }
  migrate(modDb as any)

  const ctxRef: { current: ModuleContext | null } = {
    current: {
      db: modDb,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    } as any,
  }

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { (req as any).userId = 1; next() })
  app.use('/api/contacts', createRouter(ctxRef))
  return app
}

let app: ReturnType<typeof makeApp>
beforeEach(() => { app = makeApp() })

// AC1 — create with full fields
describe('AC1 — create contact', () => {
  it('creates with first_name only', async () => {
    const res = await request(app).post('/api/contacts/contacts').send({ first_name: 'Jane' })
    expect(res.status).toBe(201)
    expect(res.body.first_name).toBe('Jane')
    expect(res.body.active).toBe(1)
  })

  it('creates with all fields', async () => {
    const res = await request(app).post('/api/contacts/contacts').send({
      first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com',
      phone: '+1 555 0100', birthday: '1990-06-15', notes: 'Met at PyCon', tags: 'friend,tech',
    })
    expect(res.status).toBe(201)
    expect(res.body.birthday).toBe('1990-06-15')
    expect(res.body.tags).toBe('friend,tech')
  })

  it('rejects missing first_name', async () => {
    const res = await request(app).post('/api/contacts/contacts').send({ last_name: 'Doe' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/first_name/)
  })
})

// AC2 — list sorted, archives hidden by default
describe('AC2 — list contacts', () => {
  it('returns contacts sorted alphabetically', async () => {
    await request(app).post('/api/contacts/contacts').send({ first_name: 'Zara', last_name: 'Adams' })
    await request(app).post('/api/contacts/contacts').send({ first_name: 'Alice', last_name: 'Adams' })
    const res = await request(app).get('/api/contacts/contacts')
    expect(res.status).toBe(200)
    expect(res.body[0].first_name).toBe('Alice')
    expect(res.body[1].first_name).toBe('Zara')
  })

  it('hides archived by default', async () => {
    const created = await request(app).post('/api/contacts/contacts').send({ first_name: 'Gone' })
    await request(app).delete(`/api/contacts/contacts/${created.body.id}`)
    const res = await request(app).get('/api/contacts/contacts')
    expect(res.body).toHaveLength(0)
  })

  it('shows archived when include_archived=1', async () => {
    const created = await request(app).post('/api/contacts/contacts').send({ first_name: 'Gone' })
    await request(app).delete(`/api/contacts/contacts/${created.body.id}`)
    const res = await request(app).get('/api/contacts/contacts?include_archived=1')
    expect(res.body).toHaveLength(1)
  })
})

// AC3 — search
describe('AC3 — search', () => {
  beforeEach(async () => {
    await request(app).post('/api/contacts/contacts').send({ first_name: 'Jane', last_name: 'Doe', email: 'jane@test.com', phone: '555-0100' })
    await request(app).post('/api/contacts/contacts').send({ first_name: 'Bob', last_name: 'Smith', email: 'bob@other.com', phone: '555-9999' })
  })

  it('searches by first name', async () => {
    const res = await request(app).get('/api/contacts/contacts?search=jane')
    expect(res.body).toHaveLength(1)
    expect(res.body[0].first_name).toBe('Jane')
  })

  it('searches by email', async () => {
    const res = await request(app).get('/api/contacts/contacts?search=jane%40test')
    expect(res.body).toHaveLength(1)
  })

  it('searches by phone', async () => {
    const res = await request(app).get('/api/contacts/contacts?search=0100')
    expect(res.body).toHaveLength(1)
  })
})

// AC4 — update
describe('AC4 — update contact', () => {
  it('updates fields', async () => {
    const created = await request(app).post('/api/contacts/contacts').send({ first_name: 'Jane' })
    const res = await request(app).put(`/api/contacts/contacts/${created.body.id}`).send({ last_name: 'Doe' })
    expect(res.status).toBe(200)
    expect(res.body.last_name).toBe('Doe')
    expect(res.body.first_name).toBe('Jane')
  })

  it('returns 404 for missing contact', async () => {
    const res = await request(app).put('/api/contacts/contacts/9999').send({ last_name: 'Doe' })
    expect(res.status).toBe(404)
  })
})

// AC5 — archive (soft delete)
describe('AC5 — archive contact', () => {
  it('archives contact (sets active=0)', async () => {
    const created = await request(app).post('/api/contacts/contacts').send({ first_name: 'Jane' })
    const del = await request(app).delete(`/api/contacts/contacts/${created.body.id}`)
    expect(del.status).toBe(200)
    expect(del.body.ok).toBe(true)
    const list = await request(app).get('/api/contacts/contacts')
    expect(list.body).toHaveLength(0)
  })

  it('returns 404 for missing contact', async () => {
    const res = await request(app).delete('/api/contacts/contacts/9999')
    expect(res.status).toBe(404)
  })
})

// AC6 — calendar items
describe('AC6 — calendar items (birthday entries)', () => {
  it('returns birthday contacts for month', async () => {
    await request(app).post('/api/contacts/contacts').send({ first_name: 'June', birthday: '1990-06-20' })
    await request(app).post('/api/contacts/contacts').send({ first_name: 'July', birthday: '1990-07-01' })
    const res = await request(app).get('/api/contacts/calendar?year=2026&month=6')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].first_name).toBe('June')
  })
})

// AC7 — notification hook (dueSoon)
describe('AC7 — dueSoon notification hook', () => {
  it('notification hooks export dueSoon', async () => {
    const { notificationHooks } = await import('../../src/hooks/notifications.js')
    expect(notificationHooks.dueSoon).toBeTypeOf('function')
  })

  it('dueSoon returns high priority birthday hits', async () => {
    const { notificationHooks } = await import('../../src/hooks/notifications.js')
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
    db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()
    const modDb = { prepare: db.prepare.bind(db), exec: (s: string) => db.exec(s), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db }
    migrate(modDb as any)
    db.prepare(`INSERT INTO contacts_contacts (user_id, first_name, last_name, birthday, tags, notes) VALUES (1,'Jane','Doe','1990-06-13','','')`).run()

    const ctx = { db: modDb } as any
    const items = notificationHooks.dueSoon!(ctx, 1, '2026-06-12')
    expect(items).toHaveLength(1)
    expect(items[0].priority).toBe('high')
    expect(items[0].id).toMatch(/^contact-birthday:/)
  })
})

// AC8 — report summary hook
describe('AC8 — summary report hook', () => {
  it('returns contact counts', async () => {
    const { reportHooks } = await import('../../src/hooks/reports.js')
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
    db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()
    const modDb = { prepare: db.prepare.bind(db), exec: (s: string) => db.exec(s), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db }
    migrate(modDb as any)
    db.prepare(`INSERT INTO contacts_contacts (user_id, first_name, tags, notes) VALUES (1,'Jane','','')`).run()
    db.prepare(`INSERT INTO contacts_contacts (user_id, first_name, tags, notes) VALUES (1,'Bob','','')`).run()

    const ctx = { db: modDb } as any
    const summary = reportHooks.summary!(ctx, 1)
    expect(summary['Total contacts']).toBe(2)
    expect(summary['Birthdays this month']).toBeTypeOf('number')
    expect(summary['Birthdays this week']).toBeTypeOf('number')
  })
})

// AC9 — frontend endpoint exists
describe('AC9 — frontend endpoint', () => {
  it('GET /ui.js returns JS content type', async () => {
    const res = await request(app).get('/api/contacts/ui.js')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/javascript/)
  })
})

// AC10 — tags as plain text
describe('AC10 — tags as comma-separated text', () => {
  it('stores and returns tags string', async () => {
    const res = await request(app).post('/api/contacts/contacts').send({ first_name: 'Jane', tags: 'friend,tech,london' })
    expect(res.body.tags).toBe('friend,tech,london')
  })
})
