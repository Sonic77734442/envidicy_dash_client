const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'
const getAuthTokenSafe =
  typeof getAuthToken === 'function' ? getAuthToken : () => localStorage.getItem('auth_token')
const authHeadersSafe =
  typeof authHeaders === 'function'
    ? authHeaders
    : () => {
        const token = getAuthTokenSafe()
        return token ? { Authorization: `Bearer ${token}` } : {}
      }

renderHeader({
  eyebrow: 'Envidicy � Billing Desk',
  title: '���������� ��������� ���������',
  subtitle: '�������� ������� Meta, Google ��� TikTok, �������� e-mail � ������ �������� ��� ����������� �����.',
  buttons: [
    { label: '�������', href: '/dashboard', kind: 'ghost' },
    { label: '�������', href: '/funds', kind: 'ghost' },
    { label: '���������', href: '/plan', kind: 'ghost' },
    { label: '����', href: '/login', kind: 'ghost' },
  ],
})

const state = {
  openAccounts: [],
  accountRequests: [],
  topups: [],
  accountsFull: [],
  fees: null,
}

let accounts = { meta: [], google: [], tiktok: [], yandex: [], telegram: [], monochrome: [] }

const platforms = [
  {
    key: 'meta',
    title: 'Meta',
    subtitle: 'Facebook / Instagram',
    badge: 'ADS MANAGER',
  },
  {
    key: 'google',
    title: 'Google Ads',
    subtitle: 'Search / YouTube / Display',
    badge: 'ADS',
  },
  {
    key: 'tiktok',
    title: 'TikTok Ads',
    subtitle: 'For You / Video',
    badge: 'ADS',
  },
  {
    key: 'yandex',
    title: '������ ������',
    subtitle: '����� / ��� / �������',
    badge: 'ADS',
  },
  {
    key: 'telegram',
    title: 'Telegram Ads',
    subtitle: 'Channels / Bots / Search',
    badge: 'ADS',
  },
  {
    key: 'monochrome',
    title: 'Monochrome',
    subtitle: 'Programmatic',
    badge: 'ADS',
  },
]

const createModal = {
  el: document.getElementById('create-modal'),
  platform: document.getElementById('create-platform'),
  title: document.getElementById('create-modal-title'),
  stepMcc: document.getElementById('create-step-mcc'),
  stepTiktokInfo: document.getElementById('create-step-tiktok-info'),
  stepAccount: document.getElementById('create-step-account'),
  actions: document.getElementById('create-modal-actions'),
  mccEmail: document.getElementById('create-mcc-email'),
  mccSend: document.getElementById('create-mcc-send'),
  tiktokHasAccount: document.getElementById('create-tiktok-has-account'),
  notice: document.getElementById('create-account-notice'),
  nameLabel: document.getElementById('create-name-label'),
  name: document.getElementById('create-name'),
  bmId: document.getElementById('create-bm-id'),
  geo: document.getElementById('create-geo'),
  facebookPage: document.getElementById('create-facebook-page'),
  instagramPage: document.getElementById('create-instagram-page'),
  accountPrimary: document.getElementById('create-account-primary'),
  accountFinal: document.getElementById('create-account-final'),
  finalAdvertiser: document.getElementById('create-final-advertiser'),
  finalName: document.getElementById('create-final-name'),
  finalCountry: document.getElementById('create-final-country'),
  finalTaxId: document.getElementById('create-final-tax-id'),
  finalAddress: document.getElementById('create-final-address'),
  finalOwnership: document.getElementById('create-final-ownership'),
  metaFields: document.getElementById('create-meta-fields'),
  yandexFields: document.getElementById('create-yandex-fields'),
  yandexEmail: document.getElementById('create-yandex-email'),
  telegramFields: document.getElementById('create-telegram-fields'),
  telegramChannel: document.getElementById('create-telegram-channel'),
  tiktokFields: document.getElementById('create-tiktok-fields'),
  tiktokIdList: document.getElementById('create-tiktok-id-list'),
  tiktokIdInput: document.getElementById('create-tiktok-id'),
  tiktokIdAdd: document.getElementById('create-tiktok-id-add'),
  tiktokTimezone: document.getElementById('create-tiktok-timezone'),
  tiktokGeo: document.getElementById('create-tiktok-geo'),
  website: document.getElementById('create-website'),
  app: document.getElementById('create-app'),
  accessList: document.getElementById('create-access-list'),
  accessEmail: document.getElementById('create-access-email'),
  accessRole: document.getElementById('create-access-role'),
  accessAdd: document.getElementById('create-access-add'),
  accessBlock: document.getElementById('create-access-block'),
}

