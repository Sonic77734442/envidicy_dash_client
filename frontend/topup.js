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
  eyebrow: 'Envidicy · Billing Desk',
  title: 'Пополнение рекламных аккаунтов',
  subtitle: 'Выберите аккаунт Meta, Google или TikTok, оставьте e-mail и данные компании для выставления счёта.',
  buttons: [
    { label: 'Дашборд', href: '/dashboard', kind: 'ghost' },
    { label: 'Финансы', href: '/funds', kind: 'ghost' },
    { label: 'Медиаплан', href: '/plan', kind: 'ghost' },
    { label: 'Вход', href: '/login', kind: 'ghost' },
  ],
})

const state = {
  openAccounts: [],
  accountRequests: [],
  topups: [],
  accountsFull: [],
  periodSpendByAccount: {},
  fees: null,
  walletBalanceKzt: null,
  openAccountsFilters: {
    dateFrom: '',
    dateTo: '',
    periodPreset: 'this_month',
    status: 'all',
    search: '',
    page: 1,
    pageSize: 5,
  },
}

let accounts = { meta: [], google: [], tiktok: [], yandex: [], telegram: [], monochrome: [] }
let bccRatesCache = { ts: 0, data: null }
const BCC_DEFAULT_MARKUP = 10
const SIDEBAR_RATES_PANEL_ID = 'sidebar-rates-panel'

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
    title: 'Яндекс Директ',
    subtitle: 'Поиск / РСЯ / Медийка',
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
  stepMetaInfo: document.getElementById('create-step-meta-info'),
  stepGoogleInfo: document.getElementById('create-step-google-info'),
  stepYandexInfo: document.getElementById('create-step-yandex-info'),
  stepTelegramInfo: document.getElementById('create-step-telegram-info'),
  stepMonochromeInfo: document.getElementById('create-step-monochrome-info'),
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
  accountName: document.getElementById('topup-target-account'),
  clientName: document.getElementById('topup-client-account'),
  clientCard: document.getElementById('topup-client-card'),
  clientBalanceKzt: document.getElementById('topup-client-balance-kzt'),
  clientBalanceFx: document.getElementById('topup-client-balance-fx'),
  accountCard: document.getElementById('topup-account-card'),
  targetBalanceFx: document.getElementById('topup-target-balance-fx'),
  targetBalanceKzt: document.getElementById('topup-target-balance-kzt'),
  budgetFx: document.getElementById('topup-budget-fx'),
  budget: document.getElementById('topup-budget'),
  rateHint: document.getElementById('topup-rate-hint'),
  fee: document.getElementById('fee-amount'),
  feeLabel: document.getElementById('fee-percent'),
  net: document.getElementById('net-amount'),
  accountAmount: document.getElementById('account-amount'),
  error: document.getElementById('topup-error'),
  feePercent: 10,
  vatPercent: 0,
  lastEdited: 'kzt',
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
    alert('Для доступа к кабинету нужно войти.')
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
      <button class="btn primary" data-platform="${p.key}">Открыть аккаунт</button>
    `
    container.appendChild(div)
  })
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-platform]')
    if (btn) openCreateModal(btn.dataset.platform)
  })
}

function formatRateValue(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMoneyAmount(value) {
  const n = Number(value || 0)
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getCurrentMonthPeriod() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return { dateFrom: `${y}-${m}-01`, dateTo: `${y}-${m}-${d}` }
}

function toIsoDate(value) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getPeriodFromPreset(preset) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === 'today') {
    const iso = toIsoDate(today)
    return { dateFrom: iso, dateTo: iso }
  }
  if (preset === '7d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { dateFrom: toIsoDate(from), dateTo: toIsoDate(today) }
  }
  if (preset === '30d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    return { dateFrom: toIsoDate(from), dateTo: toIsoDate(today) }
  }
  if (preset === 'prev_month') {
    const firstCurrent = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastPrev = new Date(firstCurrent)
    lastPrev.setDate(0)
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1)
    return { dateFrom: toIsoDate(firstPrev), dateTo: toIsoDate(lastPrev) }
  }
  return getCurrentMonthPeriod()
}

function withDefaultMarkup(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return null
  return Number(rate) + BCC_DEFAULT_MARKUP
}

function getMarkedRateByCode(code) {
  const rates = bccRatesCache.data?.rates
  if (!rates) return null
  return withDefaultMarkup(rates[String(code || '').toUpperCase()]?.sell)
}

function getAccountById(accountId) {
  return (state.accountsFull || []).find((acc) => String(acc.id) === String(accountId)) || null
}

function getTopupAccountAmount(row) {
  if (row?.amount_account != null) return Number(row.amount_account)
  if (row?.amount_net != null) return Number(row.amount_net)
  return Number(row?.amount_input || 0)
}

function getTopupFactByAccountId(accountId) {
  const id = String(accountId || '')
  if (!id) return null
  const rows = Array.isArray(state.topups) ? state.topups : []
  const matched = rows.filter((row) => String(row.account_id) === id)
  if (!matched.length) return null
  const total = matched.reduce((sum, row) => sum + Number(getTopupAccountAmount(row) || 0), 0)
  return Number.isFinite(total) ? total : null
}

function getAccountRate(account) {
  const rates = bccRatesCache.data?.rates
  if (!rates) return null
  const code = String(account?.currency || 'USD').toUpperCase()
  return rates[code] || rates.USD || null
}

function getEffectiveRate(account) {
  const row = getAccountRate(account)
  return withDefaultMarkup(row?.sell)
}

function setTopupError(message) {
  if (!topupModal.error) return
  if (!message) {
    topupModal.error.hidden = true
    topupModal.error.textContent = ''
    return
  }
  topupModal.error.hidden = false
  topupModal.error.textContent = message
}

function formatFxLinesFromKzt(kztAmount) {
  const usdRate = getMarkedRateByCode('USD')
  const eurRate = getMarkedRateByCode('EUR')
  const usd = usdRate ? Number(kztAmount || 0) / usdRate : null
  const eur = eurRate ? Number(kztAmount || 0) / eurRate : null
  return {
    usdText: usd == null ? 'USD: —' : `USD: ${formatMoneyAmount(usd)}`,
    eurText: eur == null ? 'EUR: —' : `EUR: ${formatMoneyAmount(eur)}`,
  }
}

function convertAmountToUsd(amount, currency) {
  const value = Number(amount || 0)
  if (!Number.isFinite(value)) return null
  const code = String(currency || 'USD').toUpperCase()
  if (code === 'USD') return value
  if (code === 'KZT') {
    const usdRate = getMarkedRateByCode('USD')
    return usdRate ? value / usdRate : null
  }
  if (code === 'EUR') {
    const eurRate = getMarkedRateByCode('EUR')
    const usdRate = getMarkedRateByCode('USD')
    if (!eurRate || !usdRate) return null
    return (value * eurRate) / usdRate
  }
  return value
}

function ensureSidebarRatesPanel() {
  const sidebar = document.querySelector('.sidebar')
  if (!sidebar) return null
  let panel = document.getElementById(SIDEBAR_RATES_PANEL_ID)
  if (panel) return panel
  panel = document.createElement('section')
  panel.id = SIDEBAR_RATES_PANEL_ID
  panel.className = 'sidebar-rates-panel'
  panel.innerHTML = `
    <div class="sidebar-rates-title">Курс пополнения</div>
    <div class="sidebar-rate-row" id="sidebar-rate-usd">USD: —</div>
    <div class="sidebar-rate-row" id="sidebar-rate-eur">EUR: —</div>
  `
  const nav = sidebar.querySelector('.nav')
  if (nav) nav.insertAdjacentElement('afterend', panel)
  else sidebar.appendChild(panel)
  return panel
}

function updateSidebarRatesPanel() {
  const data = bccRatesCache.data
  const panel = ensureSidebarRatesPanel()
  if (!panel) return
  const usdRow = panel.querySelector('#sidebar-rate-usd')
  const eurRow = panel.querySelector('#sidebar-rate-eur')
  if (!data || !data.rates || !usdRow || !eurRow) {
    if (usdRow) usdRow.textContent = 'USD: —'
    if (eurRow) eurRow.textContent = 'EUR: —'
    return
  }
  const usd = data.rates.USD
  const eur = data.rates.EUR
  const usdMarked = usd ? withDefaultMarkup(usd.sell) : null
  const eurMarked = eur ? withDefaultMarkup(eur.sell) : null
  usdRow.textContent = usdMarked == null ? 'USD: —' : `USD: ${formatRateValue(usdMarked)} ₸`
  eurRow.textContent = eurMarked == null ? 'EUR: —' : `EUR: ${formatRateValue(eurMarked)} ₸`
}

function updateTopupHeader() {
  const acc = getAccountById(topupModal.account.value)
  const currency = String(acc?.currency || 'USD').toUpperCase()
  const symbol = currency === 'EUR' ? '€' : '$'
  const walletBalance = Number(state.walletBalanceKzt || 0)
  const balanceLines = formatFxLinesFromKzt(walletBalance)
  if (topupModal.badge) topupModal.badge.textContent = 'Аккаунт'
  if (topupModal.accountName) topupModal.accountName.textContent = acc?.name || acc?.external_id || '—'
  if (topupModal.clientName) topupModal.clientName.textContent = 'ENVIDICY GROUP'
  if (topupModal.clientBalanceKzt) topupModal.clientBalanceKzt.textContent = `${formatMoneyAmount(walletBalance)} ₸`
  if (topupModal.clientBalanceFx) {
    topupModal.clientBalanceFx.innerHTML = `<span>${balanceLines.usdText}</span><span>${balanceLines.eurText}</span>`
  }
  if (topupModal.targetBalanceFx) topupModal.targetBalanceFx.textContent = `0.00 ${symbol}`
  if (topupModal.targetBalanceKzt) {
    topupModal.targetBalanceKzt.innerHTML = '<span>USD: 0.00</span><span>EUR: 0.00</span>'
  }
  topupModal.clientCard?.classList.remove('is-active', 'is-ok', 'is-fail')
  topupModal.accountCard?.classList.remove('is-active', 'is-ok', 'is-fail')
  if (topupModal.rateHint) {
    topupModal.rateHint.textContent = 'Сумма к зачислению на рекламный аккаунт'
  }
}

async function loadBccRates() {
  const now = Date.now()
  if (bccRatesCache.data && now - bccRatesCache.ts < 15 * 60 * 1000) {
    updateSidebarRatesPanel()
    updateTopupHeader()
    updateFee()
    return
  }
  try {
    const res = await fetch(`${apiBase}/rates/bcc`)
    if (!res.ok) throw new Error('rate fetch failed')
    const data = await res.json()
    bccRatesCache = { ts: now, data }
  } catch (e) {
    bccRatesCache = { ts: now, data: null }
  }
  updateSidebarRatesPanel()
  updateTopupHeader()
  updateFee()
}

function renderOpenAccounts() {
  const cardsRoot = document.getElementById('accounts-cards')
  const pageLabel = document.getElementById('accounts-page-label')
  const prevBtn = document.getElementById('accounts-prev')
  const nextBtn = document.getElementById('accounts-next')
  if (!cardsRoot) return
  cardsRoot.innerHTML = ''

  const filteredRows = getFilteredOpenAccounts()
  const pageSize = Number(state.openAccountsFilters.pageSize || 5)
  const total = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (state.openAccountsFilters.page > totalPages) state.openAccountsFilters.page = totalPages
  if (state.openAccountsFilters.page < 1) state.openAccountsFilters.page = 1
  const page = state.openAccountsFilters.page
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const rows = filteredRows.slice(start, end)

  if (!rows.length) {
    cardsRoot.innerHTML = '<div class="accounts-empty">По выбранным фильтрам ничего не найдено.</div>'
  }

  rows.forEach((row) => {
    const hasAccount = Boolean(row.account_db_id)
    const canTopup = hasAccount && row.can_topup !== false
    const card = document.createElement('article')
    card.className = 'account-status-card'
    const liveBillingLabel = formatLiveBillingCell(row.live_billing, row.currency)
    const platformLogo = platformLogoHtml(row.platform)
    card.innerHTML = `
      <div class="account-status-left">
        <div class="account-status-title-row">
          <div class="account-status-title-main">
            <span class="platform-logo platform-${row.platform}" title="${platformLabel(row.platform)}">${platformLogo}</span>
            <div class="account-status-name-wrap">
              <div class="account-status-name">${row.account_id}</div>
            </div>
          </div>
          <span class="status ${statusClass(row.status)}">${row.status}</span>
        </div>
        <div class="account-status-sub">
          <span>${platformLabel(row.platform)}</span>
          <span>${row.email || '—'}</span>
        </div>
      </div>
      <div class="account-status-metrics">
        <div class="account-metric">
          <div class="account-metric-label">ID аккаунта</div>
          <div class="account-metric-value account-metric-value-id">${row.account_ref || '—'}</div>
        </div>
        <div class="account-metric">
          <div class="account-metric-label">Пополнено (факт)</div>
          <div class="account-metric-value">${formatTopupFactCell(row)}</div>
        </div>
        <div class="account-metric">
          <div class="account-metric-label">Потрачено</div>
          <div class="account-metric-value">${liveBillingLabel}</div>
        </div>
        <div class="account-metric">
          <div class="account-metric-label">Потрачено за период</div>
          <div class="account-metric-value">${formatPeriodSpendCell(row)}</div>
        </div>
      </div>
      <div class="account-status-actions">
        ${
          hasAccount
            ? `
        ${
          canTopup
            ? `<button class="account-action-icon" data-tooltip="Пополнить" aria-label="Пополнить" data-topup="${row.account_db_id}" data-platform="${row.platform}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>`
            : ''
        }
        <button class="account-action-icon" data-tooltip="Статистика" aria-label="Статистика" data-stat="${row.account_db_id}" data-platform="${row.platform}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M7 16v-5M12 16V8M17 16v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="account-action-icon" data-tooltip="Обновить бюджет" aria-label="Обновить бюджет" data-refresh="${row.account_db_id}" data-platform="${row.platform}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0 2 5.3M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        `
            : `<span class="muted small">Ожидает открытия</span>`
        }
      </div>
    `
    cardsRoot.appendChild(card)
  })

  const fromLabel = total === 0 ? 0 : start + 1
  const toLabel = Math.min(end, total)
  if (pageLabel) pageLabel.textContent = `${fromLabel}-${toLabel} из ${total}`
  if (prevBtn) prevBtn.disabled = page <= 1
  if (nextBtn) nextBtn.disabled = page >= totalPages

  if (!cardsRoot.dataset.bound) {
    cardsRoot.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-topup]')
      if (btn) {
        const accId = btn.dataset.topup
        const platform = btn.dataset.platform
        openTopupModal(platform, accId)
      }
      const stat = e.target.closest('button[data-stat]')
      if (stat) {
        const accountId = stat.dataset.stat
        const platform = stat.dataset.platform
        const params = new URLSearchParams()
        if (platform) params.set('platform', platform)
        if (accountId) params.set('account_id', accountId)
        window.location.href = `/dashboard${params.toString() ? `?${params.toString()}` : ''}`
        return
      }
      const refresh = e.target.closest('button[data-refresh]')
      if (refresh) {
        refresh.disabled = true
        refresh.classList.add('is-loading')
        try {
          await refreshAccountLiveBilling(refresh.dataset.refresh)
        } catch (err) {
          const message = err?.message || 'Не удалось обновить данные по аккаунту.'
          alert(message)
        } finally {
          refresh.disabled = false
          refresh.classList.remove('is-loading')
        }
      }
    })
    cardsRoot.dataset.bound = '1'
  }
}

