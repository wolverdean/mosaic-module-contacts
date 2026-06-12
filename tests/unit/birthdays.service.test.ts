import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/migrate.js'
import { createContact } from '../../src/services/contacts.service.js'
import {
  getUpcomingBirthdays, getBirthdaysForMonth, getBirthdaysForWeek,
} from '../../src/services/birthdays.service.js'

function makeDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
  db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()
  migrate({ exec: (sql: string) => db.exec(sql), prepare: db.prepare.bind(db), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db } as any)
  return db
}

let db: ReturnType<typeof makeDb>
beforeEach(() => { db = makeDb() })

describe('getUpcomingBirthdays', () => {
  it('returns empty when no contacts have birthdays', () => {
    createContact(db, 1, { first_name: 'Jane' })
    expect(getUpcomingBirthdays(db, 1, 7, '2026-06-12')).toHaveLength(0)
  })

  it('includes contact with birthday exactly today (daysUntil=0)', () => {
    createContact(db, 1, { first_name: 'Jane', birthday: '1990-06-12' })
    const hits = getUpcomingBirthdays(db, 1, 7, '2026-06-12')
    expect(hits).toHaveLength(1)
    expect(hits[0].daysUntil).toBe(0)
    expect(hits[0].nextBirthday).toBe('2026-06-12')
  })

  it('includes contact with birthday in N days', () => {
    createContact(db, 1, { first_name: 'Bob', birthday: '1985-06-15' })
    const hits = getUpcomingBirthdays(db, 1, 7, '2026-06-12')
    expect(hits).toHaveLength(1)
    expect(hits[0].daysUntil).toBe(3)
  })

  it('excludes contact with birthday outside window', () => {
    createContact(db, 1, { first_name: 'Far', birthday: '1980-07-01' })
    expect(getUpcomingBirthdays(db, 1, 7, '2026-06-12')).toHaveLength(0)
  })

  it('handles year-wrap: birthday in January when fromDate is December', () => {
    createContact(db, 1, { first_name: 'New', birthday: '2000-01-02' })
    const hits = getUpcomingBirthdays(db, 1, 7, '2026-12-28')
    expect(hits).toHaveLength(1)
    expect(hits[0].nextBirthday).toBe('2027-01-02')
    expect(hits[0].daysUntil).toBe(5)
  })

  it('excludes contacts without birthday', () => {
    createContact(db, 1, { first_name: 'No Birthday' })
    expect(getUpcomingBirthdays(db, 1, 7, '2026-06-12')).toHaveLength(0)
  })

  it('excludes archived contacts', () => {
    const c = createContact(db, 1, { first_name: 'Jane', birthday: '1990-06-13' })
    db.prepare(`UPDATE contacts_contacts SET active=0 WHERE id=?`).run(c.id)
    expect(getUpcomingBirthdays(db, 1, 7, '2026-06-12')).toHaveLength(0)
  })

  it('sorts results by nextBirthday ascending', () => {
    createContact(db, 1, { first_name: 'Late', birthday: '1990-06-15' })
    createContact(db, 1, { first_name: 'Early', birthday: '1995-06-13' })
    const hits = getUpcomingBirthdays(db, 1, 7, '2026-06-12')
    expect(hits[0].first_name).toBe('Early')
    expect(hits[1].first_name).toBe('Late')
  })
})

describe('getBirthdaysForMonth', () => {
  it('returns contacts with birthday in the given month', () => {
    createContact(db, 1, { first_name: 'June', birthday: '1990-06-20' })
    createContact(db, 1, { first_name: 'July', birthday: '1990-07-01' })
    const result = getBirthdaysForMonth(db, 1, 2026, 6)
    expect(result).toHaveLength(1)
    expect(result[0].first_name).toBe('June')
  })

  it('returns empty when no birthdays in month', () => {
    createContact(db, 1, { first_name: 'Jane', birthday: '1990-07-01' })
    expect(getBirthdaysForMonth(db, 1, 2026, 6)).toHaveLength(0)
  })
})

describe('getBirthdaysForWeek', () => {
  it('returns contacts with birthday within next 7 days', () => {
    createContact(db, 1, { first_name: 'Soon', birthday: '1990-06-14' })
    createContact(db, 1, { first_name: 'Far', birthday: '1990-07-01' })
    const result = getBirthdaysForWeek(db, 1, '2026-06-12')
    expect(result).toHaveLength(1)
    expect(result[0].first_name).toBe('Soon')
  })
})
