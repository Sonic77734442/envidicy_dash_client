'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { clearAuth, getAuthToken } from '../../lib/auth'
import AppShell from '../../components/layout/AppShell'

const PAGE_SIZE = 5

const PLATFORMS = [
  { key: 'meta', title: 'Meta', subtitle: 'Facebook / Instagram', badge: 'ADS MANAGER' },
  { key: 'google', title: 'Google Ads', subtitle: 'Search / YouTube / Display', badge: 'ADS' },
  { key: 'tiktok', title: 'TikTok Ads', subtitle: 'For You / Video', badge: 'ADS' },
  { key: 'yandex', title: 'Яндекс Директ', subtitle: 'Поиск / РСЯ / Медийка', badge: 'ADS' },
  { key: 'telegram', title: 'Telegram Ads', subtitle: 'Channels / Bots / Search', badge: 'ADS' },
  { key: 'monochrome', title: 'Monochrome', subtitle: 'Programmatic', badge: 'ADS' },
]

const ONBOARDING_INFO = {
  meta: {
    title: 'Business Manager',
    text: 'Перед запуском нужен Business Manager.',
    linkLabel: 'Инструкция: создание Business Manager',
    link: '#',
  },
  google: {
    title: 'Google Ads и MCC',
    text: 'Перед запуском нужен аккаунт Google Ads и MCC.',
    linkLabel: 'Инструкция: создание Google Ads и MCC',
    link: '#',
  },
  yandex: {
    title: 'Яндекс Директ',
    text: 'Перед запуском нужен аккаунт Яндекс Директ.',
    linkLabel: 'Инструкция: создание Яндекс Директ',
    link: '#',
  },
  telegram: {
    title: 'Telegram Ads',
    text: 'Перед запуском нужен аккаунт Telegram Ads.',
    linkLabel: 'Инструкция: создание Telegram Ads',
    link: '#',
  },
  monochrome: {
    title: 'Programmatic',
    text: 'Перед запуском нужен Programmatic аккаунт.',
    linkLabel: 'Инструкция: создание Programmatic аккаунта',
    link: '#',
  },
  tiktok: {
    title: 'TikTok Business Center',
    text: 'Перед запуском нужен TikTok Business Center.',
    linkLabel: 'Инструкция: создание TikTok Business Center',
    link: 'https://ads.tiktok.com/help/article/create-tiktok-business-center?lang=ru',
  },
}

function money(v, d = 2) {
  return Number(v || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function getMarkedRate(entry) {
  const marked = Number(entry?.sell_marked)
  if (Number.isFinite(marked)) return marked
  const sell = Number(entry?.sell)
  if (Number.isFinite(sell)) return sell
  return null
}

function accountDisplayCurrency(platform, currency) {
  if (platform === 'yandex') return 'KZT'
  if (platform === 'telegram') return 'EUR'
  return currency || 'USD'
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

function platformLogoNode(platform) {
  if (platform === 'google') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
      </svg>
    )
  }
  if (platform === 'meta') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#1877F2" d="M24,12.073c0,5.989-4.394,10.954-10.13,11.855v-8.363h2.789l0.531-3.46H13.87V8.716c0-0.947,0.464-1.869,1.958-1.869h1.513V3.949c0,0-1.37-0.234-2.679-0.234c-2.734,0-4.52,1.657-4.52,4.656v2.637H7.091v3.46h3.039v8.363C4.395,23.025,0,18.061,0,12.073c0-6.627,5.373-12,12-12S24,5.446,24,12.073z" />
      </svg>
    )
  }
  if (platform === 'tiktok') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#000000" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    )
  }
  if (platform === 'telegram') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#0088CC" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.4-1.08.39-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .39z" />
      </svg>
    )
  }
  if (platform === 'yandex') return 'Y'
  if (platform === 'monochrome') return 'MC'
  return 'AD'
}

function datePickerProps() {
  return {
    inputMode: 'none',
    onKeyDown: (e) => {
      if (e.key !== 'Tab') e.preventDefault()
    },
    onPaste: (e) => e.preventDefault(),
    onFocus: (e) => e.currentTarget.showPicker?.(),
    onClick: (e) => e.currentTarget.showPicker?.(),
  }
}

function normalizeAccountStatus(status) {
  if (!status) return 'На модерации'
  if (status === 'pending') return 'На модерации'
  if (status === 'active') return 'Активен'
  if (status === 'paused') return 'Приостановлен'
  if (status === 'archived') return 'Закрыт'
  return status
}

function normalizeRequestStatus(status) {
  if (status === 'processing') return 'В работе'
  if (status === 'approved') return 'Открыт'
  if (status === 'rejected') return 'Отклонен'
  return 'Новая'
}

function mapStatusFilter(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'активен' || value === 'открыт') return 'open'
  if (value === 'на модерации' || value === 'в работе' || value === 'новая') return 'processing'
  if (value === 'закрыт' || value === 'отклонен' || value === 'заблокирован') return 'closed'
  return 'all'
}

function statusClass(status) {
  if (status === 'Новая') return 'status-paused'
  if (status === 'В работе') return 'status-warn'
  if (status === 'Открыт' || status === 'Активен') return 'status-active'
  if (status === 'На модерации') return 'status-warn'
  if (status === 'Приостановлен') return 'status-paused'
  if (status === 'Заблокирован') return 'status-blocked'
  if (status === 'Отклонен' || status === 'Закрыт') return 'status-closed'
  return ''
}

