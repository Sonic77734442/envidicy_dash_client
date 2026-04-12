'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'
import { calculateFundingPreview, formatEditableAmount, formatMoney } from '../../lib/client/funding'
import { useI18n } from '../../lib/i18n/client'

export default function FundingModal({ accountId, open, onClose, onSubmitted }) {
  const { tr } = useI18n()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [context, setContext] = useState(null)
  const [inputCurrency, setInputCurrency] = useState('KZT')
  const [amountInput, setAmountInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !accountId) return
    const token = getAuthToken()
    if (!token) {
      setContext(null)
      setLoading(false)
      setError(tr('Session expired. Please sign in again.', 'Сессия истекла. Войдите снова.'))
      return
    }

    let cancelled = false

    async function loadContext() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/client/funding?account_id=${encodeURIComponent(accountId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.detail || tr('Failed to load funding context', 'Не удалось загрузить контекст пополнения'))
        if (cancelled) return
        setContext(payload)
        setInputCurrency(payload?.funding?.defaultInputCurrency || 'KZT')
        setAmountInput('')
      } catch (e) {
        if (!cancelled) setError(e?.message || tr('Failed to load funding context', 'Не удалось загрузить контекст пополнения'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadContext()
    return () => {
      cancelled = true
    }
  }, [open, accountId])

  useEffect(() => {
    if (!open) {
      setContext(null)
      setAmountInput('')
      setInputCurrency('KZT')
      setError('')
      setSubmitting(false)
    }
  }, [open])

  const preview = useMemo(() => {
    if (!context) return null
    return calculateFundingPreview({
      amount: Number(amountInput || 0),
      inputCurrency,
      accountCurrency: context.account.currency,
      rates: context.funding.rates,
      feePercent: context.funding.feePercent,
      vatPercent: context.funding.vatPercent,
    })
  }, [context, inputCurrency, amountInput])

  const insufficientFunds = preview && context ? preview.totalWalletDebitKzt > Number(context.wallet.balance || 0) : false
  const canSubmit =
    Boolean(context) &&
    Boolean(preview?.valid) &&
    !preview?.missingRate &&
    Number(amountInput || 0) > 0 &&
    !insufficientFunds &&
    !submitting

  function handleCurrencyChange(nextCurrency) {
    if (!context || !preview) {
      setInputCurrency(nextCurrency)
      return
    }
    const nextAmount =
      nextCurrency === 'KZT'
        ? preview.fundingAmountKzt
        : nextCurrency === context.account.currency
          ? preview.fundingAmountAccount
          : 0
    setInputCurrency(nextCurrency)
    setAmountInput(formatEditableAmount(nextAmount))
  }

  async function handleSubmit() {
    const token = getAuthToken()
    if (!token) {
      setError(tr('Session expired. Please sign in again.', 'Сессия истекла. Войдите снова.'))
      return
    }
    if (!canSubmit) return

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/client/funding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          inputAmount: Number(amountInput || 0),
          inputCurrency,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.detail || tr('Failed to create top-up request', 'Не удалось создать запрос на пополнение'))
      if (onSubmitted) await onSubmitted(payload)
      onClose()
    } catch (e) {
      setError(e?.message || tr('Failed to create top-up request', 'Не удалось создать запрос на пополнение'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.fundingOverlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.fundingModal} role="dialog" aria-modal="true" aria-labelledby="funding-title">
        <div className={styles.fundingHeader}>
          <div>
            <p className={styles.fundingEyebrow}>{tr('Client Funding', 'Пополнение клиента')}</p>
            <h3 className={styles.fundingTitle} id="funding-title">
              {tr('Top Up Account', 'Пополнить аккаунт')}
            </h3>
            <p className={styles.fundingSubtitle}>
              {context?.account?.platformLabel || tr('Account', 'Аккаунт')} · {context?.account?.name || tr('Loading…', 'Загрузка…')}
            </p>
          </div>
          <button className={styles.fundingClose} onClick={onClose} type="button" aria-label={tr('Close', 'Закрыть')}>
            ×
          </button>
        </div>

        {loading ? (
          <div className={styles.fundingLoading}>{tr('Loading funding context…', 'Загрузка контекста пополнения…')}</div>
        ) : context ? (
          <>
            <div className={styles.fundingStage}>
              <article className={styles.fundingStageCard}>
                <span className={styles.fundingStageLabel}>{tr('Client Wallet', 'Кошелёк клиента')}</span>
                <strong className={styles.fundingStageValue}>{context.wallet.displayValue}</strong>
                <div className={styles.fundingStageMeta}>
                  {context.wallet.hints.usdLabel ? <span>{context.wallet.hints.usdLabel}</span> : null}
                  {context.wallet.hints.eurLabel ? <span>{context.wallet.hints.eurLabel}</span> : null}
                </div>
              </article>

              <div className={styles.fundingStageConnector}>
                <span>→</span>
              </div>

              <article className={styles.fundingStageCard}>
                <span className={styles.fundingStageLabel}>{tr('Ad Account', 'Рекламный аккаунт')}</span>
                <strong className={styles.fundingStageValue}>{context.account.currency}</strong>
                <div className={styles.fundingStageMeta}>
                  <span>{context.account.name}</span>
                  <span>{context.account.liveBalanceLabel ? `${tr('Live', 'Live')} ${context.account.liveBalanceLabel}` : tr('Ready for funding', 'Готов к пополнению')}</span>
                </div>
              </article>
            </div>

            <div className={styles.fundingInputShell}>
              <div className={styles.fundingInputHeader}>
                <div>
                  <span className={styles.fundingInputLabel}>{tr('Amount to top up', 'Сумма пополнения')}</span>
                  <p className={styles.fundingInputHint}>{tr('Choose the currency you want to enter. The rest is calculated automatically.', 'Выберите валюту ввода. Остальное рассчитается автоматически.')}</p>
                </div>
                {context.funding.allowedInputCurrencies.length > 1 ? (
                  <div className={styles.fundingCurrencyTabs}>
                    {context.funding.allowedInputCurrencies.map((item) => (
                      <button
                        className={item === inputCurrency ? styles.fundingCurrencyTabActive : styles.fundingCurrencyTab}
                        key={item}
                        onClick={() => handleCurrencyChange(item)}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.fundingCurrencyLock}>{context.funding.allowedInputCurrencies[0]}</div>
                )}
              </div>

              <div className={styles.fundingAmountRow}>
                <label className={styles.fundingAmountField}>
                  <input
                    className={styles.fundingAmountInput}
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setAmountInput(event.target.value)}
                    placeholder="0.00"
                    step={inputCurrency === 'KZT' ? '1' : '0.01'}
                    type="number"
                    value={amountInput}
                  />
                  <span className={styles.fundingAmountCurrency}>{inputCurrency}</span>
                </label>
                <div className={styles.fundingAmountMirror}>
                  <span>{inputCurrency === 'KZT' ? tr('Estimated account funding', 'Оценка зачисления на аккаунт') : tr('Estimated wallet debit', 'Оценка списания с кошелька')}</span>
                  <strong>
                    {inputCurrency === 'KZT'
                      ? formatMoney(preview?.fundingAmountAccount || 0, context.account.currency, 2)
                      : formatMoney(preview?.fundingAmountKzt || 0, 'KZT', 2)}
                  </strong>
                </div>
              </div>

              <div className={styles.fundingExplainStrip}>
                <span className={styles.fundingExplainDot}>i</span>
                <span>
                  {tr('Wallet debit', 'Списание с кошелька')} {formatMoney(preview?.totalWalletDebitKzt || 0, 'KZT', 2)} → {tr('account receives', 'зачисление на аккаунт')}{' '}
                  {formatMoney(preview?.netAccountFunding || 0, context.account.currency, 2)}
                </span>
              </div>
            </div>

            <div className={styles.fundingDetails}>
              <div className={styles.fundingDetailRow}>
                <span>{tr('FX Rate', 'FX курс')} ({context.account.currency}/KZT)</span>
                <strong>
                  {preview?.fxRate
                    ? Number(preview.fxRate).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                    : tr('Not required', 'Не требуется')}
                </strong>
              </div>
              <div className={styles.fundingDetailRow}>
                <span>{tr('Client Funding', 'Финансирование клиента')}</span>
                <strong>{formatMoney(preview?.fundingAmountKzt || 0, 'KZT', 2)}</strong>
              </div>
              <div className={styles.fundingDetailRow}>
                <span>{tr('Acquiring Fee', 'Комиссия эквайринга')} ({Number(context.funding.feePercent || 0)}%)</span>
                <strong>{formatMoney(preview?.feeAmountKzt || 0, 'KZT', 2)}</strong>
              </div>
              <div className={styles.fundingDetailRow}>
                <span>VAT ({Number(context.funding.vatPercent || 0)}%)</span>
                <strong>{formatMoney(preview?.vatAmountKzt || 0, 'KZT', 2)}</strong>
              </div>
            </div>

            <div className={styles.fundingTotals}>
              <div className={styles.fundingTotalCard}>
                <span>{tr('Total Wallet Debit', 'Итоговое списание с кошелька')}</span>
                <strong>{formatMoney(preview?.totalWalletDebitKzt || 0, 'KZT', 2)}</strong>
              </div>
              <div className={`${styles.fundingTotalCard} ${styles.fundingTotalCardAccent}`}>
                <span>{tr('Net Account Funding', 'Чистое пополнение аккаунта')}</span>
                <strong>{formatMoney(preview?.netAccountFunding || 0, context.account.currency, 2)}</strong>
              </div>
            </div>

            <div className={insufficientFunds ? styles.fundingStatusWarn : styles.fundingStatusOk}>
              <strong>{insufficientFunds ? tr('Insufficient wallet balance', 'Недостаточно средств в кошельке') : tr('Wallet balance is sufficient', 'Средств в кошельке достаточно')}</strong>
              <span>
                {insufficientFunds
                  ? tr('Reduce the amount or top up the client wallet first.', 'Уменьшите сумму или сначала пополните кошелёк клиента.')
                  : tr('Once confirmed, this request will be created and will appear in Finance.', 'После подтверждения запрос будет создан и появится в разделе Финансы.')}
              </span>
            </div>
          </>
        ) : null}

        {error ? <div className={styles.fundingError}>{error}</div> : null}

        <div className={styles.fundingFooter}>
          <button className={styles.fundingCancel} onClick={onClose} type="button">
            {tr('Cancel', 'Отмена')}
          </button>
          <button className={styles.fundingConfirm} disabled={!canSubmit} onClick={handleSubmit} type="button">
            {submitting ? tr('Creating…', 'Создание…') : tr('Confirm Top Up', 'Подтвердить пополнение')}
          </button>
        </div>
      </section>
    </div>
  )
}
