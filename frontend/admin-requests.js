const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Заявки',
  subtitle: 'Все запросы на открытие аккаунтов.',
  buttons: [],
})

const tableBody = document.getElementById('admin-requests')
const statusEl = document.getElementById('admin-status')
const modalEl = document.getElementById('request-modal')
const modalTitle = document.getElementById('request-title')
const modalBody = document.getElementById('request-body')
const modalClose = document.getElementById('request-close')
const modalActions = document.getElementById('request-actions')
const filterStatus = document.getElementById('filter-status')
const filterPlatform = document.getElementById('filter-platform')
const filterEmail = document.getElementById('filter-email')
const exportRequests = document.getElementById('export-requests')
let allRows = []

function authHeadersSafe() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleAuthFailure(res) {
  if (res.status === 401 || res.status === 403) {
    if (statusEl) statusEl.textContent = 'Нет доступа к админке.'
    return true
  }
  return false
}

async function fetchRequests() {
  try {
    const res = await fetch(`${apiBase}/admin/account-requests`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load requests')
    const data = await res.json()
    allRows = data
    applyFilters()
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Ошибка загрузки заявок.'
  }
}

function applyFilters() {
  let rows = [...allRows]
  const status = filterStatus?.value || ''
  const platform = filterPlatform?.value || ''
  const email = (filterEmail?.value || '').trim().toLowerCase()
  if (status) rows = rows.filter((row) => row.status === status)
  if (platform) rows = rows.filter((row) => row.platform === platform)
  if (email) rows = rows.filter((row) => (row.user_email || '').toLowerCase().includes(email))
  renderRows(rows)
}

function renderRows(rows) {
  if (!tableBody) return
  tableBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.created_at?.split(' ')[0] || '—'}</td>
        <td>${row.user_email || '—'}</td>
        <td>${row.platform}</td>
        <td>${row.name}</td>
        <td>
          <input class="field-input small" data-code="${row.id}" type="text" placeholder="Напр. KZ-2024-01" />
        </td>
        <td>${statusLabel(row.status)}</td>
        <td style="text-align:right; display:flex; gap:6px; justify-content:flex-end;">
          <button class="btn ghost small" data-action="processing" data-id="${row.id}">В работе</button>
          <button class="btn primary small" data-action="approved" data-id="${row.id}">Одобрить</button>
          <button class="btn ghost small" data-action="rejected" data-id="${row.id}">Отклонить</button>
          <button class="btn ghost small" data-action="details" data-id="${row.id}">Карточка</button>
        </td>
      </tr>
    `
    )
    .join('')
}

function statusLabel(status) {
  if (status === 'approved') return 'Открыт'
  if (status === 'processing') return 'В работе'
  if (status === 'rejected') return 'Отклонен'
  return 'Новая'
}

if (tableBody) {
  tableBody.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]')
    if (!btn) return
    const status = btn.dataset.action
    const id = btn.dataset.id
    if (status === 'details') {
      const row = allRows.find((item) => String(item.id) === String(id))
      if (row) openRequestModal(row)
      return
    }
    const codeInput = tableBody.querySelector(`input[data-code="${id}"]`)
    const accountCode = codeInput?.value?.trim() || null
    try {
      const res = await fetch(`${apiBase}/admin/account-requests/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
        body: JSON.stringify({ status, account_code: accountCode }),
      })
      if (handleAuthFailure(res)) return
      if (!res.ok) throw new Error('update failed')
      await fetchRequests()
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Ошибка обновления статуса.'
    }
  })
}

if (modalClose) {
  modalClose.addEventListener('click', () => {
    modalEl?.classList.remove('show')
  })
}

if (modalEl) {
  modalEl.addEventListener('click', (event) => {
    if (event.target === modalEl) {
      modalEl.classList.remove('show')
    }
  })
}

function openRequestModal(row) {
  if (!modalEl || !modalTitle || !modalBody) return
  const payload = normalizePayload(row.payload)
  modalTitle.textContent = `${row.platform} · ${row.name}`
  modalBody.innerHTML = buildDetailsHtml(row, payload)
  if (modalActions) {
    modalActions.innerHTML = `
      <div class="modal-actions-row">
        <input class="field-input small" id="modal-account-code" type="text" placeholder="Код договора/аккаунта" value="" />
        <input class="field-input small" id="modal-manager-email" type="text" placeholder="Менеджер (email)" value="${row.manager_email || ''}" />
        <textarea class="field-input small textarea" id="modal-comment" rows="2" placeholder="Комментарий"></textarea>
        <div class="modal-actions-buttons">
          <button class="btn ghost" data-action="processing" data-id="${row.id}">В работе</button>
          <button class="btn primary" data-action="approved" data-id="${row.id}">Одобрить</button>
          <button class="btn ghost" data-action="rejected" data-id="${row.id}">Отклонить</button>
          <button class="btn ghost" data-action="comment" data-id="${row.id}">Комментарий</button>
        </div>
      </div>
    `
  }
  modalEl.classList.add('show')
  fetchEvents(row.id)
}