async function refreshAccountLiveBilling(accountId) {
  if (!accountId) return
  const res = await fetch(`${apiBase}/accounts/${accountId}/refresh-live-billing`, {
    method: 'POST',
    headers: { ...authHeadersSafe() },
  })
  if (handleAuthFailure(res)) return
  if (!res.ok) {
    let message = 'Не удалось обновить данные по аккаунту.'
    try {
      const data = await res.json()
      if (data?.detail) message = String(data.detail)
    } catch (e) {
      // ignore parse error
    }
    throw new Error(message)
  }
  const data = await res.json()
  const id = String(accountId)
  state.accountsFull = (state.accountsFull || []).map((acc) =>
    String(acc.id) === id ? { ...acc, live_billing: data.live_billing || null } : acc
  )
  syncOpenAccounts()
}

async function fetchPeriodSpend() {
  const { dateFrom, dateTo } = state.openAccountsFilters
  if (!dateFrom || !dateTo) {
    renderOpenAccounts()
    return
  }
  if (dateFrom > dateTo) {
    state.periodSpendByAccount = {}
    renderOpenAccounts()
    return
  }
  if (!Array.isArray(state.accountsFull) || state.accountsFull.length === 0) {
    state.periodSpendByAccount = {}
    renderOpenAccounts()
    return
  }
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  try {
    state.periodSpendByAccount = Object.fromEntries(
      (state.accountsFull || []).map((acc) => [String(acc.id), { loading: true }])
    )
    renderOpenAccounts()
    const res = await fetch(`${apiBase}/accounts/spend?${params.toString()}`, {
      headers: { ...authHeadersSafe() },
    })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load period spend')
    const data = await res.json()
    const mapped = {}
    for (const item of data.items || []) {
      mapped[String(item.account_id)] = {
        spend: item.spend,
        currency: item.currency,
        error: item.error || null,
      }
    }
    state.periodSpendByAccount = mapped
  } catch (e) {
    state.periodSpendByAccount = {}
    console.error(e)
  } finally {
    renderOpenAccounts()
  }
}

