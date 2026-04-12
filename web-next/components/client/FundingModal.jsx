'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'
import { calculateFundingPreview, formatEditableAmount, formatMoney } from '../../lib/client/funding'

export default function FundingModal({ accountId, open, onClose, onSubmitted }) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [context, setContext] = useState(null)
  const [inputCurrency, setInputCurrency] = useState('KZT')
  const [amountInput, setAmountInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !accountId) return
    const token = getAuthToken()
    if (!token) return

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
        if (!res.ok) throw new Error(payload?.detail || 'Failed to load funding context')
        if (cancelled) return
        setContext(payload)
        setInputCurrency(payload?.funding?.defaultInputCurrency || 'KZT')
        setAmountInput('')
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load funding context')
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
    if (!token || !canSubmit) return

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
      if (!res.ok) throw new Error(payload?.detail || 'Failed to create top-up request')
      if (onSubmitted) await onSubmitted(payload)
      onClose()
    } catch (e) {
      setError(e?.message || 'Failed to create top-up request')
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
            <p className={styles.fundingEyebrow}>Client Funding</p>
            <h3 className={styles.fundingTitle} id="funding-title">
              Top Up Account
            </h3>
            <p className={styles.fundingSubtitle}>
              {context?.account?.platformLabel || 'Account'} · {context?.account?.name || 'Loading…'}
            </p>
          </div>
          <button className={styles.fundingClose} onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <div className={styles.fundingLoading}>Loading funding context…</div>
        ) : context ? (
          <>
            <div className={styles.fundingStage}>
              <article className={styles.fundingStageCard}>
                <span className={styles.fundingStageLabel}>Client Wallet</span>
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
                <span className={styles.fundingStageLabel}>Ad Account</span>
                <strong className={styles.fundingStageValue}>{context.account.currency}</strong>
                <div className={styles.fundingStageMeta}>
                  <span>{context.account.name}</span>
                  <span>{context.account.liveBalanceLabel ? `Live ${context.account.liveBalanceLabel}` : 'Ready for funding'}</span>
                </div>
              </article>
            </div>

            <div className={styles.fundingInputShell}>
              <div className={styles.fundingInputHeader}>
                <div>
                  <span className={styles.fundingInputLabel}>Amount to top up</span>
                  <p className={styles.fundingInputHint}>Choose the currency you want to enter. The rest is calculated automatically.</p>
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
                  <span>{inputCurrency === 'KZT' ? 'Estimated account funding' : 'Estimated wallet debit'}</span>
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
                  Wallet debit {formatMoney(preview?.totalWalletDebitKzt || 0, 'KZT', 2)} → account receives{' '}
                  {formatMoney(preview?.netAccountFunding || 0, context.account.currency, 2)}
                </span>
              </div>
            </div>

            <div className={styles.fundingDetails}>
              <div className={styles.fundingDetailRow}>
                <span>Market FX Rate ({context.account.currency}/KZT)</span>
                <strong>{preview?.fxRate ? String(preview.fxRate) : 'Not required'}</strong>
              </div>
              <div className={styles.fundingDetailRow}>
                <span>Client Funding</span>
                <strong>{formatMoney(preview?.fundingAmountKzt || 0, 'KZT', 2)}</strong>
              </div>
              <div className={styles.fundingDetailRow}>
                <span>Acquiring Fee ({Number(context.funding.feePercent || 0)}%)</span>
                <strong>{formatMoney(preview?.feeAmountKzt || 0, 'KZT', 2)}</strong>
              </div>
              <div className={styles.fundingDetailRow}>
                <span>VAT ({Number(context.funding.vatPercent || 0)}%)</span>
                <strong>{formatMoney(preview?.vatAmountKzt || 0, 'KZT', 2)}</strong>
              </div>
            </div>

            <div className={styles.fundingTotals}>
              <div className={styles.fundingTotalCard}>
                <span>Total Wallet Debit</span>
                <strong>{formatMoney(preview?.totalWalletDebitKzt || 0, 'KZT', 2)}</strong>
              </div>
              <div className={`${styles.fundingTotalCard} ${styles.fundingTotalCardAccent}`}>
                <span>Net Account Funding</span>
                <strong>{formatMoney(preview?.netAccountFunding || 0, context.account.currency, 2)}</strong>
              </div>
            </div>

            <div className={insufficientFunds ? styles.fundingStatusWarn : styles.fundingStatusOk}>
              <strong>{insufficientFunds ? 'Insufficient wallet balance' : 'Wallet balance is sufficient'}</strong>
              <span>
                {insufficientFunds
                  ? 'Reduce the amount or top up the client wallet first.'
                  : 'Once confirmed, this request will be created and will appear in Finance.'}
              </span>
            </div>
          </>
        ) : null}

        {error ? <div className={styles.fundingError}>{error}</div> : null}

        <div className={styles.fundingFooter}>
          <button className={styles.fundingCancel} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={styles.fundingConfirm} disabled={!canSubmit} onClick={handleSubmit} type="button">
            {submitting ? 'Creating…' : 'Confirm Top Up'}
          </button>
        </div>
      </section>
    </div>
  )
}