if (modalActions) {
  modalActions.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]')
    if (!btn) return
    const status = btn.dataset.action
    const id = btn.dataset.id
    const codeInput = document.getElementById('modal-account-code')
    const accountCode = codeInput?.value?.trim() || null
    const managerInput = document.getElementById('modal-manager-email')
    const managerEmail = managerInput?.value?.trim() || null
    const commentInput = document.getElementById('modal-comment')
    const comment = commentInput?.value?.trim() || null
    if (status === 'comment' && !comment && !managerEmail) {
      if (statusEl) statusEl.textContent = 'Введите комментарий или менеджера.'
      return
    }
    try {
      const url =
        status === 'comment'
          ? `${apiBase}/admin/account-requests/${id}/events`
          : `${apiBase}/admin/account-requests/${id}/status`
      const body =
        status === 'comment'
          ? { type: 'comment', comment, manager_email: managerEmail }
          : { status, account_code: accountCode, manager_email: managerEmail, comment }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
        body: JSON.stringify(body),
      })
      if (handleAuthFailure(res)) return
      if (!res.ok) throw new Error('update failed')
      await fetchRequests()
      if (modalEl?.classList.contains('show')) {
        fetchEvents(id)
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Ошибка обновления статуса.'
    }
  })
}

function buildDetailsHtml(row, payload) {
  const accessList = Array.isArray(payload.access)
    ? payload.access.map((item) => `${item.email} (${item.role})`)
    : []
  const tiktokIds = Array.isArray(payload.tiktok_business_ids) ? payload.tiktok_business_ids : []
  return `
    <div class="details-grid">
      ${section('Основное', [
        ['Клиент', row.user_email || '—'],
        ['Платформа', row.platform || '—'],
        ['Название', row.name || '—'],
        ['Статус', statusLabel(row.status)],
        ['Менеджер', row.manager_email || '—'],
        ['Дата', row.created_at || '—'],
      ])}
      ${section('Ссылки', [
        ['Сайт', payload.website || '—'],
        ['Приложение', payload.app || '—'],
        ['Facebook', payload.facebook_page || '—'],
        ['Instagram', payload.instagram_page || '—'],
        ['Telegram-канал', payload.telegram_channel || '—'],
      ])}
      ${section('Доступы', [
        ['MCC e-mail', payload.mcc_email || '—'],
        ['Яндекс mail', payload.yandex_email || '—'],
        ['Access list', accessList.length ? accessList.join(', ') : '—'],
      ])}
      ${section('Meta', [
        ['BM ID', payload.business_manager_id || '—'],
        ['ГЕО', payload.geo || '—'],
        ['Конечный рекламодатель', payload.final_advertiser === 'no' ? 'Нет' : 'Да'],
        ['Конечный рекламодатель (имя)', payload.final_name || '—'],
        ['Страна', payload.final_country || '—'],
        ['Налоговый номер', payload.final_tax_id || '—'],
        ['Адрес', payload.final_address || '—'],
        ['Форма собственности', payload.final_ownership || '—'],
      ])}
      ${section('TikTok', [
        ['Business ID', tiktokIds.length ? tiktokIds.join(', ') : '—'],
        ['Часовой пояс', payload.tiktok_timezone || '—'],
        ['География', payload.tiktok_geo || '—'],
      ])}
      ${section('Лог', ['log-placeholder'])}
    </div>
    <details class="field details">
      <summary>Raw payload</summary>
      <pre class="payload-box">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </details>
  `
}

function section(title, rows) {
  if (rows.length === 1 && rows[0] === 'log-placeholder') {
    return `
      <div class="details-section">
        <h4>${title}</h4>
        <div id="request-log" class="details-list"></div>
      </div>
    `
  }
  const body = rows
    .filter((item) => item[1] !== undefined && item[1] !== null)
    .map(
      ([label, value]) => `
        <div class="details-row">
          <div class="details-label">${label}</div>
          <div class="details-value">${escapeHtml(String(value))}</div>
        </div>
      `
    )
    .join('')
  return `
    <div class="details-section">
      <h4>${title}</h4>
      ${body || '<div class="muted">Нет данных</div>'}
    </div>
  `
}

function normalizePayload(payload) {
  if (!payload) return {}
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch (e) {
      return { raw: payload }
    }
  }
  return payload
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function fetchEvents(requestId) {
  const logEl = document.getElementById('request-log')
  if (!logEl) return
  try {
    const res = await fetch(`${apiBase}/admin/account-requests/${requestId}/events`, {
      headers: authHeadersSafe(),
    })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('load events failed')
    const data = await res.json()
    renderEvents(logEl, data)
  } catch (e) {
    logEl.textContent = 'Ошибка загрузки лога.'
  }
}

function renderEvents(container, events) {
  if (!events.length) {
    container.innerHTML = '<div class="muted">Нет событий.</div>'
    return
  }
  container.innerHTML = events
    .map((event) => {
      const when = event.created_at?.replace('T', ' ') || ''
      const manager = event.manager_email ? `Менеджер: ${event.manager_email}` : ''
      const comment = event.comment ? `Комментарий: ${event.comment}` : ''
      const status = event.status ? `Статус: ${statusLabel(event.status)}` : ''
      const meta = [status, manager, comment].filter(Boolean).join(' · ')
      return `<div>${when} · ${event.type}${meta ? ` · ${meta}` : ''}</div>`
    })
    .join('')
}

function exportFile(path) {
  const token = localStorage.getItem('auth_token')
  if (!token) return
  const url = `${apiBase}${path}`
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = path.split('/').pop() || 'export.xlsx'
      link.click()
      URL.revokeObjectURL(link.href)
    })
    .catch(() => {})
}

if (filterStatus) filterStatus.addEventListener('change', applyFilters)
if (filterPlatform) filterPlatform.addEventListener('change', applyFilters)
if (filterEmail) filterEmail.addEventListener('input', applyFilters)
if (exportRequests) exportRequests.addEventListener('click', () => exportFile('/admin/export/requests.xlsx'))

fetchRequests()
