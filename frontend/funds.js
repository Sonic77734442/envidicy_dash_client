const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'
let funds = []
let legalEntities = []
let invoices = []
let topups = []

renderHeader({
  eyebrow: 'Envidicy · Billing Desk',
  title: 'Финансы',
  subtitle: 'Отслеживайте пополнения и возвраты по аккаунтам, с суммами и курсом.',
  buttons: [],
})

const walletTopup = {
  modal: document.getElementById('wallet-topup-modal'),
  open: document.getElementById('wallet-topup-open'),
  close: document.getElementById('wallet-topup-close'),
  cancel: document.getElementById('wallet-topup-cancel'),
  submit: document.getElementById('wallet-topup-submit'),
  entitySelect: document.getElementById('wallet-topup-legal-entity'),
  entityToggle: document.getElementById('wallet-entity-toggle'),
  entityForm: document.getElementById('wallet-entity-form'),
  entityNotice: document.getElementById('wallet-entity-notice'),
  entityName: document.getElementById('wallet-entity-name'),
  entityBin: document.getElementById('wallet-entity-bin'),
  entityAddress: document.getElementById('wallet-entity-address'),
  entityEmail: document.getElementById('wallet-entity-email'),
  entitySave: document.getElementById('wallet-entity-save'),
  amount: document.getElementById('wallet-topup-amount'),
  note: document.getElementById('wallet-topup-note'),
}

function openWalletTopupModal() {
  if (!walletTopup.modal) return
  walletTopup.modal.classList.add('show')
  if (walletTopup.amount) walletTopup.amount.value = ''
  if (walletTopup.note) walletTopup.note.value = ''
  if (walletTopup.entityForm) walletTopup.entityForm.hidden = true
  if (walletTopup.entityNotice) {
    walletTopup.entityNotice.hidden = true
    walletTopup.entityNotice.textContent = ''
  }
  if (walletTopup.entityName) walletTopup.entityName.value = ''
  if (walletTopup.entityBin) walletTopup.entityBin.value = ''
  if (walletTopup.entityAddress) walletTopup.entityAddress.value = ''
  if (walletTopup.entityEmail) walletTopup.entityEmail.value = ''
  renderLegalEntities()
}

function closeWalletTopupModal() {
  if (!walletTopup.modal) return
  walletTopup.modal.classList.remove('show')
}

