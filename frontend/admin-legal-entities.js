const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Контрагенты',
  subtitle: 'Добавление и изменение данных контрагентов клиентов.',
  buttons: [],
})

const tableBody = document.getElementById('admin-entities')
const statusEl = document.getElementById('admin-entities-status')
const addBtn = document.getElementById('entity-add')
const modalEl = document.getElementById('entity-modal')
const modalTitle = document.getElementById('entity-title')
const modalClose = document.getElementById('entity-close')
const modalSave = document.getElementById('entity-save')
const noticeEl = document.getElementById('entity-notice')

const fields = {
  id: null,
  userEmail: document.getElementById('entity-user-email'),
  bin: document.getElementById('entity-bin'),
  shortName: document.getElementById('entity-short-name'),
  fullName: document.getElementById('entity-full-name'),
  legalAddress: document.getElementById('entity-legal-address'),
}

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

function resetModal() {
  fields.id = null
  if (fields.userEmail) fields.userEmail.value = ''
  if (fields.bin) fields.bin.value = ''
  if (fields.shortName) fields.shortName.value = ''
  if (fields.fullName) fields.fullName.value = ''
  if (fields.legalAddress) fields.legalAddress.value = ''
  if (noticeEl) noticeEl.textContent = ''
}

function openModal(row) {
  resetModal()
  if (row) {
    fields.id = row.id
    if (modalTitle) modalTitle.textContent = 'Редактирование контрагента'
    if (fields.userEmail) fields.userEmail.value = row.user_email || ''
    if (fields.bin) fields.bin.value = row.bin || ''
    if (fields.shortName) fields.shortName.value = row.short_name || row.name || ''
    if (fields.fullName) fields.fullName.value = row.full_name || row.name || ''
    if (fields.legalAddress) fields.legalAddress.value = row.legal_address || row.address || ''
  } else if (modalTitle) {
    modalTitle.textContent = 'Новый контрагент'
  }
  modalEl?.classList.add('show')
}

async function fetchEntities() {
  try {
    const res = await fetch(`${apiBase}/admin/legal-entities`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load entities')
    const data = await res.json()
    window.__entities = data
    renderRows(data)
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Ошибка загрузки контрагентов.'
  }
}

function renderRows(rows) {
  if (!tableBody) return
  tableBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.created_at?.split(' ')[0] || '—'}</td>
        <td>${row.user_email || '—'}</td>
        <td>${row.bin || '—'}</td>
        <td>${row.short_name || row.name || '—'}</td>
        <td>${row.full_name || row.name || '—'}</td>
        <td>${row.legal_address || row.address || '—'}</td>
        <td style="text-align:right;">
          <button class="btn ghost small" data-edit="${row.id}">Изменить</button>
        </td>
      </tr>
    `
    )
    .join('')
}

async function saveEntity() {
  const userEmail = fields.userEmail?.value?.trim()
  const bin = fields.bin?.value?.trim()
  const shortName = fields.shortName?.value?.trim()
  const fullName = fields.fullName?.value?.trim()
  const legalAddress = fields.legalAddress?.value?.trim()

  if (!userEmail || !bin || !shortName || !fullName || !legalAddress) {
    if (noticeEl) noticeEl.textContent = 'Заполните все поля.'
    return
  }

  const payload = {
    user_email: userEmail,
    bin,
    short_name: shortName,
    full_name: fullName,
    legal_address: legalAddress,
  }

  try {
    const url = fields.id ? `${apiBase}/admin/legal-entities/${fields.id}` : `${apiBase}/admin/legal-entities`
    const res = await fetch(url, {
      method: fields.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
      body: JSON.stringify(payload),
    })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('save failed')
    modalEl?.classList.remove('show')
    await fetchEntities()
  } catch (e) {
    if (noticeEl) noticeEl.textContent = 'Не удалось сохранить контрагента.'
  }
}

if (addBtn) addBtn.addEventListener('click', () => openModal())
if (modalClose) modalClose.addEventListener('click', () => modalEl?.classList.remove('show'))
if (modalEl) {
  modalEl.addEventListener('click', (event) => {
    if (event.target === modalEl) modalEl.classList.remove('show')
  })
}
if (modalSave) modalSave.addEventListener('click', saveEntity)

if (tableBody) {
  tableBody.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-edit]')
    if (!btn) return
    const id = btn.dataset.edit
    const currentRow = Array.from(window.__entities || []).find((item) => String(item.id) === String(id))
    if (currentRow) {
      openModal(currentRow)
    }
  })
}

fetchEntities()

