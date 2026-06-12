import type { NotificationHooks, NotificationItem, ModuleContext } from '@mosaic/sdk'
import { getUpcomingBirthdays } from '../services/birthdays.service.js'

export const notificationHooks: NotificationHooks = {
  dueSoon(ctx: ModuleContext, userId: number, date: string): NotificationItem[] {
    return getUpcomingBirthdays(ctx.db.raw, userId, 7, date).map(hit => ({
      id:       `contact-birthday:${hit.id}`,
      title:    `${hit.first_name} ${hit.last_name}`.trim() + "'s birthday",
      body:     hit.daysUntil === 0 ? 'Today!' : `in ${hit.daysUntil} day${hit.daysUntil === 1 ? '' : 's'}`,
      dueDate:  hit.nextBirthday,
      priority: 'high' as const,
      url:      `/contacts/${hit.id}`,
    }))
  },
}