const topupModal = {
  el: document.getElementById('topup-modal'),
  badge: document.getElementById('topup-badge'),
  account: document.getElementById('topup-account'),
  budget: document.getElementById('topup-budget'),
  fee: document.getElementById('fee-amount'),
  feeLabel: document.getElementById('fee-percent'),
  net: document.getElementById('net-amount'),
  accountAmount: document.getElementById('account-amount'),
  feePercent: 10,
  vatPercent: 0,
}

const createState = {
  step: 'account',
  access: [],
  mccSent: false,
  metaStage: 'primary',
  tiktokIds: [],
}

function handleAuthFailure(res) {
  if (res.status === 401) {
    alert('��� ������� � �������� ����� �����.')
    window.location.href = '/login'
    return true
  }
  return false
}

function renderCards() {
  const container = document.getElementById('topup-list')
  container.innerHTML = ''
  platforms.forEach((p) => {
    const div = document.createElement('div')
    div.className = 'topup-card'
    div.innerHTML = `
      <div>
        <p class="eyebrow">${p.badge}</p>
        <h3>${p.title}</h3>
      </div>
      <button class="btn primary" data-platform="${p.key}">������� �������</button>
    `
    container.appendChild(div)
  })
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-platform]')
    if (btn) openCreateModal(btn.dataset.platform)
  })
}

function renderOpenAccounts() {
  const tbody = document.getElementById('accounts-body')
  if (!tbody) return
  tbody.innerHTML = ''
  state.openAccounts.forEach((row) => {
    const hasAccount = Boolean(row.account_db_id)
    const tr = document.createElement('tr')
    const budgetLabel =
      row.budget == null
        ? '�'
        : `${Number(row.budget).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${row.currency || 'USD'}`
    tr.innerHTML = `
      <td>${platformLabel(row.platform)}</td>
      <td>${row.account_id}</td>
      <td>${row.company}</td>
      <td>${row.email}</td>
      <td>${budgetLabel}</td>
      <td><span class="status ${statusClass(row.status)}">${row.status}</span></td>
      <td style="text-align:right; display:flex; gap:6px; justify-content:flex-end;">
        ${
          hasAccount
            ? `
        <button class="icon-btn" title="���������" data-topup="${row.account_db_id}" data-platform="${row.platform}">$</button>
        <button class="icon-btn stat" title="����������" data-stat="${row.account_db_id}" data-platform="${row.platform}">??</button>
        <button class="icon-btn refresh" title="��������" data-refresh="${row.account_db_id}" data-platform="${row.platform}">?</button>
        `
            : `<span class="muted small">������� ��������</span>`
        }
      </td>
    `
    tbody.appendChild(tr)
  })
  if (!tbody.dataset.bound) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-topup]')
      if (btn) {
        const accId = btn.dataset.topup
        const platform = btn.dataset.platform
        openTopupModal(platform, accId)
      }
      const stat = e.target.closest('button[data-stat]')
      if (stat) {
        alert('���������� ����� ������������� �����.')
      }
      const refresh = e.target.closest('button[data-refresh]')
      if (refresh) {
        alert('���������� ������� ����� ��������� �����.')
      }
    })
    tbody.dataset.bound = '1'
  }
}

function normalizeAccountStatus(status) {
  if (!status) return '�� ���������'
  if (status === 'pending') return '�� ���������'
  if (status === 'active') return '�������'
  if (status === 'paused') return '�������������'
  if (status === 'archived') return '������'
  return status
}

function statusClass(status) {
  if (status === '�����') return 'status-paused'
  if (status === '� ������') return 'status-warn'
  if (status === '������') return 'status-active'
  if (status === '��������') return 'status-blocked'
  if (status === '�� ���������') return 'status-warn'
  if (status === '�������') return 'status-active'
  if (status === '�������������') return 'status-paused'
  if (status === '������������') return 'status-blocked'
  if (status === '������') return 'status-closed'
  return ''
}

