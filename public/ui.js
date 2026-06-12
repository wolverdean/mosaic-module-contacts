;(function () {
  'use strict'

  // ─── State ─────────────────────────────────────────────────────────────────

  let shell
  let container
  let contacts = []
  let search   = ''
  let showArchived = false
  let editingId = null

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function fmtBirthday(bd) {
    if (!bd) return ''
    const [, mm, dd] = bd.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`
  }

  function daysUntilBirthday(bd) {
    if (!bd) return null
    const today = new Date()
    const year  = today.getFullYear()
    const [, mm, dd] = bd.split('-')
    let next = new Date(`${year}-${mm}-${dd}`)
    if (next < today) next = new Date(`${year + 1}-${mm}-${dd}`)
    const diff = Math.round((next - today) / 86400000)
    if (diff === 0) return 'Today!'
    if (diff === 1) return 'Tomorrow'
    if (diff <= 7)  return `in ${diff} days`
    return null
  }

  function tagsHtml(tags) {
    if (!tags) return ''
    return tags.split(',').filter(Boolean).map(t =>
      `<span style="
        display:inline-block;padding:2px 8px;border-radius:12px;
        background:#e0e7ff;color:#4338ca;font-size:11px;margin:2px 2px 0 0;
      ">${t.trim()}</span>`
    ).join('')
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  function render() {
    const upcoming = contacts.filter(c => daysUntilBirthday(c.birthday) !== null)
    container.innerHTML = `
      <style>
        .contacts-wrap { max-width:760px; margin:0 auto; padding:16px; font-family:system-ui,sans-serif; }
        .contacts-toolbar { display:flex; gap:10px; margin-bottom:16px; align-items:center; flex-wrap:wrap; }
        .contacts-search { flex:1; min-width:180px; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; }
        .contacts-btn { padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-size:14px; font-weight:500; }
        .btn-primary { background:#6366f1; color:#fff; }
        .btn-primary:hover { background:#4f46e5; }
        .btn-sm { padding:4px 10px; font-size:12px; border-radius:6px; border:none; cursor:pointer; }
        .btn-archive { background:#fee2e2; color:#b91c1c; }
        .btn-edit { background:#e0e7ff; color:#3730a3; }
        .contacts-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }
        .contact-card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; position:relative; }
        .contact-name { font-weight:600; font-size:16px; color:#111827; margin-bottom:4px; }
        .contact-meta { font-size:13px; color:#6b7280; line-height:1.6; }
        .contact-birthday { color:#7c3aed; font-weight:500; }
        .contact-actions { display:flex; gap:6px; margin-top:10px; }
        .badge-soon { display:inline-block; background:#fef3c7; color:#92400e; font-size:11px; padding:2px 8px; border-radius:10px; margin-left:6px; }
        .empty-state { text-align:center; color:#9ca3af; padding:48px 0; font-size:15px; }
        .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:100; display:flex; align-items:center; justify-content:center; }
        .modal { background:#fff; border-radius:16px; padding:24px; width:100%; max-width:480px; max-height:90vh; overflow-y:auto; }
        .modal h3 { margin:0 0 16px; font-size:18px; }
        .form-row { margin-bottom:12px; }
        .form-row label { display:block; font-size:13px; font-weight:500; color:#374151; margin-bottom:4px; }
        .form-row input, .form-row textarea { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; }
        .form-row textarea { resize:vertical; min-height:72px; }
        .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
        .archived-card { opacity:.6; }
        .toggle-archived { font-size:13px; color:#6366f1; cursor:pointer; background:none; border:none; padding:0; }
      </style>
      <div class="contacts-wrap">
        <div class="contacts-toolbar">
          <input class="contacts-search" type="text" placeholder="Search name, email, phone…" value="${search.replace(/"/g, '&quot;')}" id="contacts-search-input" />
          <button class="contacts-btn btn-primary" id="contacts-add-btn">+ Add contact</button>
          <button class="toggle-archived" id="contacts-toggle-archived">
            ${showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        </div>

        ${upcoming.length ? `
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
            <div style="font-weight:600;font-size:13px;color:#5b21b6;margin-bottom:8px;">🎂 Upcoming birthdays</div>
            ${upcoming.map(c => `
              <div style="font-size:13px;color:#374151;margin-bottom:4px;">
                ${c.first_name} ${c.last_name} — ${fmtBirthday(c.birthday)}
                <span class="badge-soon">${daysUntilBirthday(c.birthday)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${contacts.length === 0
          ? `<div class="empty-state">No contacts yet. Add one!</div>`
          : `<div class="contacts-grid">
              ${contacts.map(c => `
                <div class="contact-card ${c.active === 0 ? 'archived-card' : ''}">
                  ${c.active === 0 ? '<div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">ARCHIVED</div>' : ''}
                  <div class="contact-name">
                    ${c.first_name} ${c.last_name}
                  </div>
                  <div class="contact-meta">
                    ${c.email ? `<div>✉ ${c.email}</div>` : ''}
                    ${c.phone ? `<div>📞 ${c.phone}</div>` : ''}
                    ${c.birthday ? `<div class="contact-birthday">🎂 ${fmtBirthday(c.birthday)}${daysUntilBirthday(c.birthday) ? ` <span class="badge-soon">${daysUntilBirthday(c.birthday)}</span>` : ''}</div>` : ''}
                    ${c.notes ? `<div style="margin-top:4px;color:#9ca3af;font-size:12px;">${c.notes}</div>` : ''}
                  </div>
                  ${c.tags ? `<div style="margin-top:8px;">${tagsHtml(c.tags)}</div>` : ''}
                  <div class="contact-actions">
                    <button class="contacts-btn btn-sm btn-edit" data-edit="${c.id}">Edit</button>
                    ${c.active === 1 ? `<button class="contacts-btn btn-sm btn-archive" data-archive="${c.id}">Archive</button>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>`
        }
      </div>

      ${editingId !== null ? renderModal() : ''}
    `

    attachHandlers()
  }

  function renderModal() {
    const c = editingId === 'new' ? {} : (contacts.find(x => x.id === editingId) || {})
    return `
      <div class="modal-backdrop" id="contacts-modal-backdrop">
        <div class="modal">
          <h3>${editingId === 'new' ? 'New contact' : 'Edit contact'}</h3>
          <div class="form-row">
            <label>First name *</label>
            <input id="cf-first_name" value="${(c.first_name||'').replace(/"/g,'&quot;')}" placeholder="First name" />
          </div>
          <div class="form-row">
            <label>Last name</label>
            <input id="cf-last_name" value="${(c.last_name||'').replace(/"/g,'&quot;')}" placeholder="Last name" />
          </div>
          <div class="form-row">
            <label>Email</label>
            <input id="cf-email" type="email" value="${(c.email||'').replace(/"/g,'&quot;')}" placeholder="Email" />
          </div>
          <div class="form-row">
            <label>Phone</label>
            <input id="cf-phone" value="${(c.phone||'').replace(/"/g,'&quot;')}" placeholder="Phone" />
          </div>
          <div class="form-row">
            <label>Birthday</label>
            <input id="cf-birthday" type="date" value="${c.birthday||''}" />
          </div>
          <div class="form-row">
            <label>Tags <span style="font-weight:400;color:#9ca3af">(comma-separated)</span></label>
            <input id="cf-tags" value="${(c.tags||'').replace(/"/g,'&quot;')}" placeholder="friend, work, london" />
          </div>
          <div class="form-row">
            <label>Notes</label>
            <textarea id="cf-notes">${c.notes||''}</textarea>
          </div>
          <div class="form-actions">
            <button class="contacts-btn" id="contacts-modal-cancel" style="background:#f3f4f6;color:#374151;">Cancel</button>
            <button class="contacts-btn btn-primary" id="contacts-modal-save">Save</button>
          </div>
        </div>
      </div>
    `
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function attachHandlers() {
    const searchInput = document.getElementById('contacts-search-input')
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        search = e.target.value
        loadContacts()
      })
    }

    const addBtn = document.getElementById('contacts-add-btn')
    if (addBtn) addBtn.addEventListener('click', () => { editingId = 'new'; render() })

    const toggleBtn = document.getElementById('contacts-toggle-archived')
    if (toggleBtn) toggleBtn.addEventListener('click', () => { showArchived = !showArchived; loadContacts() })

    document.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => { editingId = parseInt(btn.dataset.edit, 10); render() })
    })

    document.querySelectorAll('[data-archive]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await shell.api.delete(`/contacts/${btn.dataset.archive}`)
        loadContacts()
      })
    })

    const cancelBtn = document.getElementById('contacts-modal-cancel')
    if (cancelBtn) cancelBtn.addEventListener('click', () => { editingId = null; render() })

    const backdrop = document.getElementById('contacts-modal-backdrop')
    if (backdrop) backdrop.addEventListener('click', e => { if (e.target === backdrop) { editingId = null; render() } })

    const saveBtn = document.getElementById('contacts-modal-save')
    if (saveBtn) saveBtn.addEventListener('click', saveContact)
  }

  async function saveContact() {
    const body = {
      first_name: document.getElementById('cf-first_name').value.trim(),
      last_name:  document.getElementById('cf-last_name').value.trim(),
      email:      document.getElementById('cf-email').value.trim(),
      phone:      document.getElementById('cf-phone').value.trim(),
      birthday:   document.getElementById('cf-birthday').value || null,
      tags:       document.getElementById('cf-tags').value.trim(),
      notes:      document.getElementById('cf-notes').value.trim(),
    }
    if (!body.first_name) { alert('First name is required.'); return }

    if (editingId === 'new') {
      await shell.api.post('/contacts', body)
    } else {
      await shell.api.put(`/contacts/${editingId}`, body)
    }
    editingId = null
    loadContacts()
  }

  // ─── Data ──────────────────────────────────────────────────────────────────

  async function loadContacts() {
    const qs = new URLSearchParams()
    if (search)       qs.set('search', search)
    if (showArchived) qs.set('include_archived', '1')
    contacts = await shell.api.get(`/contacts?${qs}`)
    render()
  }

  // ─── Module registration ───────────────────────────────────────────────────

  window.Mosaic.registerModule({
    slug: 'contacts',

    init(s) {
      shell = s
    },

    onActivate(el) {
      container = el
      loadContacts()
    },

    onDeactivate() {
      contacts  = []
      search    = ''
      editingId = null
    },
  })
})()