function mapStatusFilter(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'активен' || value === 'открыт') return 'open'
  if (value === 'на модерации' || value === 'в работе' || value === 'новая') return 'processing'
  if (value === 'закрыт' || value === 'отклонен' || value === 'заблокирован') return 'closed'
  return 'all'
}

function platformLogoHtml(platform) {
  if (platform === 'google') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>'
  }
  if (platform === 'meta') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24,12.073c0,5.989-4.394,10.954-10.13,11.855v-8.363h2.789l0.531-3.46H13.87V8.716c0-0.947,0.464-1.869,1.958-1.869h1.513V3.949c0,0-1.37-0.234-2.679-0.234c-2.734,0-4.52,1.657-4.52,4.656v2.637H7.091v3.46h3.039v8.363C4.395,23.025,0,18.061,0,12.073c0-6.627,5.373-12,12-12S24,5.446,24,12.073z"/></svg>'
  }
  if (platform === 'tiktok') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#000000" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>'
  }
  if (platform === 'telegram') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#0088CC" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.4-1.08.39-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .39z"/></svg>'
  }
  if (platform === 'yandex') return 'Y'
  if (platform === 'monochrome') return 'MC'
  return 'AD'
}

function getFilteredOpenAccounts() {
  const filters = state.openAccountsFilters
  const q = String(filters.search || '').trim().toLowerCase()
  return state.openAccounts.filter((row) => {
    if (mapStatusFilter(row.status) === 'closed') return false
    if (filters.status !== 'all' && mapStatusFilter(row.status) !== filters.status) return false
    if (q) {
      const haystack = [
        row.account_id,
        row.account_ref,
        row.email,
        row.company,
        platformLabel(row.platform),
        row.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

function attachDatePickerBehavior(input) {
  if (!input) return
  input.setAttribute('inputmode', 'none')
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') return
    e.preventDefault()
  })
  input.addEventListener('paste', (e) => e.preventDefault())
  const openPicker = () => {
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
      } catch (e) {
        // no-op: some browsers restrict showPicker by gesture context
      }
    }
  }
  input.addEventListener('focus', openPicker)
  input.addEventListener('click', openPicker)
}

function bindOpenAccountsControls() {
  const periodPreset = document.getElementById('accounts-period-preset')
  const dateFrom = document.getElementById('accounts-date-from')
  const dateTo = document.getElementById('accounts-date-to')
  const status = document.getElementById('accounts-status-filter')
  const search = document.getElementById('accounts-search')
  const prevBtn = document.getElementById('accounts-prev')
  const nextBtn = document.getElementById('accounts-next')

  if (!state.openAccountsFilters.dateFrom || !state.openAccountsFilters.dateTo) {
    const period = getPeriodFromPreset(state.openAccountsFilters.periodPreset || 'this_month')
    state.openAccountsFilters.dateFrom = period.dateFrom
    state.openAccountsFilters.dateTo = period.dateTo
  }

  if (periodPreset) {
    periodPreset.value = state.openAccountsFilters.periodPreset || 'this_month'
    periodPreset.addEventListener('change', () => {
      const preset = periodPreset.value || 'this_month'
      state.openAccountsFilters.periodPreset = preset
      if (preset !== 'custom') {
        const period = getPeriodFromPreset(preset)
        state.openAccountsFilters.dateFrom = period.dateFrom
        state.openAccountsFilters.dateTo = period.dateTo
        if (dateFrom) dateFrom.value = period.dateFrom
        if (dateTo) dateTo.value = period.dateTo
      }
      fetchPeriodSpend()
    })
  }

  if (dateFrom) {
    attachDatePickerBehavior(dateFrom)
    dateFrom.value = state.openAccountsFilters.dateFrom
    dateFrom.addEventListener('change', () => {
      state.openAccountsFilters.dateFrom = dateFrom.value
      state.openAccountsFilters.periodPreset = 'custom'
      if (periodPreset) periodPreset.value = 'custom'
      fetchPeriodSpend()
    })
  }
  if (dateTo) {
    attachDatePickerBehavior(dateTo)
    dateTo.value = state.openAccountsFilters.dateTo
    dateTo.addEventListener('change', () => {
      state.openAccountsFilters.dateTo = dateTo.value
      state.openAccountsFilters.periodPreset = 'custom'
      if (periodPreset) periodPreset.value = 'custom'
      fetchPeriodSpend()
    })
  }
  if (status) {
    status.addEventListener('change', () => {
      state.openAccountsFilters.status = status.value
      state.openAccountsFilters.page = 1
      renderOpenAccounts()
    })
  }
  if (search) {
    search.addEventListener('input', () => {
      state.openAccountsFilters.search = search.value
      state.openAccountsFilters.page = 1
      renderOpenAccounts()
    })
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.openAccountsFilters.page <= 1) return
      state.openAccountsFilters.page -= 1
      renderOpenAccounts()
    })
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      state.openAccountsFilters.page += 1
      renderOpenAccounts()
    })
  }
}

