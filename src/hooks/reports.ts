import type { ReportHooks, ReportSummary, ModuleContext } from '@mosaic/sdk'
import { getBirthdaysForMonth, getBirthdaysForWeek } from '../services/birthdays.service.js'

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
}