function statusHint(status) {
  if (status === 'Новая') return 'Новая заявка, аккаунт еще не обработан.'
  if (status === 'В работе') return 'Заявка в обработке, ожидаются действия менеджера.'
  if (status === 'Открыт' || status === 'Активен') return 'Аккаунт активен и доступен для пополнения.'
  if (status === 'На модерации') return 'Аккаунт проходит проверку площадки.'
  if (status === 'Приостановлен') return 'Аккаунт временно приостановлен.'
  if (status === 'Заблокирован') return 'Аккаунт ограничен площадкой.'
  if (status === 'Отклонен' || status === 'Закрыт') return 'Аккаунт недоступен для работы.'
  return String(status || 'Статус аккаунта')
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

function formatLiveBillingCell(liveBilling, fallbackCurrency) {
  if (!liveBilling) return '—'
  if (liveBilling.error) return 'Ошибка API'
  const currency = liveBilling.currency || fallbackCurrency || ''
  const spend = extractLiveSpend(liveBilling)
  if (spend == null) return 'Нет данных'
  return `${money(spend)} ${currency}`
}

function getPeriodFromPreset(preset) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const minus = (d) => {
    const x = new Date(now)
    x.setDate(x.getDate() - d)
    return x.toISOString().slice(0, 10)
  }

  if (preset === 'today') return { dateFrom: today, dateTo: today }
  if (preset === '7d') return { dateFrom: minus(6), dateTo: today }
  if (preset === '30d') return { dateFrom: minus(29), dateTo: today }
  if (preset === 'prev_month') return { dateFrom: startPrevMonth.toISOString().slice(0, 10), dateTo: endPrevMonth.toISOString().slice(0, 10) }
  return { dateFrom: startOfMonth.toISOString().slice(0, 10), dateTo: today }
}

function formatFxLinesFromKzt(kztAmount, usdRate, eurRate) {
  const usd = usdRate ? Number(kztAmount || 0) / usdRate : null
  const eur = eurRate ? Number(kztAmount || 0) / eurRate : null
  return {
    usdText: usd == null ? 'USD: —' : `USD: ${money(usd)}`,
    eurText: eur == null ? 'EUR: —' : `EUR: ${money(eur)}`,
  }
}