function formatLiveBillingCell(liveBilling, fallbackCurrency) {
  if (!liveBilling) return '—'
  if (liveBilling.error) return `<span class="muted small" title="${String(liveBilling.error)}">Ошибка API</span>`
  const currency = liveBilling.currency || fallbackCurrency || ''
  const spend = extractLiveSpend(liveBilling)
  if (spend == null) return '<span class="muted small">Нет данных</span>'
  return `${formatMoneyAmount(spend)} ${currency}`
}

function extractLiveSpend(liveBilling) {
  if (!liveBilling || typeof liveBilling !== 'object') return null
  const candidates = [
    liveBilling.spend,
    liveBilling.spent,
    liveBilling.amount_spent,
    liveBilling.total_spent,
    liveBilling.total_spend,
    liveBilling.metrics?.spend,
    liveBilling.data?.spend,
  ]
  for (const item of candidates) {
    const num = Number(item)
    if (Number.isFinite(num)) return num
  }
  return null
}

function formatPeriodSpendCell(row) {
  if (!row?.account_db_id) return '<span class="muted small">—</span>'
  const key = String(row.account_db_id)
  const item = state.periodSpendByAccount[key]
  if (!item) return '<span class="muted small">—</span>'
  if (item.loading) return '<span class="muted small">Загрузка...</span>'
  if (item.error) return '<span class="muted small">Ошибка API</span>'
  const spend = Number(item.spend)
  if (!Number.isFinite(spend)) return '<span class="muted small">Нет данных</span>'
  return `${formatMoneyAmount(spend)} ${item.currency || row.currency || ''}`
}