async function submitWalletTopupRequest() {
  const amountValue = Number(walletTopup.amount?.value || 0)
  if (!amountValue || amountValue <= 0) {
    alert('Введите сумму пополнения.')
    return
  }
  const payload = {
    amount: amountValue,
    currency: 'KZT',
    note: walletTopup.note?.value?.trim() || null,
    legal_entity_id: walletTopup.entitySelect?.value ? Number(walletTopup.entitySelect.value) : null,
  }
  try {
    const res = await fetch(`${apiBase}/wallet/topup-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('Failed to create topup request')
    const data = await res.json()
    if (data?.invoice_url) {
      const token = typeof getAuthToken === 'function' ? getAuthToken() : localStorage.getItem('auth_token')
      const withToken = token ? `${data.invoice_url}?token=${encodeURIComponent(token)}` : data.invoice_url
      window.location.href = `${apiBase}${withToken}`
      return
    }
    alert('Заявка создана.')
    closeWalletTopupModal()
  } catch (e) {
    alert('Ошибка отправки. Попробуйте снова.')
  }
}

function renderLegalEntities() {
  if (!walletTopup.entitySelect) return
  const options = legalEntities
    .map((e) => `<option value="${e.id}">${e.name}${e.bin ? ` · ${e.bin}` : ''}</option>`)
    .join('')
  walletTopup.entitySelect.innerHTML = `<option value="">Не выбран</option>${options}`
  if (!walletTopup.entitySelect.value && legalEntities.length > 0) {
    walletTopup.entitySelect.value = String(legalEntities[0].id)
  }
}

async function fetchLegalEntities() {
  try {
    const res = await fetch(`${apiBase}/legal-entities`, { headers: authHeaders() })
    if (res.status === 401) return
    if (!res.ok) throw new Error('Failed to load legal entities')
    const data = await res.json()
    legalEntities = data
    renderLegalEntities()
  } catch (e) {
    console.error(e)
  }
}

async function createLegalEntity() {
  const name = walletTopup.entityName?.value?.trim()
  if (!name) {
    showEntityNotice('Укажите наименование контрагента.')
    return
  }
  const payload = {
    name,
    bin: walletTopup.entityBin?.value?.trim() || null,
    address: walletTopup.entityAddress?.value?.trim() || null,
    email: walletTopup.entityEmail?.value?.trim() || null,
  }
  try {
    const res = await fetch(`${apiBase}/legal-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (res.status === 401) return
    if (!res.ok) throw new Error('Failed to create legal entity')
    const data = await res.json()
    legalEntities = [data, ...legalEntities]
    renderLegalEntities()
    if (walletTopup.entitySelect) walletTopup.entitySelect.value = String(data.id)
    if (walletTopup.entityForm) walletTopup.entityForm.hidden = true
    showEntityNotice('Контрагент добавлен.', true)
  } catch (e) {
    showEntityNotice('Ошибка создания контрагента.')
  }
}

function showEntityNotice(text, isOk = false) {
  if (!walletTopup.entityNotice) return
  walletTopup.entityNotice.textContent = text
  walletTopup.entityNotice.hidden = false
  walletTopup.entityNotice.className = `notice${isOk ? '' : ' error'}`
}

function renderTable(rows) {
  const tbody = document.getElementById('funds-body')
  tbody.innerHTML = ''
  rows.forEach((r) => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${platformLabel(r.platform)}</td>
      <td>${r.account}</td>
      <td>${r.type}</td>
      <td>${fmtAmt(r.amount, r.currency)}</td>
      <td>${r.acqPercent != null ? `${Number(r.acqPercent).toFixed(2)}%` : '—'}</td>
      <td>${r.acqAmount != null ? fmtAmt(r.acqAmount, r.currency) : '—'}</td>
      <td>${r.fx ?? '-'}</td>
      <td>${r.currency}</td>
      <td>${r.note || ''}</td>
    `
    tbody.appendChild(tr)
  })
}

function renderInvoices(rows) {
  const tbody = document.getElementById('wallet-invoices-body')
  if (!tbody) return
  tbody.innerHTML = ''
  rows.forEach((r) => {
    const tr = document.createElement('tr')
    const token = typeof getAuthToken === 'function' ? getAuthToken() : localStorage.getItem('auth_token')
    const pdfUrl = `${apiBase}/wallet/topup-requests/${r.id}/pdf-generated${token ? `?token=${encodeURIComponent(token)}` : ''}`
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.counterparty}</td>
      <td>${fmtAmt(r.amount, r.currency)}</td>
      <td>${r.number || '—'}</td>
      <td style="text-align:right;">
        <a class="btn ghost small" href="${pdfUrl}" target="_blank" rel="noopener">PDF</a>
      </td>
    `
    tbody.appendChild(tr)
  })
}

function formatDate(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    if (value.includes('T')) return value.split('T')[0]
    if (value.includes(' ')) return value.split(' ')[0]
    return value.slice(0, 10)
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return ''
}

function fmtAmt(v, ccy) {
  const sign = v < 0 ? '-' : ''
  return `${sign}${Math.abs(v).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`
}

function platformLabel(key) {
  if (key === 'meta') return 'Meta'
  if (key === 'google') return 'Google'
  if (key === 'tiktok') return 'TikTok'
  if (key === 'yandex') return 'Яндекс'
  if (key === 'telegram') return 'Telegram'
  if (key === 'monochrome') return 'Monochrome'
  return key
}

function applyFilters() {
  const from = document.getElementById('date-from').value
  const to = document.getElementById('date-to').value
  const platform = document.getElementById('filter-platform').value
  const account = document.getElementById('filter-account').value?.toLowerCase().trim()
  const rows = funds.filter((r) => {
    if (platform && r.platform !== platform) return false
    if (account && !r.account.toLowerCase().includes(account)) return false
    if (from && r.date < from) return false
    if (to && r.date > to) return false
    return true
  })
  renderTable(rows)
  renderSummary(rows)
}

function renderSummary(rows) {
  const wrap = document.getElementById('summary-chips')
  wrap.innerHTML = ''
  const totalUsd = rows
    .filter((r) => r.currency === 'USD')
    .reduce((acc, r) => acc + r.amount, 0)
  const totalKzt = rows
    .filter((r) => r.currency === 'KZT')
    .reduce((acc, r) => acc + r.amount, 0)
  const chips = [
    { label: 'USD итого', value: fmtAmt(totalUsd, 'USD') },
    { label: 'KZT итого', value: fmtAmt(totalKzt, 'KZT') },
    {
      label: 'Эквайринг удержано',
      value: fmtAmt(
        rows.reduce((acc, r) => acc + Number(r.acqAmount || 0), 0),
        'KZT'
      ),
    },
  ]
  chips.forEach((c) => {
    const span = document.createElement('span')
    span.className = 'chip chip-ghost'
    span.textContent = `${c.label}: ${c.value}`
    wrap.appendChild(span)
  })
}

