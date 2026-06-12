import { Router }                         from 'express'
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api'
import type { ModuleContext }              from '@mosaic/sdk'
import fs                                 from 'node:fs'
import path                               from 'node:path'
import {
  listContacts, getContact, createContact, updateContact, archiveContact,
} from '../services/contacts.service.js'
import { getBirthdaysForMonth, getBirthdaysForWeek } from '../services/birthdays.service.js'

// ─── OTel ─────────────────────────────────────────────────────────────────────

const tracer         = trace.getTracer('contacts')
const meter          = metrics.getMeter('contacts')
const reqCounter     = meter.createCounter('contacts.requests_total',    { description: 'Contacts route requests' })
const reqDuration    = meter.createHistogram('contacts.request_duration_ms', { unit: 'ms' })
const contactCounter = meter.createCounter('contacts.contacts_total',    { description: 'Contacts created' })

function track(op: string, fn: () => void): void {
  const t0 = Date.now()
  tracer.startActiveSpan(`contacts.${op}`, span => {
    try {
      fn()
      reqCounter.add(1, { op, status: 'ok' })
      span.setStatus({ code: SpanStatusCode.OK })
    } catch (err) {
      reqCounter.add(1, { op, status: 'error' })
      span.setStatus({ code: SpanStatusCode.ERROR })
      span.recordException(err as Error)
      throw err
    } finally {
      reqDuration.record(Date.now() - t0, { op })
      span.end()
    }
  })
}

// ─── Router factory ───────────────────────────────────────────────────────────

export function createRouter(ctxRef: { current: ModuleContext | null }): Router {
  const router = Router()
  const db = () => ctxRef.current!.db.raw

  // ── Contacts CRUD ──────────────────────────────────────────────────────────

  router.get('/contacts', (req, res) => {
    track('contacts.list', () => {
      const search          = req.query.search          as string | undefined
      const includeArchived = req.query.include_archived === '1'
      res.json(listContacts(db(), req.userId, { search, includeArchived }))
    })
  })

  router.post('/contacts', (req, res) => {
    track('contacts.create', () => {
      const { first_name, last_name, email, phone, birthday, notes, tags } = req.body
      if (!first_name || !String(first_name).trim()) {
        res.status(400).json({ error: 'first_name is required' }); return
      }
      try {
        const contact = createContact(db(), req.userId, { first_name, last_name, email, phone, birthday, notes, tags })
        contactCounter.add(1)
        ctxRef.current?.logger.info('contact created', { userId: req.userId, contactId: contact.id })
        res.status(201).json(contact)
      } catch (err: any) {
        res.status(400).json({ error: err.message })
      }
    })
  })

  router.get('/contacts/:id', (req, res) => {
    track('contacts.get', () => {
      const contact = getContact(db(), req.userId, Number(req.params.id))
      if (!contact) { res.status(404).json({ error: 'Not found' }); return }
      res.json(contact)
    })
  })

  router.put('/contacts/:id', (req, res) => {
    track('contacts.update', () => {
      const { first_name, last_name, email, phone, birthday, notes, tags } = req.body
      const updated = updateContact(db(), req.userId, Number(req.params.id), {
        first_name, last_name, email, phone, birthday, notes, tags,
      })
      if (!updated) { res.status(404).json({ error: 'Not found' }); return }
      res.json(updated)
    })
  })

  router.delete('/contacts/:id', (req, res) => {
    track('contacts.archive', () => {
      const contact = getContact(db(), req.userId, Number(req.params.id))
      if (!contact) { res.status(404).json({ error: 'Not found' }); return }
      archiveContact(db(), req.userId, Number(req.params.id))
      res.json({ ok: true })
    })
  })

  // ── Calendar ───────────────────────────────────────────────────────────────

  router.get('/calendar', (req, res) => {
    track('calendar', () => {
      const year  = parseInt(req.query.year  as string, 10) || new Date().getFullYear()
      const month = parseInt(req.query.month as string, 10) || (new Date().getMonth() + 1)
      res.json(getBirthdaysForMonth(db(), req.userId, year, month))
    })
  })

  // ── Reports ────────────────────────────────────────────────────────────────

  router.get('/reports/summary', (req, res) => {
    track('reports.summary', () => {
      const today = new Date().toISOString().slice(0, 10)
      const year  = new Date().getFullYear()
      const monthNum = new Date().getMonth() + 1
      const total = (db().prepare(`
        SELECT COUNT(*) AS n FROM contacts_contacts WHERE user_id = ? AND active = 1
      `).get(req.userId) as { n: number }).n
      const monthBirthdays = getBirthdaysForMonth(db(), req.userId, year, monthNum).length
      const weekBirthdays  = getBirthdaysForWeek(db(), req.userId, today).length
      res.json({
        'Total contacts':       total,
        'Birthdays this month': monthBirthdays,
        'Birthdays this week':  weekBirthdays,
      })
    })
  })

  // ── Frontend ───────────────────────────────────────────────────────────────

  router.get('/ui.js', (_req, res) => {
    const uiPath = path.resolve(__dirname, '../../public/ui.js')
    res.setHeader('Content-Type', 'application/javascript')
    res.setHeader('Cache-Control', 'no-cache')
    if (fs.existsSync(uiPath)) {
      res.sendFile(uiPath)
    } else {
      res.send('// contacts ui not yet built')
    }
  })

  return router
}
