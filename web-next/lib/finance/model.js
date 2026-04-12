export function currencyPrefix(currency) {
  const code = String(currency || 'USD').toUpperCase()
  if (code === 'USD') return '$'
  if (code === 'EUR') return '€'
  if (code === 'KZT') return '₸'
  return ''
}

export function formatMoney(value, currency = 'USD', digits = 2) {
  const amount = Number(value || 0)
  const sign = amount < 0 ? '-' : ''
  const code = String(currency || 'USD').toUpperCase()
  const prefix = currencyPrefix(code)
  const abs = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  if (prefix) return `${sign}${prefix}${abs}`
  return `${sign}${abs} ${code}`.trim()
}

export function platformLabel(platform) {
  const key = String(platform || '').toLowerCase()
  if (key === 'meta') return 'Meta'
  if (key === 'google') return 'Google Ads'
  if (key === 'tiktok') return 'TikTok Ads'
  if (key === 'yandex') return 'Yandex Direct'
  if (key === 'telegram') return 'Telegram Ads'
  if (key === 'monochrome') return 'Monochrome'
  return platform || 'Unknown'
}

export function accountDisplayCurrency(platform, currency) {
  const key = String(platform || '').toLowerCase()
  if (key === 'yandex') return 'KZT'
  if (key === 'telegram') return 'EUR'
  return String(currency || 'USD').toUpperCase()
}

export function getAccountStatusKey(status) {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return 'pending'
  if (['new', 'processing', 'requested', 'pending'].includes(value)) return 'pending'
  if (value === 'active' || value === 'approved') return 'active'
  if (value === 'paused') return 'paused'
  if (['archived', 'closed', 'rejected'].includes(value)) return 'closed'
  return value
}

export function normalizeAccountStatus(status, locale = 'en') {
  const key = getAccountStatusKey(status)
  if (locale === 'ru') {
    if (key === 'active') return 'Активен'
    if (key === 'pending') return 'На модерации'
    if (key === 'paused') return 'Приостановлен'
    if (key === 'closed') return 'Закрыт'
    return String(status || 'На модерации')
  }

  if (key === 'active') return 'Active'
  if (key === 'pending') return 'Pending Setup'
  if (key === 'paused') return 'Paused'
  if (key === 'closed') return 'Closed'
  return String(status || 'Pending Setup')
}

export function getMarkedRate(entry) {
  const marked = Number(entry?.sell_marked)
  if (Number.isFinite(marked)) return marked
  const sell = Number(entry?.sell)
  if (Number.isFinite(sell)) return sell
  return null
}

export function getAllowedInputCurrencies(accountCurrency) {
  const code = String(accountCurrency || 'USD').toUpperCase()
  if (code === 'KZT') return ['KZT']
  return [code, 'KZT']
}

