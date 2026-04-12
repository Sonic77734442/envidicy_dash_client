import {
  accountDisplayCurrency,
  calculateFundingPreview,
  currencyPrefix,
  formatMoney,
  getAllowedInputCurrencies,
  getWalletHints,
  platformLabel,
} from '../finance/model'

export { accountDisplayCurrency, calculateFundingPreview, currencyPrefix, formatMoney, getAllowedInputCurrencies, getWalletHints, platformLabel }

export function formatEditableAmount(value, digits = 2) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount === 0) return ''
  return amount.toFixed(digits).replace(/\.?0+$/, '')
}
