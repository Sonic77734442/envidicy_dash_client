const apiBase = window.API_BASE || 'http://127.0.0.1:8000'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Компания',
  subtitle: 'Настройте реквизиты и адреса для счетов.',
  buttons: [],
})

const fields = {
  name: document.getElementById('company-name'),
  bin: document.getElementById('company-bin'),
  iin: document.getElementById('company-iin'),
  legalAddress: document.getElementById('company-legal-address'),
  factualAddress: document.getElementById('company-factual-address'),
}

const saveBtn = document.getElementById('company-save')
const statusEl = document.getElementById('company-status')

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

async function loadCompany() {
  try {
    const res = await fetch(`${apiBase}/admin/company-profile`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load company profile')
    const data = await res.json()
    if (fields.name) fields.name.value = data.name || ''
    if (fields.bin) fields.bin.value = data.bin || ''
    if (fields.iin) fields.iin.value = data.iin || ''
    if (fields.legalAddress) fields.legalAddress.value = data.legal_address || ''
    if (fields.factualAddress) fields.factualAddress.value = data.factual_address || ''
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Ошибка загрузки реквизитов.'
  }
}

async function saveCompany() {
  const payload = {
    name: fields.name?.value?.trim() || null,
    bin: fields.bin?.value?.trim() || null,
    iin: fields.iin?.value?.trim() || null,
    legal_address: fields.legalAddress?.value?.trim() || null,
    factual_address: fields.factualAddress?.value?.trim() || null,
  }

  try {
    const res = await fetch(`${apiBase}/admin/company-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
      body: JSON.stringify(payload),
    })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to save company profile')
    if (statusEl) statusEl.textContent = 'Сохранено.'
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Ошибка сохранения.'
  }
}

if (saveBtn) saveBtn.addEventListener('click', saveCompany)

loadCompany()