export function getRateForCurrency(currency, rates) {
  const code = String(currency || '').toUpperCase()
  if (!code || code === 'KZT') return 1
  const rate = Number(rates?.[code])
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

export function getWalletHints(balanceKzt, rates) {
  const amount = Number(balanceKzt || 0)
  const usd = getRateForCurrency('USD', rates)
  const eur = getRateForCurrency('EUR', rates)
  return {
    usd: usd ? amount / usd : null,
    eur: eur ? amount / eur : null,
  }
}

export function getWalletAvailableBalance(wallet) {
  const balance = Number(wallet?.available_balance ?? wallet?.balance ?? 0)
  return Number.isFinite(balance) ? balance : 0
}

export function buildWalletBalanceHint(wallet, ratesPayload) {
  const reserved = Number(wallet?.reserved_balance || 0)
  if (reserved > 0) return `${formatMoney(reserved, wallet?.currency || 'USD', 2)} reserved`

  const currency = String(wallet?.currency || 'USD').toUpperCase()
  if (currency !== 'KZT') return 'Ready for allocation'

  const balance = getWalletAvailableBalance(wallet)
  const usdRate = getMarkedRate(ratesPayload?.rates?.USD)
  const eurRate = getMarkedRate(ratesPayload?.rates?.EUR)
  if (balance > 0 && usdRate && eurRate) {
    return `≈ ${formatMoney(balance / usdRate, 'USD', 2)} · ${formatMoney(balance / eurRate, 'EUR', 2)}`
  }
  return 'Ready for allocation'
}

export function sumOverviewSpend(payload) {
  const totals = payload?.totals || {}
  return ['meta', 'google', 'tiktok'].reduce((sum, key) => sum + Number(totals?.[key]?.spend || 0), 0)
}

export function extractLiveSpend(liveBilling) {
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

export function extractLiveBalance(liveBilling) {
  if (!liveBilling || typeof liveBilling !== 'object') return null
  const candidates = [
    liveBilling.balance,
    liveBilling.available_balance,
    liveBilling.cash_balance,
    liveBilling.valid_cash_balance,
    liveBilling.remain_cash,
  ]
  for (const item of candidates) {
    const num = Number(item)
    if (Number.isFinite(num)) return num
  }
  return null
}

export function extractLiveLimit(liveBilling) {
  if (!liveBilling || typeof liveBilling !== 'object') return null
  const candidates = [
    liveBilling.limit,
    liveBilling.credit_limit,
    liveBilling.total_limit,
    liveBilling.metrics?.limit,
    liveBilling.data?.limit,
  ]
  for (const item of candidates) {
    const num = Number(item)
    if (Number.isFinite(num)) return num
  }
  return null
}

export function summarizeLiveBilling(liveBilling, fallbackCurrency) {
  if (!liveBilling) {
    return {
      available: false,
      currency: fallbackCurrency || '',
      spend: null,
      balance: null,
      limit: null,
      label: 'No data',
    }
  }
  if (liveBilling.error) {
    return {
      available: false,
      currency: fallbackCurrency || '',
      spend: null,
      balance: null,
      limit: null,
      label: 'API error',
    }
  }

  const currency = String(liveBilling.currency || fallbackCurrency || '').toUpperCase()
  const spend = extractLiveSpend(liveBilling)
  const balance = extractLiveBalance(liveBilling)
  const limit = extractLiveLimit(liveBilling)

  let label = 'No data'
  if (spend != null && limit != null) {
    label = `${formatMoney(spend, currency, 2)} / ${formatMoney(limit, currency, 2)}`
  } else if (spend != null) {
    label = formatMoney(spend, currency, 2)
  } else if (balance != null) {
    label = formatMoney(balance, currency, 2)
  } else if (limit != null) {
    label = formatMoney(limit, currency, 2)
  }

  return {
    available: spend != null || balance != null || limit != null,
    currency,
    spend,
    balance,
    limit,
    label,
  }
}

export function normalizeAccountRecord(row, options = {}) {
  const locale = options.locale || 'en'
  const displayCurrency = accountDisplayCurrency(row?.platform, row?.currency)
  const statusKey = getAccountStatusKey(row?.status)
  const statusLabel = normalizeAccountStatus(row?.status, locale)
  const liveBillingSummary = summarizeLiveBilling(row?.live_billing, displayCurrency)

  return {
    ...row,
    platform: row?.platform || '',
    platform_label: platformLabel(row?.platform),
    currency: row?.currency || '',
    display_currency: displayCurrency,
    status: row?.status || '',
    status_key: statusKey,
    status_label: statusLabel,
    live_billing: row?.live_billing || null,
    live_billing_summary: liveBillingSummary,
  }
}

export function getTopupStatusKey(row) {
  return String(row?.status || '').toLowerCase()
}

export function isCompletedTopup(row) {
  return getTopupStatusKey(row) === 'completed'
}

export function getTopupAccountCurrency(row) {
  const inputCurrency = String(row?.currency || 'KZT').toUpperCase()
  const accountCurrency = String(row?.account_currency || inputCurrency || 'USD').toUpperCase()
  const fxRate = Number(row?.fx_rate || 0)
  if (inputCurrency !== accountCurrency && !(Number.isFinite(fxRate) && fxRate > 0)) return inputCurrency
  return accountCurrency
}

export function getTopupNetAccountFunding(row) {
  const amountAccount = Number(row?.amount_account)
  if (Number.isFinite(amountAccount) && amountAccount > 0) return amountAccount
  const amountNet = Number(row?.amount_net)
  if (Number.isFinite(amountNet) && amountNet > 0) return amountNet
  const amountInput = Number(row?.amount_input)
  if (Number.isFinite(amountInput) && amountInput > 0) return amountInput
  return 0
}

export function getTopupAccountFundingUsd(row) {
  const usd = Number(row?.amount_account_usd)
  if (Number.isFinite(usd) && usd > 0) return usd
  const net = getTopupNetAccountFunding(row)
  const accountCurrency = getTopupAccountCurrency(row)
  const fxRate = Number(row?.fx_rate || 0)
  if (accountCurrency === 'USD' && net > 0) return net
  if (accountCurrency === 'KZT' && net > 0 && Number.isFinite(fxRate) && fxRate > 0) return net / fxRate
  const input = Number(row?.amount_input || 0)
  if (Number.isFinite(input) && input > 0 && Number.isFinite(fxRate) && fxRate > 0) return input / fxRate
  return 0
}

export function getTopupAccountFundingKzt(row) {
  const kzt = Number(row?.amount_account_kzt)
  if (Number.isFinite(kzt) && kzt > 0) return kzt
  const net = getTopupNetAccountFunding(row)
  const accountCurrency = getTopupAccountCurrency(row)
  const fxRate = Number(row?.fx_rate || 0)
  if (accountCurrency === 'KZT' && net > 0) return net
  if (accountCurrency !== 'KZT' && net > 0 && Number.isFinite(fxRate) && fxRate > 0) return net * fxRate
  const input = Number(row?.amount_input || 0)
  return Number.isFinite(input) && input > 0 ? input : 0
}

export function getTopupBreakdown(row) {
  const inputCurrency = String(row?.currency || 'KZT').toUpperCase()
  const inputAmount = Number(row?.amount_input || 0)
  const accountCurrency = getTopupAccountCurrency(row)
  const netAccountFunding = getTopupNetAccountFunding(row)
  const fxRate = Number(row?.fx_rate || 0)
  const feePercent = Number(row?.fee_percent || 0)
  const vatPercent = Number(row?.vat_percent || 0)
  const feeAmount = inputAmount * (feePercent / 100)
  const vatAmount = inputAmount * (vatPercent / 100)
  const totalWalletDebit = inputAmount + feeAmount + vatAmount

  return {
    inputCurrency,
    inputAmount,
    accountCurrency,
    netAccountFunding,
    feePercent,
    feeAmount,
    vatPercent,
    vatAmount,
    totalWalletDebit,
    fxRate: Number.isFinite(fxRate) && fxRate > 0 ? fxRate : null,
    accountFundingUsd: getTopupAccountFundingUsd(row),
    accountFundingKzt: getTopupAccountFundingKzt(row),
  }
}

export function aggregateCompletedFundingByAccount(topups) {
  const totals = new Map()
  for (const row of topups || []) {
    if (!isCompletedTopup(row) || !row?.account_id) continue
    const key = String(row.account_id)
    const bucket = totals.get(key) || { amount: 0, amountUsd: 0, amountKzt: 0 }
    bucket.amount += getTopupNetAccountFunding(row)
    bucket.amountUsd += getTopupAccountFundingUsd(row)
    bucket.amountKzt += getTopupAccountFundingKzt(row)
    totals.set(key, bucket)
  }
  return totals
}

export function calculateFundingPreview({
  amount,
  inputCurrency,
  accountCurrency,
  rates,
  feePercent = 0,
  vatPercent = 0,
}) {
  const value = Number(amount || 0)
  const normalizedAmount = Number.isFinite(value) && value > 0 ? value : 0
  const inputCode = String(inputCurrency || 'KZT').toUpperCase()
  const accountCode = String(accountCurrency || 'USD').toUpperCase()
  const allowedInputCurrencies = getAllowedInputCurrencies(accountCode)
  const isSupportedInput = allowedInputCurrencies.includes(inputCode)
  const accountRate = getRateForCurrency(accountCode, rates)
  const needsRate = accountCode !== 'KZT'
  const missingRate = needsRate && !accountRate

  let fundingAmountKzt = 0
  let fundingAmountAccount = 0

  if (!missingRate && isSupportedInput && normalizedAmount > 0) {
    if (inputCode === 'KZT') {
      fundingAmountKzt = normalizedAmount
      fundingAmountAccount = accountCode === 'KZT' ? normalizedAmount : normalizedAmount / accountRate
    } else if (inputCode === accountCode) {
      fundingAmountAccount = normalizedAmount
      fundingAmountKzt = accountCode === 'KZT' ? normalizedAmount : normalizedAmount * accountRate
    }
  }

  const feeAmountKzt = fundingAmountKzt * (Number(feePercent || 0) / 100)
  const vatAmountKzt = fundingAmountKzt * (Number(vatPercent || 0) / 100)
  const totalWalletDebitKzt = fundingAmountKzt + feeAmountKzt + vatAmountKzt

  return {
    valid: isSupportedInput && !missingRate,
    missingRate,
    accountCurrency: accountCode,
    inputCurrency: inputCode,
    fundingAmountKzt,
    fundingAmountAccount,
    feePercent: Number(feePercent || 0),
    feeAmountKzt,
    vatPercent: Number(vatPercent || 0),
    vatAmountKzt,
    totalWalletDebitKzt,
    netAccountFunding: fundingAmountAccount,
    fxRate: accountCode === 'KZT' ? null : accountRate,
  }
}
