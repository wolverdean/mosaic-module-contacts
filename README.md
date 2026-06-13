# mosaic-module-contacts

People and relationship management for the Mosaic framework. Store contact details, track birthdays that surface in the Calendar month view, and maintain relationship notes per contact.

---

## Features

| Feature | Detail |
|---|---|
| Contact fields | First name, last name, email, phone, birthday, notes |
| Tags | Free-form labels for grouping contacts |
| Birthday tracking | Upcoming birthdays appear in the Calendar; nav badge shows birthdays in the next 7 days |
| Search | Full name and email search; optionally include archived contacts |
| Archive | Soft-delete that preserves all contact data |
| Notifications | Framework notifies about upcoming birthdays via push, webhook, or Telegram |
| Reports | Contact counts and upcoming birthday summary for the Reports page |

---

## API

Base path: `/api/contacts/`

### Contacts

| Method | Path | Description |
|---|---|---|
| `GET` | `/contacts` | List contacts (`search`, `include_archived` params) |
| `POST` | `/contacts` | Create contact (`first_name`, `last_name`, `email`, `phone`, `birthday`, `notes`, `tags`) |
| `GET` | `/contacts/:id` | Get contact detail with tags |
| `PUT` | `/contacts/:id` | Update contact |
| `DELETE` | `/contacts/:id` | Archive contact |

### Calendar and Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/calendar` | Birthdays for a given month (`year`, `month` params) — used by Calendar module |
| `GET` | `/reports/summary` | Total contacts, birthdays this month, birthdays this week |

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `better-sqlite3` | peer | SQLite driver (provided by framework) |
| `express` | peer | HTTP server (provided by framework) |
| `@opentelemetry/api` | peer | Observability (provided by framework) |

---

## Project structure

```
mosaic-module-contacts/
├── index.ts            # Module manifest — slug, nav badge, calendar hook, report hook, notification hook
├── src/
│   └── routes/
│       └── index.ts    # Contacts router + /ui.js
├── public/
│   └── ui.js           # Frontend IIFE — served via GET /api/contacts/ui.js
└── tests/
    └── unit/           # Vitest unit tests
```
