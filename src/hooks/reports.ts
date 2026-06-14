import type { ReportHooks, ReportSummary, ModuleContext } from '@mosaic/sdk'
import { getBirthdaysForMonth, getBirthdaysForWeek, getUpcomingBirthdays } from '../services/birthdays.service.js'

export const reportHooks: ReportHooks = {
  summary(ctx: ModuleContext, userId: number): ReportSummary {
    const db    = ctx.db.raw
    const today = new Date().toISOString().slice(0, 10)
    const year  = new Date().getFullYear()
    const month = new Date().getMonth() + 1

    const total = (db.prepare(`
      SELECT COUNT(*) AS n FROM contacts_contacts WHERE user_id = ? AND active = 1
    `).get(userId) as { n: number }).n

    const monthBirthdays = getBirthdaysForMonth(db, userId, year, month).length
    const weekBirthdays  = getBirthdaysForWeek(db, userId, today).length

    return {
      'Total contacts':        total,
      'Birthdays this month':  monthBirthdays,
      'Birthdays this week':   weekBirthdays,
    }
  },

  detailed(ctx: ModuleContext, userId: number, start: string, end: string) {
    const db = ctx.db.raw

    const total = (db.prepare(
      'SELECT COUNT(*) AS n FROM contacts_contacts WHERE user_id = ? AND active = 1'
    ).get(userId) as { n: number }).n

    const startDate  = new Date(`${start}T00:00:00Z`)
    const days       = Math.ceil((new Date(`${end}T00:00:00Z`).getTime() - startDate.getTime()) / 86400000) + 1
    const birthdays  = getUpcomingBirthdays(db, userId, days, start)

    return {
      label: 'Contacts',
      sections: [
        {
          type:  'kv',
          title: 'Summary',
          rows:  { 'Total contacts': total, 'Birthdays in period': birthdays.length },
        },
        {
          type:  'list',
          title: 'Birthdays',
          items: birthdays.map(c => ({
            id:      c.id,
            title:   `${c.first_name} ${c.last_name}`.trim(),
            dueDate: c.nextBirthday,
            url:     '/contacts',
          })),
        },
      ],
    }
  },
}