export default function TopupPage() {
  const router = useRouter()

  const [accountsFull, setAccountsFull] = useState([])
  const [fundingTotals, setFundingTotals] = useState([])
  const [accountRequests, setAccountRequests] = useState([])
  const [fees, setFees] = useState(null)
  const [walletKzt, setWalletKzt] = useState(0)
  const [rates, setRates] = useState({ USD: null, EUR: null })
  const [periodSpendByAccount, setPeriodSpendByAccount] = useState({})

  const [filters, setFilters] = useState(() => ({
    periodPreset: 'this_month',
    ...getPeriodFromPreset('this_month'),
    status: 'all',
    search: '',
    page: 1,
  }))

  const [status, setStatus] = useState('Загрузка данных...')

  const [createOpen, setCreateOpen] = useState(false)
  const [createPlatform, setCreatePlatform] = useState('google')
  const [createStep, setCreateStep] = useState('account')
  const [createStatus, setCreateStatus] = useState('')
  const [createState, setCreateState] = useState({
    mccSent: false,
    metaStage: 'primary',
    access: [],
    tiktokIds: [],
    mccEmail: '',
    name: '',
    bmId: '',
    geo: '',
    facebookPage: '',
    instagramPage: '',
    finalAdvertiser: 'yes',
    finalName: '',
    finalCountry: '',
    finalTaxId: '',
    finalAddress: '',
    finalOwnership: '',
    yandexEmail: '',
    telegramChannel: '',
    tiktokIdInput: '',
    tiktokTimezone: '',
    tiktokGeo: '',
    website: '',
    app: '',
    accessEmail: '',
    accessRole: 'standard',
  })

  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAccountId, setTopupAccountId] = useState('')
  const [topupPlatform, setTopupPlatform] = useState('google')
  const [topupFx, setTopupFx] = useState('')
  const [topupKzt, setTopupKzt] = useState('')
  const [topupLastEdited, setTopupLastEdited] = useState('kzt')
  const [topupSubmitStatus, setTopupSubmitStatus] = useState('')
  const [refreshingAccountId, setRefreshingAccountId] = useState('')

  const accountsByPlatform = useMemo(() => {
    const out = { meta: [], google: [], tiktok: [], yandex: [], telegram: [], monochrome: [] }
    accountsFull.forEach((acc) => {
      if (String(acc.status || '').toLowerCase() === 'archived') return
      if (!out[acc.platform]) out[acc.platform] = []
      out[acc.platform].push(acc)
    })
    return out
  }, [accountsFull])

  const topupAccount = useMemo(
    () => accountsFull.find((a) => String(a.id) === String(topupAccountId)) || null,
    [accountsFull, topupAccountId]
  )

  const selectedCurrency = String(topupAccount?.currency || 'USD').toUpperCase()
  const selectedSymbol = selectedCurrency === 'EUR' ? '€' : '$'
  const selectedRate = selectedCurrency === 'EUR' ? rates.EUR : rates.USD
  const topupFeePercent = Number((fees && fees[String(topupPlatform || '').toLowerCase()]) ?? 0)

  const amountKzt = Number(topupKzt || 0)
  const amountFx = Number(topupFx || 0)

  const calc = useMemo(() => {
    let kzt = Number(topupKzt || 0)
    let fx = Number(topupFx || 0)
    const rate = selectedRate

    if (rate) {
      if (topupLastEdited === 'fx') {
        kzt = fx * rate
      } else {
        fx = kzt / rate
      }
    }

    const fee = kzt * (topupFeePercent / 100)
    const gross = kzt + fee
    const feeFx = rate ? fee / rate : 0
    const grossFx = rate ? gross / rate : 0

    return { kzt, fx, fee, gross, feeFx, grossFx }
  }, [topupKzt, topupFx, topupLastEdited, selectedRate, topupFeePercent])

  const clientFxLines = useMemo(() => formatFxLinesFromKzt(walletKzt, rates.USD, rates.EUR), [walletKzt, rates])
  const targetFxLines = useMemo(() => formatFxLinesFromKzt(calc.kzt, rates.USD, rates.EUR), [calc.kzt, rates])

  async function safeFetch(path, options = {}) {
    const res = await apiFetch(path, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    return res
  }

  async function loadAll() {
    setStatus('Загрузка данных...')
    try {
      const [accountsRes, fundingTotalsRes, feesRes, walletRes, ratesRes, requestsRes] = await Promise.all([
        safeFetch('/accounts'),
        safeFetch('/accounts/funding-totals'),
        safeFetch('/fees'),
        safeFetch('/wallet'),
        apiFetch('/rates/bcc'),
        safeFetch('/account-requests'),
      ])

      if (!accountsRes.ok) {
        const err = await accountsRes.json().catch(() => ({}))
        throw new Error(err?.detail || `Ошибка загрузки аккаунтов (${accountsRes.status})`)
      }

      const accountsData = await accountsRes.json()
      const fundingTotalsData = fundingTotalsRes.ok ? await fundingTotalsRes.json() : { items: [] }
      const feesData = feesRes.ok ? await feesRes.json() : null
      const walletData = walletRes.ok ? await walletRes.json() : { balance: 0 }
      const ratesData = ratesRes.ok ? await ratesRes.json() : { rates: {} }
      const requestsData = requestsRes.ok ? await requestsRes.json() : []

      setAccountsFull(Array.isArray(accountsData) ? accountsData : [])
      setFundingTotals(Array.isArray(fundingTotalsData?.items) ? fundingTotalsData.items : [])
      setFees(feesData || null)
      setWalletKzt(Number(walletData?.balance || 0))
      setRates({
        USD: getMarkedRate(ratesData?.rates?.USD),
        EUR: getMarkedRate(ratesData?.rates?.EUR),
      })
      setAccountRequests(Array.isArray(requestsData) ? requestsData : [])

      setStatus('Данные обновлены.')
    } catch (e) {
      setStatus(e?.message || 'Ошибка загрузки данных.')
    }
  }

  async function refreshAccountLiveBilling(id) {
    if (!id) return
    const res = await safeFetch(`/accounts/${id}/refresh-live-billing`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.detail || 'Не удалось обновить данные по аккаунту')
    }
    const data = await res.json()
    setAccountsFull((prev) => prev.map((a) => (String(a.id) === String(id) ? { ...a, live_billing: data.live_billing || null } : a)))
  }

  async function fetchPeriodSpend(dateFrom, dateTo) {
    if (!dateFrom || !dateTo || dateFrom > dateTo || !accountsFull.length) {
      setPeriodSpendByAccount({})
      return
    }
    try {
      const loading = Object.fromEntries(accountsFull.map((acc) => [String(acc.id), { loading: true }]))
      setPeriodSpendByAccount(loading)
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      const res = await safeFetch(`/accounts/spend?${params.toString()}`)
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
      setPeriodSpendByAccount(mapped)
    } catch {
      setPeriodSpendByAccount({})
    }
  }

  const topupFactByAccountId = useMemo(() => {
    const map = new Map()
    fundingTotals.forEach((row) => {
      const key = String(row?.account_id || '')
      if (!key) return
      map.set(key, Number(row?.amount || 0))
    })
    return map
  }, [fundingTotals])

  const openAccounts = useMemo(() => {
    const index = new Map()
    const accountRows = accountsFull.map((acc) => {
      const key = `${acc.platform}:${acc.name}`
      index.set(key, acc.id)
      const normalizedStatus = normalizeAccountStatus(acc.status)
      return {
        platform: acc.platform,
        account_id: acc.name || acc.external_id || `Аккаунт #${acc.id}`,
        account_ref: acc.external_id || acc.account_code || acc.id,
        account_db_id: acc.id,
        created_at: acc.created_at || null,
        live_billing: acc.live_billing || null,
        email: '—',
        currency: accountDisplayCurrency(acc.platform, acc.currency),
        status: normalizedStatus,
      }
    })

    const reqRows = accountRequests
      .map((row) => {
        let payload = row.payload
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload)
          } catch {
            payload = {}
          }
        }
        const accountDbId = index.get(`${row.platform}:${row.name}`) || null
        return {
          platform: row.platform,
          account_id: row.name || `Заявка #${row.id}`,
          account_ref: row.external_id || row.account_code || null,
          account_db_id: accountDbId,
          email: payload?.access?.[0]?.email || payload?.mcc_email || payload?.yandex_email || payload?.telegram_channel || '',
          currency: accountDisplayCurrency(row.platform, row.account_currency),
          status: normalizeRequestStatus(row.status),
        }
      })
      .filter((x) => !x.account_db_id)

    return [...accountRows, ...reqRows]
  }, [accountsFull, accountRequests])

  const filteredOpenAccounts = useMemo(() => {
    const q = String(filters.search || '').trim().toLowerCase()
    return openAccounts.filter((row) => {
      if (mapStatusFilter(row.status) === 'closed') return false
      if (filters.status !== 'all' && mapStatusFilter(row.status) !== filters.status) return false
      if (q) {
        const haystack = [row.account_id, row.account_ref, row.email, platformLabel(row.platform), row.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [openAccounts, filters])

  const pagedOpenAccounts = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredOpenAccounts.length / PAGE_SIZE))
    const page = Math.min(Math.max(1, filters.page), totalPages)
    const start = (page - 1) * PAGE_SIZE
    return {
      page,
      totalPages,
      total: filteredOpenAccounts.length,
      from: filteredOpenAccounts.length ? start + 1 : 0,
      to: Math.min(start + PAGE_SIZE, filteredOpenAccounts.length),
      rows: filteredOpenAccounts.slice(start, start + PAGE_SIZE),
    }
  }, [filteredOpenAccounts, filters.page])

  function formatTopupFactCell(row) {
    if (!row?.account_db_id) return '—'
    const total = topupFactByAccountId.get(String(row.account_db_id))
    if (total == null) return 'Нет пополнений'
    return `${money(total)} ${row.currency || ''}`
  }

  function formatPeriodSpendCell(row) {
    if (!row?.account_db_id) return '—'
    const item = periodSpendByAccount[String(row.account_db_id)]
    if (!item) return '—'
    if (item.loading) return 'Загрузка...'
    if (item.error) return 'Ошибка API'
    const spend = Number(item.spend)
    if (!Number.isFinite(spend)) return 'Нет данных'
    return `${money(spend)} ${item.currency || row.currency || ''}`
  }

  function openCreateModal(platformKey) {
    setCreatePlatform(platformKey)
    setCreateStatus('')
    setCreateState((s) => ({ ...s, metaStage: 'primary', mccSent: false }))
    setCreateStep(`${platformKey}-info`)
    setCreateOpen(true)
  }

  function closeCreateModal() {
    setCreateOpen(false)
    setCreateStatus('')
    setCreateState({
      mccSent: false,
      metaStage: 'primary',
      access: [],
      tiktokIds: [],
      mccEmail: '',
      name: '',
      bmId: '',
      geo: '',
      facebookPage: '',
      instagramPage: '',
      finalAdvertiser: 'yes',
      finalName: '',
      finalCountry: '',
      finalTaxId: '',
      finalAddress: '',
      finalOwnership: '',
      yandexEmail: '',
      telegramChannel: '',
      tiktokIdInput: '',
      tiktokTimezone: '',
      tiktokGeo: '',
      website: '',
      app: '',
      accessEmail: '',
      accessRole: 'standard',
    })
  }

  function addAccess() {
    const email = createState.accessEmail.trim()
    if (!email) {
      setCreateStatus('Введите e-mail для доступа.')
      return
    }
    setCreateState((s) => ({ ...s, access: [...s.access, { email, role: s.accessRole }], accessEmail: '' }))
    setCreateStatus('')
  }

  function addTiktokId() {
    const value = createState.tiktokIdInput.trim()
    if (!value) {
      setCreateStatus('Введите TikTok Business ID.')
      return
    }
    if (createState.tiktokIds.length >= 10) {
      setCreateStatus('Можно добавить до 10 Business ID.')
      return
    }
    setCreateState((s) => ({ ...s, tiktokIds: [...s.tiktokIds, value], tiktokIdInput: '' }))
    setCreateStatus('')
  }

  async function submitCreateRequest() {
    setCreateStatus('')
    const platform = createPlatform
    const name = createState.name.trim()
    const website = createState.website.trim()

    if (!name) {
      setCreateStatus('Введите название аккаунта.')
      return
    }

    if (platform === 'meta') {
      if (!createState.bmId.trim() || !createState.geo.trim() || !createState.facebookPage.trim() || !createState.instagramPage.trim()) {
        setCreateStatus('Для Meta заполните BM ID, GEO, Facebook и Instagram.')
        return
      }
      if (createState.finalAdvertiser === 'no' && createState.metaStage !== 'final') {
        setCreateState((s) => ({ ...s, metaStage: 'final' }))
        return
      }
      if (createState.finalAdvertiser === 'no') {
        if (!createState.finalName.trim() || !createState.finalCountry.trim() || !createState.finalTaxId.trim() || !createState.finalAddress.trim() || !createState.finalOwnership.trim()) {
          setCreateStatus('Заполните данные конечного рекламодателя.')
          return
        }
      }
    }

    if (platform === 'tiktok') {
      if (!createState.tiktokIds.length || !createState.tiktokTimezone.trim() || !createState.tiktokGeo.trim()) {
        setCreateStatus('Для TikTok укажите Business ID, часовой пояс и географию.')
        return
      }
    }

    if (platform === 'yandex' && !createState.yandexEmail.trim()) {
      setCreateStatus('Укажите mail почтового клиента Яндекс.')
      return
    }

    if (platform === 'telegram' && !createState.telegramChannel.trim()) {
      setCreateStatus('Укажите ссылку на Telegram-канал.')
      return
    }

    if (!website) {
      setCreateStatus('Укажите ссылку на сайт.')
      return
    }

    if ((platform === 'google' || platform === 'telegram' || platform === 'monochrome') && !createState.access.length) {
      setCreateStatus('Добавьте хотя бы один e-mail для доступа.')
      return
    }

    const payload = {
      platform,
      name,
      external_id: null,
      currency: 'USD',
      website,
      app: createState.app.trim() || null,
      access: createState.access,
      mcc_email: createState.mccSent ? createState.mccEmail.trim() : null,
      business_manager_id: createState.bmId.trim() || null,
      geo: createState.geo.trim() || null,
      facebook_page: createState.facebookPage.trim() || null,
      instagram_page: createState.instagramPage.trim() || null,
      final_advertiser: createState.finalAdvertiser,
      final_name: createState.finalName.trim() || null,
      final_country: createState.finalCountry.trim() || null,
      final_tax_id: createState.finalTaxId.trim() || null,
      final_address: createState.finalAddress.trim() || null,
      final_ownership: createState.finalOwnership.trim() || null,
      tiktok_business_ids: createState.tiktokIds,
      tiktok_timezone: createState.tiktokTimezone.trim() || null,
      tiktok_geo: createState.tiktokGeo.trim() || null,
      yandex_email: createState.yandexEmail.trim() || null,
      telegram_channel: createState.telegramChannel.trim() || null,
    }

    setCreateStatus('Отправляем заявку...')
    try {
      const res = await safeFetch('/account-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: payload.platform, name: payload.name, payload }),
      })
      if (!res.ok) throw new Error('Ошибка отправки')
      await loadAll()
      closeCreateModal()
      alert('Заявка отправлена. Мы свяжемся с вами после обработки.')
    } catch (e) {
      setCreateStatus(e?.message || 'Ошибка отправки. Попробуйте снова.')
    }
  }

  function openTopupModal(platform, accountId) {
    const list = accountsByPlatform[platform] || []
    const selected = accountId || (list[0]?.id ? String(list[0].id) : '')
    if (!selected) {
      alert('Нет доступных аккаунтов для пополнения. Дождитесь открытия аккаунта.')
      return
    }
    setTopupPlatform(platform)
    setTopupAccountId(String(selected))
    setTopupKzt('')
    setTopupFx('')
    setTopupLastEdited('kzt')
    setTopupSubmitStatus('')
    setTopupOpen(true)
  }

  function closeTopupModal() {
    setTopupOpen(false)
    setTopupKzt('')
    setTopupFx('')
    setTopupSubmitStatus('')
  }

  async function submitTopupFromModal() {
    if (!topupAccountId) {
      setTopupSubmitStatus('Выберите аккаунт для пополнения.')
      return
    }
    if (calc.kzt <= 0) {
      setTopupSubmitStatus('Укажите сумму пополнения.')
      return
    }

    setTopupSubmitStatus('Создаем заявку...')
    try {
      const payload = {
        platform: topupPlatform,
        account_id: Number(topupAccountId),
        amount_input: calc.kzt,
        fee_percent: Number.isFinite(topupFeePercent) ? topupFeePercent : 0,
        vat_percent: 0,
      }
      const res = await safeFetch('/topups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Ошибка отправки')
      await loadAll()
      await fetchPeriodSpend(filters.dateFrom, filters.dateTo)
      closeTopupModal()
    } catch (e) {
      setTopupSubmitStatus(e?.message || 'Ошибка отправки')
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!accountsFull.length) return
    fetchPeriodSpend(filters.dateFrom, filters.dateTo)
  }, [accountsFull, filters.dateFrom, filters.dateTo])

  function updatePreset(preset) {
    if (preset === 'custom') {
      setFilters((s) => ({ ...s, periodPreset: 'custom', page: 1 }))
      return
    }
    const period = getPeriodFromPreset(preset)
    setFilters((s) => ({ ...s, periodPreset: preset, dateFrom: period.dateFrom, dateTo: period.dateTo, page: 1 }))
  }

  return (
    <AppShell
      eyebrow="Envidicy · Billing Desk"
      title="Пополнение рекламных аккаунтов"
      subtitle="Выберите площадку, оставьте данные и пополняйте через модальное окно."
    >
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Аккаунты</p>
            <h2>Выберите площадку</h2>
          </div>
          <span className="chip chip-ghost">Доступ по e-mail, счёт на юрлицо</span>
        </div>
        <div className="topup-list">
          {PLATFORMS.map((p) => (
            <div className="topup-card" key={p.key}>
              <div>
                <p className="eyebrow">{p.badge}</p>
                <h3>{p.title}</h3>
                <p className="muted small" style={{ marginTop: 4 }}>{p.subtitle}</p>
              </div>
              <button className="btn primary" type="button" onClick={() => openCreateModal(p.key)}>Открыть аккаунт</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Открытые аккаунты</p>
            <h2>Статусы заявок</h2>
          </div>
          <span className="chip chip-ghost">Обновляется после заявки</span>
        </div>

        <div className="accounts-toolbar">
          <select className="field-input" value={filters.periodPreset} onChange={(e) => updatePreset(e.target.value)}>
            <option value="today">Сегодня</option>
            <option value="7d">7 дней</option>
            <option value="30d">30 дней</option>
            <option value="this_month">Этот месяц</option>
            <option value="prev_month">Прошлый месяц</option>
            <option value="custom">Свой период</option>
          </select>
          <div className="accounts-date-range">
            <input className="field-input" type="date" value={filters.dateFrom} onChange={(e) => setFilters((s) => ({ ...s, periodPreset: 'custom', dateFrom: e.target.value, page: 1 }))} {...datePickerProps()} />
            <span className="muted small">—</span>
            <input className="field-input" type="date" value={filters.dateTo} onChange={(e) => setFilters((s) => ({ ...s, periodPreset: 'custom', dateTo: e.target.value, page: 1 }))} {...datePickerProps()} />
          </div>
          <select className="field-input" value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value, page: 1 }))}>
            <option value="all">Статус: Все</option>
            <option value="open">Статус: Открытые</option>
            <option value="processing">Статус: В работе</option>
          </select>
          <input className="field-input" type="search" placeholder="Поиск по фильтрам и названию" value={filters.search} onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value, page: 1 }))} />
        </div>

        <div className="accounts-cards" style={{ marginTop: 12 }}>
          {!pagedOpenAccounts.rows.length ? (
            <div className="accounts-empty">По выбранным фильтрам ничего не найдено.</div>
          ) : (
            pagedOpenAccounts.rows.map((row, idx) => {
              const hasAccount = Boolean(row.account_db_id)
              const canTopup = hasAccount
              return (
                <article className="account-status-card" key={`${row.platform}-${row.account_id}-${idx}`}>
                  <div className="account-status-left">
                    <div className="account-status-title-row">
                      <div className="account-status-title-main">
                        <span className={`platform-logo platform-${row.platform}`} title={platformLabel(row.platform)}>
                          {platformLogoNode(row.platform)}
                        </span>
                        <div className="account-status-name-wrap">
                          <div className="account-status-name">{row.account_id}</div>
                        </div>
                      </div>
                      <span className={`account-status-dot ${statusClass(row.status)}`} title={statusHint(row.status)} />
                    </div>
                    <div className="account-status-sub">
                      <span>{platformLabel(row.platform)}</span>
                      <span>{row.email || '—'}</span>
                    </div>
                  </div>

                  <div className="account-status-metrics">
                    <div className="account-metric">
                      <div className="account-metric-label">ID аккаунта</div>
                      <div className="account-metric-value account-metric-value-id">{row.account_ref || '—'}</div>
                    </div>
                    <div className="account-metric">
                      <div className="account-metric-label">Пополнено (факт)</div>
                      <div className="account-metric-value">{formatTopupFactCell(row)}</div>
                    </div>
                    <div className="account-metric">
                      <div className="account-metric-label">Потрачено</div>
                      <div className="account-metric-value">{formatLiveBillingCell(row.live_billing, row.currency)}</div>
                    </div>
                    <div className="account-metric">
                      <div className="account-metric-label">Потрачено за период</div>
                      <div className="account-metric-value">{formatPeriodSpendCell(row)}</div>
                    </div>
                  </div>

                  <div className="account-status-actions">
                    {hasAccount ? (
                      <>
                        {canTopup ? (
                          <button className="account-action-icon" title="Пополнить" type="button" onClick={() => openTopupModal(row.platform, row.account_db_id)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        ) : null}
                        <button className="account-action-icon" title="Статистика" type="button" onClick={() => router.push(`/dashboard?platform=${encodeURIComponent(row.platform)}&account_id=${encodeURIComponent(row.account_db_id)}`)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 18h16M7 16v-5M12 16V8M17 16v-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button
                          className={`account-action-icon ${refreshingAccountId === String(row.account_db_id) ? 'is-loading' : ''}`}
                          title="Обновить бюджет"
                          type="button"
                          disabled={refreshingAccountId === String(row.account_db_id)}
                          onClick={async () => {
                            setRefreshingAccountId(String(row.account_db_id))
                            try {
                              await refreshAccountLiveBilling(row.account_db_id)
                            } catch (e) {
                              alert(e?.message || 'Не удалось обновить данные по аккаунту.')
                            } finally {
                              setRefreshingAccountId('')
                            }
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20 11a8 8 0 1 0 2 5.3M20 4v7h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <span className="muted small">Ожидает открытия</span>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="accounts-pagination">
          <button className="btn ghost" type="button" disabled={pagedOpenAccounts.page <= 1} onClick={() => setFilters((s) => ({ ...s, page: Math.max(1, s.page - 1) }))}>Назад</button>
          <span className="muted small">{pagedOpenAccounts.from}-{pagedOpenAccounts.to} из {pagedOpenAccounts.total}</span>
          <button className="btn ghost" type="button" disabled={pagedOpenAccounts.page >= pagedOpenAccounts.totalPages} onClick={() => setFilters((s) => ({ ...s, page: s.page + 1 }))}>Далее</button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{status}</p>
      </section>

      {createOpen ? (
        <div className="modal show">
          <div className="modal-dialog">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Открыть аккаунт</p>
                <h3>
                  {createStep === 'mcc'
                    ? 'Открыть MCC'
                    : createStep.endsWith('-info')
                      ? (ONBOARDING_INFO[createPlatform]?.title || platformLabel(createPlatform))
                      : `Открыть · ${platformLabel(createPlatform)}`}
                </h3>
              </div>
              <button className="btn ghost small" onClick={closeCreateModal} type="button">Закрыть</button>
            </div>
            <div className="modal-body">
              {createStep.endsWith('-info') ? (
                <div className="modal-step">
                  <p className="muted small">{ONBOARDING_INFO[createPlatform]?.text || 'Перед запуском нужен аккаунт платформы.'}</p>
                  <a
                    className="link"
                    href={ONBOARDING_INFO[createPlatform]?.link || '#'}
                    target={ONBOARDING_INFO[createPlatform]?.link?.startsWith('http') ? '_blank' : undefined}
                    rel={ONBOARDING_INFO[createPlatform]?.link?.startsWith('http') ? 'noopener' : undefined}
                    onClick={(e) => {
                      if ((ONBOARDING_INFO[createPlatform]?.link || '#') === '#') e.preventDefault()
                    }}
                  >
                    {ONBOARDING_INFO[createPlatform]?.linkLabel || 'Инструкция'}
                  </a>
                  <div className="inline-actions">
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => setCreateStep(createPlatform === 'google' ? 'mcc' : 'account')}
                    >
                      Аккаунт есть
                    </button>
                  </div>
                </div>
              ) : null}

              {createStep === 'mcc' ? (
                <div className="modal-step">
                  <label className="field">
                    <span>Email для доступа в MCC</span>
                    <input value={createState.mccEmail} onChange={(e) => setCreateState((s) => ({ ...s, mccEmail: e.target.value }))} type="email" placeholder="user@company.com" />
                  </label>
                  <div className="inline-actions">
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => {
                        const email = createState.mccEmail.trim()
                        if (!email) {
                          setCreateStatus('Введите e-mail для доступа в MCC.')
                          return
                        }
                        setCreateState((s) => ({ ...s, mccSent: true }))
                        setCreateStatus(`Доступ в MCC отправлен на ${email}.`)
                        setCreateStep('account')
                      }}
                    >
                      Отправить доступ
                    </button>
                  </div>
                </div>
              ) : null}

              {createStep === 'account' ? (
                <div className="modal-step">
                  {createPlatform === 'meta' ? <p className="muted small">Перед запуском нужен Business Manager.</p> : null}
                  {createPlatform === 'google' ? <p className="muted small">Перед запуском нужен аккаунт Google Ads и MCC.</p> : null}
                  {createPlatform === 'yandex' ? <p className="muted small">Перед запуском нужен аккаунт Яндекс Директ.</p> : null}
                  {createPlatform === 'telegram' ? <p className="muted small">Перед запуском нужен аккаунт Telegram Ads.</p> : null}
                  {createPlatform === 'monochrome' ? <p className="muted small">Перед запуском нужен Programmatic аккаунт.</p> : null}

                  {createState.metaStage === 'primary' ? (
                    <>
                      <label className="field">
                        <span>Платформа</span>
                        <input value={platformLabel(createPlatform)} disabled />
                      </label>
                      <label className="field">
                        <span>{createPlatform === 'meta' ? 'Название кабинета' : 'Введите название аккаунта'}</span>
                        <input value={createState.name} onChange={(e) => setCreateState((s) => ({ ...s, name: e.target.value }))} type="text" placeholder="Brand Ads KZ" />
                      </label>

                      {createPlatform === 'meta' ? (
                        <>
                          <label className="field"><span>ID Business Manager Facebook</span><input value={createState.bmId} onChange={(e) => setCreateState((s) => ({ ...s, bmId: e.target.value }))} type="text" /></label>
                          <label className="field"><span>ГЕО запуска рекламы</span><input value={createState.geo} onChange={(e) => setCreateState((s) => ({ ...s, geo: e.target.value }))} type="text" /></label>
                          <label className="field"><span>Страница Фейсбук</span><input value={createState.facebookPage} onChange={(e) => setCreateState((s) => ({ ...s, facebookPage: e.target.value }))} type="url" /></label>
                          <label className="field"><span>Страница Инстаграм</span><input value={createState.instagramPage} onChange={(e) => setCreateState((s) => ({ ...s, instagramPage: e.target.value }))} type="url" /></label>
                          <label className="field">
                            <span>Вы конечный рекламодатель?</span>
                            <select value={createState.finalAdvertiser} onChange={(e) => setCreateState((s) => ({ ...s, finalAdvertiser: e.target.value }))}>
                              <option value="yes">Да</option>
                              <option value="no">Нет</option>
                            </select>
                          </label>
                        </>
                      ) : null}

                      {createPlatform === 'yandex' ? (
                        <label className="field"><span>Mail почтового клиента Яндекс</span><input value={createState.yandexEmail} onChange={(e) => setCreateState((s) => ({ ...s, yandexEmail: e.target.value }))} type="email" /></label>
                      ) : null}

                      {createPlatform === 'telegram' ? (
                        <label className="field"><span>Ссылка на Telegram-канал</span><input value={createState.telegramChannel} onChange={(e) => setCreateState((s) => ({ ...s, telegramChannel: e.target.value }))} type="url" /></label>
                      ) : null}

                      {createPlatform === 'tiktok' ? (
                        <>
                          <div className="field">
                            <span>TikTok Business ID (до 10)</span>
                            <div className="access-list">
                              {createState.tiktokIds.map((id, index) => (
                                <div className="access-item" key={`${id}-${index}`}>
                                  <div className="access-email">{id}</div>
                                  <button className="btn ghost small" type="button" onClick={() => setCreateState((s) => ({ ...s, tiktokIds: s.tiktokIds.filter((_, i) => i !== index) }))}>Убрать</button>
                                </div>
                              ))}
                            </div>
                            <div className="id-row">
                              <input value={createState.tiktokIdInput} onChange={(e) => setCreateState((s) => ({ ...s, tiktokIdInput: e.target.value }))} type="text" placeholder="1234567890" />
                              <button className="btn ghost small" type="button" onClick={addTiktokId}>Добавить</button>
                            </div>
                          </div>
                          <label className="field"><span>Часовой пояс</span><input value={createState.tiktokTimezone} onChange={(e) => setCreateState((s) => ({ ...s, tiktokTimezone: e.target.value }))} type="text" placeholder="Asia/Almaty" /></label>
                          <label className="field"><span>География (через запятую)</span><input value={createState.tiktokGeo} onChange={(e) => setCreateState((s) => ({ ...s, tiktokGeo: e.target.value }))} type="text" placeholder="Казахстан, Узбекистан" /></label>
                        </>
                      ) : null}

                      <label className="field"><span>Ссылка на сайт (обязательная строка)</span><input value={createState.website} onChange={(e) => setCreateState((s) => ({ ...s, website: e.target.value }))} type="url" placeholder="https://example.com" /></label>
                      <label className="field"><span>Ссылка на приложение</span><input value={createState.app} onChange={(e) => setCreateState((s) => ({ ...s, app: e.target.value }))} type="url" placeholder="https://apps.apple.com/app/..." /></label>

                      {(createPlatform === 'google' || createPlatform === 'telegram' || createPlatform === 'monochrome') ? (
                        <div className="field">
                          <span>Доступы по e-mail</span>
                          <div className="access-list">
                            {createState.access.map((item, index) => (
                              <div className="access-item" key={`${item.email}-${index}`}>
                                <div>
                                  <div className="access-email">{item.email}</div>
                                  <div className="muted small">{item.role === 'read' ? 'Только чтение' : 'Стандартный доступ'}</div>
                                </div>
                                <button className="btn ghost small" type="button" onClick={() => setCreateState((s) => ({ ...s, access: s.access.filter((_, i) => i !== index) }))}>Убрать</button>
                              </div>
                            ))}
                          </div>
                          <div className="access-row">
                            <input value={createState.accessEmail} onChange={(e) => setCreateState((s) => ({ ...s, accessEmail: e.target.value }))} type="email" placeholder="user@company.com" />
                            <select value={createState.accessRole} onChange={(e) => setCreateState((s) => ({ ...s, accessRole: e.target.value }))}>
                              <option value="standard">Стандартный доступ</option>
                              <option value="read">Только чтение</option>
                            </select>
                            <button className="btn ghost small" type="button" onClick={addAccess}>Добавить</button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {createPlatform === 'meta' && createState.metaStage === 'final' ? (
                    <div className="final-details">
                      <p className="muted small">Данные конечного рекламодателя</p>
                      <label className="field"><span>Наименование конечного рекламодателя</span><input value={createState.finalName} onChange={(e) => setCreateState((s) => ({ ...s, finalName: e.target.value }))} type="text" /></label>
                      <label className="field"><span>В какой стране находится конечный рекламодатель</span><input value={createState.finalCountry} onChange={(e) => setCreateState((s) => ({ ...s, finalCountry: e.target.value }))} type="text" /></label>
                      <label className="field"><span>Номер налогоплательщика конечного рекламодателя</span><input value={createState.finalTaxId} onChange={(e) => setCreateState((s) => ({ ...s, finalTaxId: e.target.value }))} type="text" /></label>
                      <label className="field"><span>Адрес конечного рекламодателя</span><input value={createState.finalAddress} onChange={(e) => setCreateState((s) => ({ ...s, finalAddress: e.target.value }))} type="text" /></label>
                      <label className="field"><span>Форма собственности конечного рекламодателя</span><input value={createState.finalOwnership} onChange={(e) => setCreateState((s) => ({ ...s, finalOwnership: e.target.value }))} type="text" /></label>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!createStep.endsWith('-info') && createStep !== 'mcc' && createStep !== 'account' ? (
                <div className="modal-step">
                  <p className="muted small">Шаг модалки не распознан. Переключаем на форму аккаунта.</p>
                  <div className="inline-actions">
                    <button className="btn primary" type="button" onClick={() => setCreateStep('account')}>
                      Продолжить
                    </button>
                  </div>
                </div>
              ) : null}

              {createStatus ? <div className={`notice${createStatus.includes('Ошибка') ? ' error' : ''}`}>{createStatus}</div> : null}
            </div>
            {createStep === 'account' ? (
              <div className="modal-actions">
                <button className="btn ghost" onClick={closeCreateModal} type="button">Отмена</button>
                <button className="btn primary" onClick={submitCreateRequest} type="button">Открыть</button>
              </div>
            ) : null}
            <p className="muted small">Мы отправим доступы по указанным e-mail и подготовим аккаунт к запуску.</p>
          </div>
        </div>
      ) : null}

      {topupOpen ? (
        <div className="modal show">
          <div className="modal-dialog topup-modal-dialog">
            <div className="topup-modal-head">
              <h3>Пополнение рекламного аккаунта</h3>
              <button className="topup-close" onClick={closeTopupModal} type="button" aria-label="Закрыть">×</button>
            </div>
            <div className="modal-body topup-modal-body">
              <div className="topup-balance-grid">
                <div className={`topup-balance-card ${calc.kzt > 0 ? (calc.gross <= walletKzt ? 'is-ok is-active' : 'is-fail is-active') : ''}`}>
                  <div className="topup-card-label">Клиент</div>
                  <div className="topup-card-name">ENVIDICY GROUP</div>
                  <div className="topup-card-amount-main">{money(walletKzt)} ₸</div>
                  <div className="topup-card-sub">Баланс</div>
                  <div className="topup-card-amount-sub"><span>{clientFxLines.usdText}</span><span>{clientFxLines.eurText}</span></div>
                </div>
                <div className="topup-transfer-arrow">→</div>
                <div className={`topup-balance-card ${calc.kzt > 0 ? (calc.gross <= walletKzt ? 'is-ok is-active' : 'is-fail is-active') : ''}`}>
                  <div className="topup-card-label">Аккаунт</div>
                  <div className="topup-card-name">{topupAccount?.name || topupAccount?.external_id || '—'}</div>
                  <div className="topup-card-amount-main">{money(calc.fx)} {selectedSymbol}</div>
                  <div className="topup-card-sub">К зачислению</div>
                  <div className="topup-card-amount-sub"><span>{targetFxLines.usdText}</span><span>{targetFxLines.eurText}</span></div>
                </div>
              </div>

              <div className="topup-rate-block">
                <div className="topup-rate-title">Сумма к зачислению на рекламный аккаунт</div>
                <p className="muted small">Курс применяется автоматически</p>
                <div className="topup-amount-row">
                  <label className="topup-currency-input">
                    <input
                      value={topupFx}
                      onChange={(e) => {
                        setTopupLastEdited('fx')
                        setTopupFx(e.target.value)
                        if (selectedRate) setTopupKzt(e.target.value ? String(Number(e.target.value || 0) * selectedRate) : '')
                      }}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                    <span>{selectedSymbol}</span>
                  </label>
                  <label className="topup-currency-input">
                    <input
                      value={topupKzt}
                      onChange={(e) => {
                        setTopupLastEdited('kzt')
                        setTopupKzt(e.target.value)
                        if (selectedRate) setTopupFx(e.target.value ? String(Number(e.target.value || 0) / selectedRate) : '')
                      }}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0.00"
                    />
                    <span>₸</span>
                  </label>
                </div>
              </div>

              <div className="topup-summary-row">
                <div>Комиссия {topupFeePercent || 0}%</div>
                <div>{money(calc.feeFx)} {selectedSymbol} ({money(calc.fee)} ₸)</div>
              </div>
              <div className="topup-total-row">
                <div>Итоговая сумма</div>
                <div id="net-amount">{money(calc.grossFx)} {selectedSymbol} ({money(calc.gross)} ₸)</div>
              </div>
              {topupSubmitStatus ? <div className="notice error">{topupSubmitStatus}</div> : null}
              <p className="muted small">На аккаунт сядет: {money(calc.fx)} {selectedSymbol} ({money(calc.kzt)} ₸)</p>
            </div>
            <div className="modal-actions topup-modal-actions">
              <button className="btn ghost" onClick={closeTopupModal} type="button">Отмена</button>
              <button className="btn primary" onClick={submitTopupFromModal} type="button">Пополнить</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