function formatTopupFactCell(row) {
  if (!row?.account_db_id) return '<span class="muted small">—</span>'
  const total = getTopupFactByAccountId(row.account_db_id)
  if (total == null) return '<span class="muted small">Нет пополнений</span>'
  return `${formatMoneyAmount(total)} ${row.currency || ''}`
}

function normalizeAccountStatus(status) {
  if (!status) return 'На модерации'
  if (status === 'pending') return 'На модерации'
  if (status === 'active') return 'Активен'
  if (status === 'paused') return 'Приостановлен'
  if (status === 'archived') return 'Закрыт'
  return status
}

function statusClass(status) {
  if (status === 'Новая') return 'status-paused'
  if (status === 'В работе') return 'status-warn'
  if (status === 'Открыт') return 'status-active'
  if (status === 'Отклонен') return 'status-blocked'
  if (status === 'На модерации') return 'status-warn'
  if (status === 'Активен') return 'status-active'
  if (status === 'Приостановлен') return 'status-paused'
  if (status === 'Заблокирован') return 'status-blocked'
  if (status === 'Закрыт') return 'status-closed'
  return ''
}

function syncOpenAccounts() {
  const accountIndex = new Map()
  const accountRows = (state.accountsFull || []).map((acc) => {
    const key = `${acc.platform}:${acc.name}`
    accountIndex.set(key, acc.id)
    const normalizedStatus = normalizeAccountStatus(acc.status)
    return {
      platform: acc.platform,
      account_id: acc.name || acc.external_id || `Аккаунт #${acc.id}`,
      account_ref: acc.external_id || acc.account_code || acc.id,
      account_db_id: acc.id,
      created_at: acc.created_at || null,
      live_billing: acc.live_billing || null,
      company: '',
      email: '—',
      budget: acc.budget_total ?? null,
      currency: acc.currency || (acc.platform === 'telegram' ? 'EUR' : 'USD'),
      status: normalizedStatus,
      can_topup: normalizedStatus !== 'Закрыт',
    }
  })

  const requestRows = (state.accountRequests || [])
    .map((req) => {
      const accountDbId = accountIndex.get(`${req.platform}:${req.name}`) || null
      return {
        platform: req.platform,
        account_id: req.name || `Заявка #${req.id}`,
        account_ref: req.external_id || req.account_code || null,
        account_db_id: accountDbId,
        company: '',
        email: req.email || '—',
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
  createModal.title.textContent = `Открыть · ${platformLabel(platformKey)}`
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
    alert('Нет доступных аккаунтов для пополнения. Дождитесь открытия аккаунта.')
    return
  }
  const feeVal = state.fees ? state.fees[platformKey] : null
  topupModal.feePercent = feeVal == null ? null : Number(feeVal)
  const list = accounts[platformKey]
  const selected = accountId || (list[0] ? list[0].id : '')
  topupModal.account.value = selected
  topupModal.lastEdited = 'kzt'
  setTopupError('')
  topupModal.el.classList.add('show')
  topupModal.el.dataset.platform = platformKey
  updateTopupHeader()
  updateFee()
  loadBccRates()
  loadTopupWalletBalance()
}

function closeTopupModal() {
  topupModal.el.classList.remove('show')
  topupModal.budget.value = ''
  if (topupModal.budgetFx) topupModal.budgetFx.value = ''
  setTopupError('')
  updateFee()
}

function platformLabel(key) {
  if (key === 'meta') return 'Meta'
  if (key === 'google') return 'Google Ads'
  if (key === 'tiktok') return 'TikTok Ads'
  if (key === 'yandex') return 'Яндекс Директ'
  if (key === 'telegram') return 'Telegram Ads'
  if (key === 'monochrome') return 'Monochrome'
  return key
}

function setCreateStep(step) {
  createState.step = step
  createModal.stepMcc.hidden = step !== 'mcc'
  createModal.stepTiktokInfo.hidden = step !== 'tiktok-info'
  createModal.stepMetaInfo.hidden = true
  createModal.stepGoogleInfo.hidden = true
  createModal.stepYandexInfo.hidden = true
  createModal.stepTelegramInfo.hidden = true
  createModal.stepMonochromeInfo.hidden = true
  createModal.stepAccount.hidden = step !== 'account'
  createModal.actions.style.display = step === 'account' ? 'flex' : 'none'
  const platformKey = createModal.el.dataset.platform || 'google'
  updateCreatePlatformUI(platformKey)
  if (step === 'mcc') {
    createModal.title.textContent = 'Открыть MCC'
  } else if (step === 'tiktok-info') {
    createModal.title.textContent = 'TikTok Business Center'
  } else {
    createModal.title.textContent = `Открыть · ${platformLabel(platformKey)}`
  }
}

function updateCreatePlatformUI(platformKey) {
  const isMeta = platformKey === 'meta'
  const isGoogle = platformKey === 'google'
  const isTiktok = platformKey === 'tiktok'
  const isYandex = platformKey === 'yandex'
  const isTelegram = platformKey === 'telegram'
  const isMonochrome = platformKey === 'monochrome'
  createModal.metaFields.hidden = !isMeta
  createModal.accessBlock.hidden = !isGoogle
  createModal.tiktokFields.hidden = !isTiktok
  createModal.yandexFields.hidden = !isYandex
  createModal.telegramFields.hidden = !isTelegram
  createModal.stepMcc.hidden = !(isGoogle && createState.step === 'mcc')
  createModal.stepTiktokInfo.hidden = !isTiktok || createState.step !== 'tiktok-info'
  createModal.stepMetaInfo.hidden = !isMeta || createState.step !== 'account'
  createModal.stepGoogleInfo.hidden = !isGoogle || createState.step !== 'account'
  createModal.stepYandexInfo.hidden = !isYandex || createState.step !== 'account'
  createModal.stepTelegramInfo.hidden = !isTelegram || createState.step !== 'account'
  createModal.stepMonochromeInfo.hidden = !isMonochrome || createState.step !== 'account'
  createModal.nameLabel.textContent = isMeta ? 'Название кабинета' : 'Введите название аккаунта'
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
            <div class="muted small">${item.role === 'read' ? 'Только чтение' : 'Стандартный доступ'}</div>
          </div>
          <button class="btn ghost small" type="button" data-remove="${index}">Убрать</button>
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
          <button class="btn ghost small" type="button" data-remove-id="${index}">Убрать</button>
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
      alert('Введите e-mail для доступа в MCC.')
      return
    }
    createState.mccSent = true
    createModal.notice.textContent = `Доступ в MCC отправлен на ${email}.`
    createModal.notice.hidden = false
    setCreateStep('account')
  }
  createModal.accessAdd.onclick = () => {
    const email = createModal.accessEmail.value.trim()
    const role = createModal.accessRole.value
    if (!email) {
      alert('Введите e-mail для доступа.')
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
      alert('Введите TikTok Business ID.')
      return
    }
    if (createState.tiktokIds.length >= 10) {
      alert('Можно добавить до 10 Business ID.')
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
    if (window.showGlobalLoading) window.showGlobalLoading('Отправляем заявку...')
    const platform = createModal.el.dataset.platform
    const name = createModal.name.value.trim()
    const website = createModal.website.value.trim()
    if (!name) {
      alert('Введите название аккаунта.')
      return
    }
    if (platform === 'meta') {
      const required = [
        { value: createModal.bmId.value.trim(), label: 'ID Business Manager Facebook' },
        { value: createModal.geo.value.trim(), label: 'ГЕО запуска рекламы' },
        { value: createModal.facebookPage.value.trim(), label: 'Страница Фейсбук' },
        { value: createModal.instagramPage.value.trim(), label: 'Страница Инстаграм' },
      ]
      if (createModal.finalAdvertiser.value === 'no' && createState.metaStage !== 'final') {
        const missingPrimary = required.find((item) => !item.value)
        if (missingPrimary) {
          alert(`Заполните поле: ${missingPrimary.label}.`)
          return
        }
        createState.metaStage = 'final'
        updateMetaStage()
        return
      }
      if (createModal.finalAdvertiser.value === 'no') {
        required.push(
          { value: createModal.finalName.value.trim(), label: 'Наименование конечного рекламодателя' },
          { value: createModal.finalCountry.value.trim(), label: 'Страна конечного рекламодателя' },
          { value: createModal.finalTaxId.value.trim(), label: 'Номер налогоплательщика конечного рекламодателя' },
          { value: createModal.finalAddress.value.trim(), label: 'Адрес конечного рекламодателя' },
          { value: createModal.finalOwnership.value.trim(), label: 'Форма собственности конечного рекламодателя' }
        )
      }
      const missing = required.find((item) => !item.value)
      if (missing) {
        alert(`Заполните поле: ${missing.label}.`)
        return
      }
    }
    if (platform === 'tiktok') {
      if (!createState.tiktokIds.length) {
        alert('Добавьте хотя бы один TikTok Business ID.')
        return
      }
      if (!createModal.tiktokTimezone.value.trim()) {
        alert('Укажите часовой пояс.')
        return
      }
      if (!createModal.tiktokGeo.value.trim()) {
        alert('Укажите географию.')
        return
      }
    }
    if (platform === 'yandex') {
      if (!createModal.yandexEmail.value.trim()) {
        alert('Укажите mail почтового клиента Яндекс.')
        return
      }
    }
    if (platform === 'telegram') {
      if (!createModal.telegramChannel.value.trim()) {
        alert('Укажите ссылку на Telegram-канал.')
        return
      }
    }
    if (!website) {
      alert('Укажите ссылку на сайт.')
      return
    }
    if ((platform === 'google' || platform === 'telegram' || platform === 'monochrome') && !createState.access.length) {
      alert('Добавьте хотя бы один e-mail для доступа.')
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
      alert('Заявка отправлена. Мы свяжемся с вами после обработки.')
      closeCreateModal()
    } catch (e) {
      alert('Ошибка отправки. Попробуйте снова.')
    } finally {
      if (window.hideGlobalLoading) window.hideGlobalLoading()
    }
  }

  document.getElementById('topup-close').onclick = closeTopupModal
  document.getElementById('topup-cancel').onclick = closeTopupModal
  document.getElementById('topup-submit').onclick = async () => {
    if (window.showGlobalLoading) window.showGlobalLoading('Создаем заявку на пополнение...')
    if (!topupModal.account.value) {
      setTopupError('Выберите аккаунт для пополнения.')
      return
    }
    if (topupModal.feePercent == null) {
      setTopupError('Комиссия для этой платформы не задана. Обратитесь к администратору.')
      return
    }
    setTopupError('')
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
        let message = 'Ошибка отправки. Попробуйте снова.'
        try {
          const data = await res.json()
          if (data?.detail) message = data.detail
        } catch (e) {
          // ignore parse error
        }
        setTopupError(message)
        return
      }
      const data = await res.json()
      await fetchTopups()
      setTopupError('')
      closeTopupModal()
    } catch (e) {
      setTopupError('Ошибка отправки. Попробуйте снова.')
    } finally {
      if (window.hideGlobalLoading) window.hideGlobalLoading()
    }
  }

  topupModal.budget.addEventListener('input', () => {
    topupModal.lastEdited = 'kzt'
    setTopupError('')
    updateFee()
  })
  if (topupModal.budgetFx) {
    topupModal.budgetFx.addEventListener('input', () => {
      topupModal.lastEdited = 'fx'
      setTopupError('')
      updateFee()
    })
  }
}