function bind() {
  document.querySelectorAll('#date-from, #date-to, #filter-platform, #filter-account').forEach((el) => {
    el.addEventListener('change', applyFilters)
    el.addEventListener('input', applyFilters)
  })
}

function initTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab-button'))
  const panels = Array.from(document.querySelectorAll('.tab-panel'))
  if (!buttons.length || !panels.length) return
  const activateTab = (tab) => {
    buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab))
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.tabPanel === tab))
  }
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab)
    })
  })
  activateTab('invoices')
}

async function fetchFunds() {
  const res = await fetch(`${apiBase}/wallet/transactions`, { headers: authHeaders() })
  if (res.status === 401) {
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    console.error('Failed to load wallet transactions')
    return
  }
  const data = await res.json()
  const feeMap = new Map()
  topups
    .filter((t) => t.status === 'completed')
    .forEach((t) => {
      const fee = Number(t.amount_input || 0) * (Number(t.fee_percent || 0) / 100)
      const vat = Number(t.amount_input || 0) * (Number(t.vat_percent || 0) / 100)
      const gross = Number(t.amount_input || 0) + fee + vat
      const key = `${t.account_id}:${gross.toFixed(2)}`
      const current = feeMap.get(key) || []
      current.push({
        feePercent: Number(t.fee_percent || 0),
        feeAmount: fee,
        createdAt: t.created_at || '',
      })
      feeMap.set(key, current)
    })
  funds = data.map((row) => ({
    ...(function () {
      if (row.type !== 'topup' || Number(row.amount || 0) >= 0) return { acqPercent: null, acqAmount: null }
      const key = `${row.account_id}:${Math.abs(Number(row.amount || 0)).toFixed(2)}`
      const bucket = feeMap.get(key) || []
      let match = null
      if (bucket.length) {
        bucket.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        match = bucket.shift()
        feeMap.set(key, bucket)
      }
      return {
        acqPercent: match ? match.feePercent : null,
        acqAmount: match ? match.feeAmount : null,
      }
    })(),
    date: formatDate(row.created_at),
    platform: row.account_platform || '',
    account: row.account_name || '—',
    type: row.type === 'topup' ? 'Списание' : 'Пополнение',
    amount: row.amount,
    currency: row.currency || 'KZT',
    fx: row.fx_rate ?? '-',
    note: row.note || '',
  }))
  applyFilters()
}

async function fetchTopups() {
  try {
    const res = await fetch(`${apiBase}/topups`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('Failed to load topups')
    topups = await res.json()
  } catch (e) {
    topups = []
  }
}

async function fetchInvoices() {
  const res = await fetch(`${apiBase}/wallet/topup-requests`, { headers: authHeaders() })
  if (res.status === 401) {
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    console.error('Failed to load wallet invoices')
    return
  }
  const data = await res.json()
  invoices = data.map((row) => ({
    id: row.id,
    date: formatDate(row.created_at),
    counterparty: row.legal_entity_name || row.client_name || '—',
    amount: row.invoice_amount ?? row.amount ?? 0,
    currency: row.invoice_currency || row.currency || 'KZT',
    number: row.invoice_number || row.invoice_number_text || '',
  }))
  renderInvoices(invoices)
}

function init() {
  bind()
  initTabs()
  fetchTopups().then(fetchFunds)
  fetchInvoices()
  fetchLegalEntities()
  if (walletTopup.open) walletTopup.open.addEventListener('click', openWalletTopupModal)
  if (walletTopup.close) walletTopup.close.addEventListener('click', closeWalletTopupModal)
  if (walletTopup.cancel) walletTopup.cancel.addEventListener('click', closeWalletTopupModal)
  if (walletTopup.submit) walletTopup.submit.addEventListener('click', submitWalletTopupRequest)
  if (walletTopup.entityToggle) {
    walletTopup.entityToggle.addEventListener('click', () => {
      if (!walletTopup.entityForm) return
      walletTopup.entityForm.hidden = !walletTopup.entityForm.hidden
      if (!walletTopup.entityForm.hidden) {
        const name = walletTopup.entityName
        if (name) name.focus()
      }
    })
  }
  if (walletTopup.entityForm) {
    walletTopup.entityForm.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        createLegalEntity()
      }
    })
  }
  if (walletTopup.entitySave) {
    walletTopup.entitySave.addEventListener('click', () => {
      createLegalEntity()
    })
  }
  if (window.location.hash === '#topup') {
    openWalletTopupModal()
    history.replaceState(null, '', window.location.pathname)
  }
}

init()
