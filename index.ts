import { defineModule }     from '@mosaic/sdk'
import type { ModuleContext } from '@mosaic/sdk'
import { metrics }           from '@opentelemetry/api'
import { migrate }           from './src/migrate.js'
import { createRouter }      from './src/routes/index.js'
import { notificationHooks } from './src/hooks/notifications.js'
import { reportHooks }       from './src/hooks/reports.js'
import { getBirthdaysForMonth, getUpcomingBirthdays } from './src/services/birthdays.service.js'

const meter = metrics.getMeter('contacts')
const _runs = meter.createCounter('contacts.jobs.runs_total')

const ctxRef: { current: ModuleContext | null } = { current: null }
const router = createRouter(ctxRef)

export default defineModule({
  name:    'Contacts',
  slug:    'contacts',
  version: '1.0.0',
  sdk:     '>=1.0.0',

  migrate,
  router,

  nav: {
    label: 'Contacts',
    icon:  'users',
    order: 45,
    badge(ctx: ModuleContext, userId: number) {
      try {
        const today = new Date().toISOString().slice(0, 10)
        return getUpcomingBirthdays(ctx.db.raw, userId, 7, today).length
      } catch { return 0 }
    },
  },

  frontend: { entry: '/api/contacts/ui.js' },

  notifications: notificationHooks,
  reports:       reportHooks,

  calendarItems(ctx: ModuleContext, userId: number, year: number, month: number) {
    return getBirthdaysForMonth(ctx.db.raw, userId, year, month).map(c => ({
      id:    `contact-birthday:${c.id}:${year}-${String(month).padStart(2, '0')}-${(c.birthday as string).slice(8)}`,
      title: `${c.first_name} ${c.last_name}`.trim() + "'s birthday",
      date:  `${year}-${String(month).padStart(2, '0')}-${(c.birthday as string).slice(8)}`,
      type:  'birthday',
      url:   `/contacts/${c.id}`,
    }))
  },

  async onInit(ctx: ModuleContext) {
    ctxRef.current = ctx
    ctx.logger.info('Contacts module initialised')
  },

  async health(ctx: ModuleContext) {
    ctx.db.raw.prepare('SELECT 1 FROM contacts_contacts LIMIT 1').get()
    return { status: 'ok' as const }
  },
  healthInterval: 120,
})