function syncOpenAccounts() {
  const accountIndex = new Map()
  const accountRows = (state.accountsFull || []).map((acc) => {
    const key = `${acc.platform}:${acc.name}`
    accountIndex.set(key, acc.id)
    return {
      platform: acc.platform,
      account_id: acc.name || acc.external_id || `������� #${acc.id}`,
      account_db_id: acc.id,
      company: '',
      email: '�',
      budget: acc.budget_total ?? null,
      currency: acc.currency || (acc.platform === 'telegram' ? 'EUR' : 'USD'),
      status: normalizeAccountStatus(acc.status),
    }
  })

  const requestRows = (state.accountRequests || [])
    .map((req) => {
      const accountDbId = accountIndex.get(`${req.platform}:${req.name}`) || null
      return {
        platform: req.platform,
        account_id: req.name || `������ #${req.id}`,
        account_db_id: accountDbId,
        company: '',
        email: req.email || '�',
        budget: req.budget_total,
        currency: req.account_currency || (req.platform === 'telegram' ? 'EUR' : 'USD'),
        status: req.status,
      }
    })
    .filter((row) => !row.account_db_id)

  state.openAccounts = [...accountRows, ...requestRows]
  renderOpenAccounts()
}

function openCreateModal(platformKey) {
  createModal.platform.value = platformLabel(platformKey)
  createModal.title.textContent = `������� � ${platformLabel(platformKey)}`
  createState.mccSent = false
  createState.metaStage = 'primary'
  createModal.notice.hidden = true
  createModal.el.dataset.platform = platformKey
  updateCreatePlatformUI(platformKey)
  if (platformKey === 'google') {
    setCreateStep('mcc')
  } else if (platformKey === 'tiktok') {
    setCreateStep('tiktok-info')
  } else {
    setCreateStep('account')
  }
  createModal.el.classList.add('show')
}

function closeCreateModal() {
  createModal.el.classList.remove('show')
  createModal.mccEmail.value = ''
  createModal.name.value = ''
  createModal.bmId.value = ''
  createModal.geo.value = ''
  createModal.facebookPage.value = ''
  createModal.instagramPage.value = ''
  createModal.finalAdvertiser.value = 'yes'
  createModal.finalName.value = ''
  createModal.finalCountry.value = ''
  createModal.finalTaxId.value = ''
  createModal.finalAddress.value = ''
  createModal.finalOwnership.value = ''
  createModal.tiktokIdInput.value = ''
  createModal.tiktokTimezone.value = ''
  createModal.tiktokGeo.value = ''
  createModal.yandexEmail.value = ''
  createModal.telegramChannel.value = ''
  createModal.website.value = ''
  createModal.app.value = ''
  createModal.accessEmail.value = ''
  createState.access = []
  createState.tiktokIds = []
  createState.mccSent = false
  createState.metaStage = 'primary'
  createModal.notice.hidden = true
  renderAccessList()
  renderTiktokIds()
  updateMetaStage()
}

function openTopupModal(platformKey, accountId) {
  if (!accounts[platformKey] || accounts[platformKey].length === 0) {
    alert('��� ��������� ��������� ��� ����������. ��������� �������� ��������.')
    return
  }
  const feeVal = state.fees ? state.fees[platformKey] : null
  topupModal.feePercent = feeVal == null ? null : Number(feeVal)
  topupModal.badge.textContent = platformLabel(platformKey)
  topupModal.account.innerHTML = accounts[platformKey]
    .map((a) => `<option value="${a.id}">${a.name}</option>`)
    .join('')
  if (accountId) topupModal.account.value = accountId
  topupModal.el.classList.add('show')
  topupModal.el.dataset.platform = platformKey
  updateFee()
}

function closeTopupModal() {
  topupModal.el.classList.remove('show')
  topupModal.budget.value = ''
  updateFee()
}

function platformLabel(key) {
  if (key === 'meta') return 'Meta'
  if (key === 'google') return 'Google Ads'
  if (key === 'tiktok') return 'TikTok Ads'
  if (key === 'yandex') return '������ ������'
  if (key === 'telegram') return 'Telegram Ads'
  if (key === 'monochrome') return 'Monochrome'
  return key
}

function setCreateStep(step) {
  createState.step = step
  createModal.stepMcc.hidden = step !== 'mcc'
  createModal.stepTiktokInfo.hidden = step !== 'tiktok-info'
  createModal.stepAccount.hidden = step !== 'account'
  createModal.actions.style.display = step === 'account' ? 'flex' : 'none'
  const platformKey = createModal.el.dataset.platform || 'google'
  updateCreatePlatformUI(platformKey)
  if (step === 'mcc') {
    createModal.title.textContent = '������� MCC'
  } else if (step === 'tiktok-info') {
    createModal.title.textContent = 'TikTok Business Center'
  } else {
    createModal.title.textContent = `������� � ${platformLabel(platformKey)}`
  }
}