function updateFee() {
  const acc = getAccountById(topupModal.account.value)
  const currency = String(acc?.currency || 'USD').toUpperCase()
  const symbol = currency === 'EUR' ? '€' : '$'
  const rate = getEffectiveRate(acc)
  let amt = topupModal.budget.value ? Number(topupModal.budget.value) : 0
  let fxAmt = topupModal.budgetFx && topupModal.budgetFx.value ? Number(topupModal.budgetFx.value) : 0
  if (rate) {
    if (topupModal.lastEdited === 'fx') {
      amt = fxAmt * rate
      topupModal.budget.value = amt > 0 ? amt.toFixed(2) : ''
    } else {
      fxAmt = amt / rate
      if (topupModal.budgetFx) topupModal.budgetFx.value = fxAmt > 0 ? fxAmt.toFixed(2) : ''
    }
  }
  const feePct = topupModal.feePercent == null ? 0 : topupModal.feePercent
  const fee = amt * (feePct / 100)
  const vat = amt * (topupModal.vatPercent / 100)
  const gross = amt + fee + vat
  const feeFx = rate ? fee / rate : 0
  const grossFx = rate ? gross / rate : 0
  const targetLines = formatFxLinesFromKzt(amt)
  if (topupModal.feeLabel) {
    topupModal.feeLabel.textContent = topupModal.feePercent == null ? '—' : String(feePct)
  }
  topupModal.fee.textContent = `${formatMoneyAmount(feeFx)} ${symbol} (${formatMoneyAmount(fee)} ₸)`
  topupModal.net.textContent = `${formatMoneyAmount(grossFx)} ${symbol} (${formatMoneyAmount(gross)} ₸)`
  topupModal.accountAmount.textContent = `${formatMoneyAmount(fxAmt)} ${symbol} (${formatMoneyAmount(amt)} ₸)`
  if (topupModal.targetBalanceFx) topupModal.targetBalanceFx.textContent = `${formatMoneyAmount(fxAmt)} ${symbol}`
  if (topupModal.targetBalanceKzt) {
    topupModal.targetBalanceKzt.innerHTML = `<span>${targetLines.usdText}</span><span>${targetLines.eurText}</span>`
  }
  const walletBalance = Number(state.walletBalanceKzt || 0)
  topupModal.clientCard?.classList.remove('is-active', 'is-ok', 'is-fail')
  topupModal.accountCard?.classList.remove('is-active', 'is-ok', 'is-fail')
  if (amt > 0) {
    topupModal.clientCard?.classList.add('is-active')
    topupModal.accountCard?.classList.add('is-active')
    if (state.walletBalanceKzt != null) {
      topupModal.clientCard?.classList.add(gross <= walletBalance ? 'is-ok' : 'is-fail')
      topupModal.accountCard?.classList.add(gross <= walletBalance ? 'is-ok' : 'is-fail')
    }
  }
}

