import type { Database } from 'better-sqlite3'
import type { Contact } from './contacts.service.js'

export interface BirthdayHit extends Contact {
  nextBirthday: string   // YYYY-MM-DD — next occurrence
  daysUntil:    number
}

export function getUpcomingBirthdays(
  db: Database,
  userId: number,
  days: number,
  fromDate: string,
): BirthdayHit[] {
  const contacts = db.prepare(`
    SELECT * FROM contacts_contacts
    WHERE user_id = ? AND active = 1 AND birthday IS NOT NULL AND birthday != ''
  `).all(userId) as Contact[]

  const from      = new Date(`${fromDate}T00:00:00Z`)
  const to        = new Date(from)
  to.setUTCDate(to.getUTCDate() + days)
  const thisYear  = Number(fromDate.slice(0, 4))
  const results: BirthdayHit[] = []

  for (const c of contacts) {
    const mmdd = (c.birthday as string).slice(5) // "MM-DD"
    for (const year of [thisYear, thisYear + 1]) {
      const candidate = new Date(`${year}-${mmdd}T00:00:00Z`)
      if (candidate >= from && candidate < to) {
        const daysUntil = Math.floor((candidate.getTime() - from.getTime()) / 86400000)
        results.push({ ...c, nextBirthday: `${year}-${mmdd}`, daysUntil })
        break
      }
    }
  }

  return results.sort((a, b) => a.nextBirthday.localeCompare(b.nextBirthday))
}

export function getBirthdaysForMonth(
  db: Database,
  userId: number,
  _year: number,
  month: number,
): Contact[] {
  const mm = String(month).padStart(2, '0')
  return db.prepare(`
    SELECT * FROM contacts_contacts
    WHERE user_id = ? AND active = 1
      AND birthday IS NOT NULL AND birthday != ''
      AND substr(birthday, 6, 2) = ?
    ORDER BY substr(birthday, 9, 2) ASC
  `).all(userId, mm) as Contact[]
}

export function getBirthdaysForWeek(
  db: Database,
  userId: number,
  fromDate: string,
): BirthdayHit[] {
  return getUpcomingBirthdays(db, userId, 7, fromDate)
}