function updateCreatePlatformUI(platformKey) {
  const isMeta = platformKey === 'meta'
  const isGoogle = platformKey === 'google'
  const isTiktok = platformKey === 'tiktok'
  const isYandex = platformKey === 'yandex'
  const isTelegram = platformKey === 'telegram'
  createModal.metaFields.hidden = !isMeta
  createModal.accessBlock.hidden = !isGoogle
  createModal.tiktokFields.hidden = !isTiktok
  createModal.yandexFields.hidden = !isYandex
  createModal.telegramFields.hidden = !isTelegram
  createModal.stepMcc.hidden = !isGoogle && createState.step !== 'mcc'
  createModal.stepTiktokInfo.hidden = !isTiktok && createState.step !== 'tiktok-info'
  createModal.nameLabel.textContent = isMeta ? '�������� ��������' : '������� �������� ��������'
  if (!isMeta) {
    createState.metaStage = 'primary'
  }
  updateMetaStage()
}

function updateMetaStage() {
  const isMeta = createModal.el.dataset.platform === 'meta'
  const showFinal = isMeta && createState.metaStage === 'final'
  createModal.accountPrimary.hidden = showFinal
  createModal.accountFinal.hidden = !showFinal
}

function renderAccessList() {
  createModal.accessList.innerHTML = createState.access
    .map(
      (item, index) => `
        <div class="access-item">
          <div>
            <div class="access-email">${item.email}</div>
            <div class="muted small">${item.role === 'read' ? '������ ������' : '����������� ������'}</div>
          </div>
          <button class="btn ghost small" type="button" data-remove="${index}">������</button>
        </div>
      `
    )
    .join('')
}

function renderTiktokIds() {
  createModal.tiktokIdList.innerHTML = createState.tiktokIds
    .map(
      (id, index) => `
        <div class="access-item">
          <div class="access-email">${id}</div>
          <button class="btn ghost small" type="button" data-remove-id="${index}">������</button>
        </div>
      `
    )
    .join('')
}