function init() {
  ensureSidebarRatesPanel()
  renderCards()
  bindOpenAccountsControls()
  renderOpenAccounts()
  bindModal()
  loadBccRates()
  fetchFees()
  fetchAccounts()
  fetchTopups()
  fetchAccountRequests()
  loadTopupWalletBalance()
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
      const row = {
        id: acc.id,
        name: acc.name,
        currency: acc.currency || (acc.platform === 'telegram' ? 'EUR' : 'USD'),
        budget_total: acc.budget_total || 0,
        external_id: acc.external_id || null,
      }
      if (String(acc.status || '').toLowerCase() === 'archived') return
      if (acc.platform === 'meta') accounts.meta.push(row)
      if (acc.platform === 'google') accounts.google.push(row)
      if (acc.platform === 'tiktok') accounts.tiktok.push(row)
      if (acc.platform === 'yandex') accounts.yandex.push(row)
      if (acc.platform === 'telegram') accounts.telegram.push(row)
      if (acc.platform === 'monochrome') accounts.monochrome.push(row)
    })
    await fetchPeriodSpend()
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
    syncOpenAccounts()
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

async function loadTopupWalletBalance() {
  try {
    const res = await fetch(`${apiBase}/wallet`, { headers: { ...authHeadersSafe() } })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load wallet')
    const data = await res.json()
    state.walletBalanceKzt = Number(data.balance || 0)
  } catch (e) {
    state.walletBalanceKzt = null
  } finally {
    updateTopupHeader()
    updateFee()
  }
}

function normalizeRequestStatus(status) {
  if (status === 'processing') return 'В работе'
  if (status === 'approved') return 'Открыт'
  if (status === 'rejected') return 'Отклонен'
  return 'Новая'
}