function bindModal() {
  document.getElementById('create-modal-close').onclick = closeCreateModal
  document.getElementById('create-modal-cancel').onclick = closeCreateModal
  createModal.tiktokHasAccount.onclick = () => setCreateStep('account')
  createModal.mccSend.onclick = () => {
    const email = createModal.mccEmail.value.trim()
    if (!email) {
      alert('������� e-mail ��� ������� � MCC.')
      return
    }
    createState.mccSent = true
    createModal.notice.textContent = `������ � MCC ��������� �� ${email}.`
    createModal.notice.hidden = false
    setCreateStep('account')
  }
  createModal.accessAdd.onclick = () => {
    const email = createModal.accessEmail.value.trim()
    const role = createModal.accessRole.value
    if (!email) {
      alert('������� e-mail ��� �������.')
      return
    }
    createState.access.push({ email, role })
    createModal.accessEmail.value = ''
    renderAccessList()
  }
  createModal.accessList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]')
    if (!btn) return
    const index = Number(btn.dataset.remove)
    if (Number.isNaN(index)) return
    createState.access.splice(index, 1)
    renderAccessList()
  })
  createModal.tiktokIdAdd.onclick = () => {
    const value = createModal.tiktokIdInput.value.trim()
    if (!value) {
      alert('������� TikTok Business ID.')
      return
    }
    if (createState.tiktokIds.length >= 10) {
      alert('����� �������� �� 10 Business ID.')
      return
    }
    createState.tiktokIds.push(value)
    createModal.tiktokIdInput.value = ''
    renderTiktokIds()
  }
  createModal.tiktokIdList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove-id]')
    if (!btn) return
    const index = Number(btn.dataset.removeId)
    if (Number.isNaN(index)) return
    createState.tiktokIds.splice(index, 1)
    renderTiktokIds()
  })
  document.getElementById('create-modal-submit').onclick = async () => {
    const platform = createModal.el.dataset.platform
    const name = createModal.name.value.trim()
    const website = createModal.website.value.trim()
    if (!name) {
      alert('������� �������� ��������.')
      return
    }
    if (platform === 'meta') {
      const required = [
        { value: createModal.bmId.value.trim(), label: 'ID Business Manager Facebook' },
        { value: createModal.geo.value.trim(), label: '��� ������� �������' },
        { value: createModal.facebookPage.value.trim(), label: '�������� �������' },
        { value: createModal.instagramPage.value.trim(), label: '�������� ���������' },
      ]
      if (createModal.finalAdvertiser.value === 'no' && createState.metaStage !== 'final') {
        const missingPrimary = required.find((item) => !item.value)
        if (missingPrimary) {
          alert(`��������� ����: ${missingPrimary.label}.`)
          return
        }
        createState.metaStage = 'final'
        updateMetaStage()
        return
      }
      if (createModal.finalAdvertiser.value === 'no') {
        required.push(
          { value: createModal.finalName.value.trim(), label: '������������ ��������� �������������' },
          { value: createModal.finalCountry.value.trim(), label: '������ ��������� �������������' },
          { value: createModal.finalTaxId.value.trim(), label: '����� ����������������� ��������� �������������' },
          { value: createModal.finalAddress.value.trim(), label: '����� ��������� �������������' },
          { value: createModal.finalOwnership.value.trim(), label: '����� ������������� ��������� �������������' }
        )
      }
      const missing = required.find((item) => !item.value)
      if (missing) {
        alert(`��������� ����: ${missing.label}.`)
        return
      }
    }
    if (platform === 'tiktok') {
      if (!createState.tiktokIds.length) {
        alert('�������� ���� �� ���� TikTok Business ID.')
        return
      }
      if (!createModal.tiktokTimezone.value.trim()) {
        alert('������� ������� ����.')
        return
      }
      if (!createModal.tiktokGeo.value.trim()) {
        alert('������� ���������.')
        return
      }
    }
    if (platform === 'yandex') {
      if (!createModal.yandexEmail.value.trim()) {
        alert('������� mail ��������� ������� ������.')
        return
      }
    }
    if (platform === 'telegram') {
      if (!createModal.telegramChannel.value.trim()) {
        alert('������� ������ �� Telegram-�����.')
        return
      }
    }
    if (!website) {
      alert('������� ������ �� ����.')
      return
    }
    if ((platform === 'google' || platform === 'telegram' || platform === 'monochrome') && !createState.access.length) {
      alert('�������� ���� �� ���� e-mail ��� �������.')
      return
    }
    const payload = {
      platform,
      name,
      external_id: null,
      currency: 'USD',
      website,
      app: createModal.app.value.trim() || null,
      access: createState.access,
      mcc_email: createState.mccSent ? createModal.mccEmail.value.trim() : null,
      business_manager_id: createModal.bmId.value.trim() || null,
      geo: createModal.geo.value.trim() || null,
      facebook_page: createModal.facebookPage.value.trim() || null,
      instagram_page: createModal.instagramPage.value.trim() || null,
      final_advertiser: createModal.finalAdvertiser.value,
      final_name: createModal.finalName.value.trim() || null,
      final_country: createModal.finalCountry.value.trim() || null,
      final_tax_id: createModal.finalTaxId.value.trim() || null,
      final_address: createModal.finalAddress.value.trim() || null,
      final_ownership: createModal.finalOwnership.value.trim() || null,
      tiktok_business_ids: createState.tiktokIds,
      tiktok_timezone: createModal.tiktokTimezone.value.trim() || null,
      tiktok_geo: createModal.tiktokGeo.value.trim() || null,
      yandex_email: createModal.yandexEmail.value.trim() || null,
      telegram_channel: createModal.telegramChannel.value.trim() || null,
    }
    try {
      const res = await fetch(`${apiBase}/account-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
        body: JSON.stringify({ platform: payload.platform, name: payload.name, payload }),
      })
      if (handleAuthFailure(res)) return
      if (!res.ok) throw new Error('create account failed')
      await fetchAccountRequests()
      alert('������ ����������. �� �������� � ���� ����� ���������.')
      closeCreateModal()
    } catch (e) {
      alert('������ ��������. ���������� �����.')
    }
  }

  document.getElementById('topup-close').onclick = closeTopupModal
  document.getElementById('topup-cancel').onclick = closeTopupModal
  document.getElementById('topup-submit').onclick = async () => {
    if (!topupModal.account.value) {
      alert('�������� ������� ��� ����������.')
      return
    }
    if (topupModal.feePercent == null) {
      alert('�������� ��� ���� ��������� �� ������. ���������� � ��������������.')
      return
    }
    const payload = {
      platform: topupModal.el.dataset.platform,
      account_id: topupModal.account.value,
      amount_input: topupModal.budget.value ? Number(topupModal.budget.value) : 0,
      fee_percent: topupModal.feePercent,
      vat_percent: topupModal.vatPercent,
    }
    try {
      const res = await fetch(`${apiBase}/topups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
        body: JSON.stringify(payload),
      })
      if (handleAuthFailure(res)) return
      if (!res.ok) {
        let message = '������ ��������. ���������� �����.'
        try {
          const data = await res.json()
          if (data?.detail) message = data.detail
        } catch (e) {
          // ignore parse error
        }
        alert(message)
        return
      }
      const data = await res.json()
      await fetchTopups()
      alert('���������� ���������� �� ���������.')
      closeTopupModal()
    } catch (e) {
      alert('������ ��������. ���������� �����.')
    }
  }

  topupModal.budget.addEventListener('input', updateFee)
}

function updateFee() {
  const amt = topupModal.budget.value ? Number(topupModal.budget.value) : 0
  const feePct = topupModal.feePercent == null ? 0 : topupModal.feePercent
  const fee = amt * (feePct / 100)
  const vat = amt * (topupModal.vatPercent / 100)
  const gross = amt + fee + vat
  if (topupModal.feeLabel) {
    topupModal.feeLabel.textContent = topupModal.feePercent == null ? '?' : String(feePct)
  }
  topupModal.fee.textContent = `?${fee.toFixed(2)}`
  topupModal.net.textContent = `?${gross.toFixed(2)}`
  topupModal.accountAmount.textContent = `?${amt.toFixed(2)}`
}

function init() {
  renderCards()
  renderOpenAccounts()
  bindModal()
  fetchFees()
  fetchAccounts()
  fetchTopups()
  fetchAccountRequests()
}

init()

async function fetchAccounts() {
  try {
    const res = await fetch(`${apiBase}/accounts`, { headers: { ...authHeadersSafe() } })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load accounts')
    const data = await res.json()
    state.accountsFull = data
    accounts = { meta: [], google: [], tiktok: [], yandex: [], telegram: [], monochrome: [] }
    data.forEach((acc) => {
      if (acc.platform === 'meta') accounts.meta.push({ id: acc.id, name: acc.name })
      if (acc.platform === 'google') accounts.google.push({ id: acc.id, name: acc.name })
      if (acc.platform === 'tiktok') accounts.tiktok.push({ id: acc.id, name: acc.name })
      if (acc.platform === 'yandex') accounts.yandex.push({ id: acc.id, name: acc.name })
      if (acc.platform === 'telegram') accounts.telegram.push({ id: acc.id, name: acc.name })
      if (acc.platform === 'monochrome') accounts.monochrome.push({ id: acc.id, name: acc.name })
    })
    await fetchAccountRequests()
    syncOpenAccounts()
  } catch (e) {
    console.error(e)
  }
}

async function fetchTopups() {
  try {
    const res = await fetch(`${apiBase}/topups`, { headers: { ...authHeadersSafe() } })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load topups')
    const data = await res.json()
    state.topups = data
  } catch (e) {
    console.error(e)
  }
}

async function fetchAccountRequests() {
  try {
    const res = await fetch(`${apiBase}/account-requests`, { headers: { ...authHeadersSafe() } })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load account requests')
    const data = await res.json()
    state.accountRequests = data.map((row) => {
      let payload = row.payload
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch (e) {
          payload = {}
        }
      }
      const email =
        payload?.access?.[0]?.email ||
        payload?.mcc_email ||
        payload?.yandex_email ||
        payload?.telegram_channel ||
        ''
      return {
        id: row.id,
        platform: row.platform,
        name: row.name,
        email,
        status: normalizeRequestStatus(row.status),
        created_at: row.created_at,
        budget_total: row.budget_total ?? null,
        account_currency: row.account_currency || (row.platform === 'telegram' ? 'EUR' : 'USD'),
      }
    })
    syncOpenAccounts()
  } catch (e) {
    console.error(e)
  }
}

async function fetchFees() {
  try {
    const res = await fetch(`${apiBase}/fees`, { headers: { ...authHeadersSafe() } })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load fees')
    state.fees = await res.json()
  } catch (e) {
    state.fees = null
  }
}

function normalizeRequestStatus(status) {
  if (status === 'processing') return '� ������'
  if (status === 'approved') return '������'
  if (status === 'rejected') return '��������'
  return '�����'
}



