'use client'

import { useMemo, useState } from 'react'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'

const PLATFORM_CARDS = [
  { key: 'meta', label: 'Meta', summary: 'Global reach & hyper-targeted precision.' },
  { key: 'google', label: 'Google', summary: 'Intent-based audience capture.' },
  { key: 'tiktok', label: 'TikTok', summary: 'High engagement via short-form creative.' },
  { key: 'telegram', label: 'Telegram', summary: 'Privacy-focused direct community ads.' },
  { key: 'yandex', label: 'Yandex', summary: 'Domain search and display in CIS.' },
]

const STEP_ITEMS = [
  { key: 'platform', label: 'Platform' },
  { key: 'business', label: 'Business' },
  { key: 'setup', label: 'Platform Setup' },
  { key: 'review', label: 'Review' },
]

const ENTITY_OPTIONS = ['Architect Global Ltd', 'Envidicy Group LLP', 'Studio Archi-Media Ltd']
const GOOGLE_CURRENCY_OPTIONS = ['USD', 'EUR']
const META_CURRENCY_OPTIONS = ['USD', 'EUR']

function stepIndex(step) {
  return Math.max(0, STEP_ITEMS.findIndex((item) => item.key === step))
}

function initialState() {
  return {
    platform: 'tiktok',
    name: '',
    legalEntity: '',
    currency: 'USD',
    website: '',
    app: '',
    bmId: '',
    metaGeo: '',
    facebookPage: '',
    instagramPage: '',
    finalAdvertiser: 'yes',
    finalName: '',
    finalCountry: '',
    finalTaxId: '',
    finalAddress: '',
    finalOwnership: '',
    accessEmail: '',
    accessRole: 'standard',
    access: [],
    mccEmail: '',
    tiktokIdInput: '',
    tiktokIds: [],
    timezone: 'Asia/Almaty',
    geo: '',
  }
}

function defaultCurrencyForPlatform(platform) {
  const key = String(platform || '').toLowerCase()
  if (key === 'yandex') return 'KZT'
  if (key === 'telegram') return 'EUR'
  return 'USD'
}

function platformGuide(platform) {
  const key = String(platform || '').toLowerCase()
  if (key === 'google') {
    return {
      title: 'Google Ads and MCC',
      text: 'Legacy Google onboarding required an existing Google Ads account and MCC access before the request could be completed.',
      linkLabel: 'Instruction: Google Ads and MCC setup',
      link: '#',
    }
  }
  if (key === 'meta') {
    return {
      title: 'Business Manager',
      text: 'Legacy Meta onboarding required Business Manager details, GEO and connected pages before the request could be submitted.',
      linkLabel: 'Instruction: create Business Manager',
      link: '#',
    }
  }
  return {
    title: 'TikTok Business Center',
    text: 'Legacy TikTok onboarding required an existing TikTok Business Center before submitting the account request.',
    linkLabel: 'Instruction: create TikTok Business Center',
    link: 'https://ads.tiktok.com/help/article/create-tiktok-business-center?lang=ru',
  }
}

export default function AccountRequestModal({ open, onClose, onSubmitted }) {
  const [step, setStep] = useState('platform')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [state, setState] = useState(initialState)

  const isTiktok = state.platform === 'tiktok'
  const isGoogle = state.platform === 'google'
  const isMeta = state.platform === 'meta'
  const currentStep = stepIndex(step) + 1
  const progress = `${String(currentStep).padStart(2, '0')} / ${String(STEP_ITEMS.length).padStart(2, '0')}`

  const canAdvanceBusiness =
    Boolean(state.name.trim()) && Boolean(state.legalEntity.trim()) && Boolean(state.website.trim()) && Boolean(state.currency.trim())
  const canAdvanceSetup =
    isTiktok
      ? state.tiktokIds.length > 0 && Boolean(state.timezone.trim()) && Boolean(state.geo.trim())
      : isGoogle
        ? Boolean(state.mccEmail.trim()) && state.access.length > 0
        : isMeta
          ? Boolean(state.bmId.trim()) &&
            Boolean(state.metaGeo.trim()) &&
            Boolean(state.facebookPage.trim()) &&
            Boolean(state.instagramPage.trim()) &&
            (state.finalAdvertiser === 'yes' ||
              (Boolean(state.finalName.trim()) &&
                Boolean(state.finalCountry.trim()) &&
                Boolean(state.finalTaxId.trim()) &&
                Boolean(state.finalAddress.trim()) &&
                Boolean(state.finalOwnership.trim())))
          : false

  const reviewRows = useMemo(
    () => [
      { label: 'Legal Name', value: state.legalEntity || '—' },
      {
        label: isTiktok ? 'Primary Region' : isGoogle ? 'MCC Email' : 'Business Manager ID',
        value: isTiktok ? state.geo || '—' : isGoogle ? state.mccEmail || '—' : state.bmId || '—',
      },
      { label: 'Currency', value: state.currency || '—' },
      { label: 'Website', value: state.website || '—' },
    ],
    [isGoogle, isTiktok, state]
  )

  function resetAndClose() {
    setStep('platform')
    setSubmitting(false)
    setStatus('')
    setState(initialState())
    onClose()
  }

  function addTiktokId() {
    const value = state.tiktokIdInput.trim()
    if (!value) {
      setStatus('Enter a TikTok Business ID.')
      return
    }
    if (state.tiktokIds.length >= 10) {
      setStatus('You can add up to 10 Business IDs.')
      return
    }
    if (state.tiktokIds.includes(value)) {
      setStatus('This Business ID is already added.')
      return
    }
    setState((current) => ({ ...current, tiktokIds: [...current.tiktokIds, value], tiktokIdInput: '' }))
    setStatus('')
  }

  function addAccess() {
    const email = state.accessEmail.trim()
    if (!email) {
      setStatus('Enter an access email.')
      return
    }
    if (state.access.some((item) => item.email === email)) {
      setStatus('This access email is already added.')
      return
    }
    setState((current) => ({
      ...current,
      access: [...current.access, { email, role: current.accessRole }],
      accessEmail: '',
    }))
    setStatus('')
  }

  async function submitRequest() {
    const token = getAuthToken()
    if (!token) return

    setSubmitting(true)
    setStatus('')
    try {
      const payload = {
        platform: state.platform,
        name: state.name.trim(),
        external_id: null,
        currency: state.currency,
        website: state.website.trim(),
        app: state.app.trim() || null,
        access: isGoogle ? state.access : [],
        mcc_email: isGoogle ? state.mccEmail.trim() || null : null,
        business_manager_id: isMeta ? state.bmId.trim() || null : null,
        geo: isMeta ? state.metaGeo.trim() || null : null,
        facebook_page: isMeta ? state.facebookPage.trim() || null : null,
        instagram_page: isMeta ? state.instagramPage.trim() || null : null,
        final_advertiser: isMeta ? state.finalAdvertiser : 'yes',
        final_name: isMeta ? state.finalName.trim() || null : null,
        final_country: isMeta ? state.finalCountry.trim() || null : null,
        final_tax_id: isMeta ? state.finalTaxId.trim() || null : null,
        final_address: isMeta ? state.finalAddress.trim() || null : null,
        final_ownership: isMeta ? state.finalOwnership.trim() || null : null,
        yandex_email: null,
        telegram_channel: null,
        tiktok_business_ids: isTiktok ? state.tiktokIds : [],
        tiktok_timezone: isTiktok ? state.timezone : null,
        tiktok_geo: isTiktok ? state.geo : null,
        legal_entity_name: state.legalEntity.trim(),
      }

      const res = await fetch('/api/client/account-request', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to create account request')
      if (onSubmitted) await onSubmitted(data)
      resetAndClose()
    } catch (error) {
      setStatus(error?.message || 'Failed to create account request')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.requestModalOverlay} onClick={(event) => event.target === event.currentTarget && resetAndClose()}>
      <section className={styles.requestModal} role="dialog" aria-modal="true" aria-labelledby="request-account-title">
        <aside className={styles.requestRail}>
          <div>
            <h3 className={styles.requestRailTitle}>Onboarding</h3>
            <p className={styles.requestRailStep}>Step {currentStep} of {STEP_ITEMS.length}</p>
          </div>
          <div className={styles.requestRailNav}>
            {STEP_ITEMS.map((item, index) => (
              <div
                className={index === stepIndex(step) ? `${styles.requestRailItem} ${styles.requestRailItemActive}` : styles.requestRailItem}
                key={item.key}
              >
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.requestSupportCard}>
            <strong>Need help with setup?</strong>
            <span>Schedule a consultation with AdOps.</span>
          </div>
        </aside>

        <div className={styles.requestCanvas}>
          <div className={styles.requestCanvasHead}>
            <div>
              <p className={styles.requestStepEyebrow}>Step {String(currentStep).padStart(2, '0')} of {String(STEP_ITEMS.length).padStart(2, '0')}</p>
              <h3 className={styles.requestCanvasTitle} id="request-account-title">
                {step === 'platform'
                  ? 'Select Platform'
                  : step === 'business'
                    ? isGoogle
                      ? 'Google Ads'
                      : isMeta
                        ? 'Meta Ads'
                      : 'TikTok Ads'
                    : step === 'setup'
                      ? isGoogle
                        ? 'MCC & Access Setup'
                        : isMeta
                          ? 'Meta Business Setup'
                        : 'Business Setup'
                      : 'Review & Submit'}
              </h3>
              <p className={styles.requestCanvasSubtitle}>
                {step === 'platform'
                  ? 'Choose the ecosystem where you want to scale your operations.'
                  : step === 'business'
                    ? isGoogle
                      ? 'Configure your Google Ads account identity and financial foundations.'
                      : isMeta
                        ? 'Configure your Meta account identity and financial foundations.'
                      : 'Configure your TikTok Ads business identity and financial foundations.'
                    : step === 'setup'
                      ? isGoogle
                        ? 'Provide MCC access and the emails that should receive Google Ads access.'
                        : isMeta
                          ? 'Provide Business Manager details, GEO, connected pages and final advertiser information.'
                        : 'Connect TikTok business IDs, timezone and primary geo targeting.'
                      : isGoogle
                        ? 'Verify your Google Ads account details before submitting for review.'
                        : isMeta
                          ? 'Verify your Meta account details before submitting for review.'
                        : 'Verify your TikTok account details before submitting for review.'}
              </p>
            </div>
            <div className={styles.requestCanvasActions}>
              <span className={styles.requestProgressText}>{progress}</span>
              <button className={styles.requestClose} onClick={resetAndClose} type="button" aria-label="Close">
                ×
              </button>
            </div>
          </div>

          {step === 'platform' ? (
            <div className={styles.requestPlatformGrid}>
              {PLATFORM_CARDS.map((item) => (
                <button
                  className={item.key === state.platform ? `${styles.requestPlatformCard} ${styles.requestPlatformCardActive}` : styles.requestPlatformCard}
                  key={item.key}
                  onClick={() => {
                    setState((current) => ({
                      ...current,
                      platform: item.key,
                      currency: defaultCurrencyForPlatform(item.key),
                    }))
                    setStatus(['tiktok', 'google', 'meta'].includes(item.key) ? '' : 'TikTok, Google and Meta are the first flows implemented in the redesign. Other platforms follow next.')
                  }}
                  type="button"
                >
                  <strong>{item.label}</strong>
                  <span>{item.summary}</span>
                  {!['tiktok', 'google', 'meta'].includes(item.key) ? <em>Next</em> : null}
                </button>
              ))}
            </div>
          ) : null}

          {step === 'business' ? (
            <div className={styles.requestFormGrid}>
              <article className={styles.requestGuideCard}>
                <strong>{platformGuide(state.platform).title}</strong>
                <span>{platformGuide(state.platform).text}</span>
                <a
                  href={platformGuide(state.platform).link}
                  rel="noreferrer"
                  target={platformGuide(state.platform).link.startsWith('http') ? '_blank' : undefined}
                >
                  {platformGuide(state.platform).linkLabel}
                </a>
              </article>
              <label className={styles.requestField}>
                <span>Account Name</span>
                <input
                  onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
                  placeholder={isGoogle ? 'e.g. Architect_Search_Global' : isMeta ? 'e.g. Architect_Meta_Global' : 'e.g. Architect_Global_Performance'}
                  type="text"
                  value={state.name}
                />
              </label>
              <label className={styles.requestField}>
                <span>Website URL</span>
                <input
                  onChange={(event) => setState((current) => ({ ...current, website: event.target.value }))}
                  placeholder="https://architect.ledger/brand"
                  type="url"
                  value={state.website}
                />
              </label>
              <label className={styles.requestField}>
                <span>Legal Entity</span>
                <select value={state.legalEntity} onChange={(event) => setState((current) => ({ ...current, legalEntity: event.target.value }))}>
                  <option value="">Select Registered Entity</option>
                  {ENTITY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.requestField}>
                <span>App URL</span>
                <input
                  onChange={(event) => setState((current) => ({ ...current, app: event.target.value }))}
                  placeholder="App Store or Play Store Link"
                  type="url"
                  value={state.app}
                />
              </label>
              <label className={styles.requestField}>
                <span>Account Currency</span>
                {isGoogle || isMeta ? (
                  <select value={state.currency} onChange={(event) => setState((current) => ({ ...current, currency: event.target.value }))}>
                    {(isGoogle ? GOOGLE_CURRENCY_OPTIONS : META_CURRENCY_OPTIONS).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input disabled readOnly type="text" value="USD - United States Dollar" />
                )}
              </label>
              <article className={styles.requestInfoCard}>
                <strong>Architect Verified</strong>
                <span>Configuration settings will be synchronized with your master financial ledger for consistent reporting across all platforms.</span>
              </article>
            </div>
          ) : null}

          {step === 'setup' ? (
            <div className={styles.requestSetupStack}>
              {isTiktok ? (
                <>
                  <label className={styles.requestField}>
                    <span>TikTok Business IDs</span>
                    <div className={styles.requestInlineField}>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, tiktokIdInput: event.target.value }))}
                        placeholder="Enter Business Center ID"
                        type="text"
                        value={state.tiktokIdInput}
                      />
                      <button className={styles.requestGhostButton} onClick={addTiktokId} type="button">
                        Add
                      </button>
                    </div>
                  </label>
                  <div className={styles.requestChipRow}>
                    {state.tiktokIds.map((item, index) => (
                      <div className={styles.requestChip} key={`${item}-${index}`}>
                        <span>ID: {item}</span>
                        <button
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              tiktokIds: current.tiktokIds.filter((_, chipIndex) => chipIndex !== index),
                            }))
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={styles.requestFormGridTwo}>
                    <label className={styles.requestField}>
                      <span>Timezone</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, timezone: event.target.value }))}
                        placeholder="Asia/Almaty"
                        type="text"
                        value={state.timezone}
                      />
                    </label>
                    <label className={styles.requestField}>
                      <span>Primary Geo Target</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, geo: event.target.value }))}
                        placeholder="Kazakhstan, Uzbekistan"
                        type="text"
                        value={state.geo}
                      />
                    </label>
                  </div>
                </>
              ) : null}

              {isGoogle ? (
                <>
                  <label className={styles.requestField}>
                    <span>MCC Access Email</span>
                    <input
                      onChange={(event) => setState((current) => ({ ...current, mccEmail: event.target.value }))}
                      placeholder="user@company.com"
                      type="email"
                      value={state.mccEmail}
                    />
                  </label>
                  <label className={styles.requestField}>
                    <span>Access Emails</span>
                    <div className={styles.requestInlineField}>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, accessEmail: event.target.value }))}
                        placeholder="user@company.com"
                        type="email"
                        value={state.accessEmail}
                      />
                      <button className={styles.requestGhostButton} onClick={addAccess} type="button">
                        Add
                      </button>
                    </div>
                  </label>
                  <div className={styles.requestChipRow}>
                    {state.access.map((item, index) => (
                      <div className={styles.requestChip} key={`${item.email}-${index}`}>
                        <span>{item.email}</span>
                        <button
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              access: current.access.filter((_, chipIndex) => chipIndex !== index),
                            }))
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {isMeta ? (
                <>
                  <div className={styles.requestFormGridTwo}>
                    <label className={styles.requestField}>
                      <span>Business Manager ID</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, bmId: event.target.value }))}
                        placeholder="e.g. 123456789012345"
                        type="text"
                        value={state.bmId}
                      />
                    </label>
                    <label className={styles.requestField}>
                      <span>GEO</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, metaGeo: event.target.value }))}
                        placeholder="Kazakhstan"
                        type="text"
                        value={state.metaGeo}
                      />
                    </label>
                  </div>
                  <div className={styles.requestFormGridTwo}>
                    <label className={styles.requestField}>
                      <span>Facebook Page</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, facebookPage: event.target.value }))}
                        placeholder="https://facebook.com/your-page"
                        type="url"
                        value={state.facebookPage}
                      />
                    </label>
                    <label className={styles.requestField}>
                      <span>Instagram Page</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, instagramPage: event.target.value }))}
                        placeholder="https://instagram.com/your-page"
                        type="url"
                        value={state.instagramPage}
                      />
                    </label>
                  </div>
                  <label className={styles.requestField}>
                    <span>Are you the final advertiser?</span>
                    <select value={state.finalAdvertiser} onChange={(event) => setState((current) => ({ ...current, finalAdvertiser: event.target.value }))}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  {state.finalAdvertiser === 'no' ? (
                    <div className={styles.requestFormGridTwo}>
                      <label className={styles.requestField}>
                        <span>Final Advertiser Name</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalName: event.target.value }))}
                          type="text"
                          value={state.finalName}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>Country</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalCountry: event.target.value }))}
                          type="text"
                          value={state.finalCountry}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>Tax ID</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalTaxId: event.target.value }))}
                          type="text"
                          value={state.finalTaxId}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>Address</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalAddress: event.target.value }))}
                          type="text"
                          value={state.finalAddress}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>Ownership Share</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalOwnership: event.target.value }))}
                          placeholder="100%"
                          type="text"
                          value={state.finalOwnership}
                        />
                      </label>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {step === 'review' ? (
            <div className={styles.requestReviewStack}>
              <section className={styles.requestReviewSection}>
                <p className={styles.requestReviewLabel}>Basic Account Summary</p>
                <div className={styles.requestReviewGrid}>
                  {reviewRows.map((item) => (
                    <div className={styles.requestReviewCard} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className={styles.requestReviewSection}>
                <p className={styles.requestReviewLabel}>{isGoogle ? 'Google Access Setup' : isMeta ? 'Meta Business Setup' : 'TikTok Business Setup'}</p>
                <div className={styles.requestBusinessList}>
                  {isTiktok
                    ? state.tiktokIds.map((item, index) => (
                        <div className={styles.requestBusinessItem} key={`${item}-${index}`}>
                          <strong>TikTok BC #{index + 1}</strong>
                          <span>{item}</span>
                        </div>
                      ))
                    : isGoogle
                      ? state.access.map((item, index) => (
                        <div className={styles.requestBusinessItem} key={`${item.email}-${index}`}>
                          <strong>Access Email #{index + 1}</strong>
                          <span>{item.email}</span>
                        </div>
                        ))
                      : [
                          <div className={styles.requestBusinessItem} key="meta-bm">
                            <strong>Business Manager ID</strong>
                            <span>{state.bmId}</span>
                          </div>,
                          <div className={styles.requestBusinessItem} key="meta-pages">
                            <strong>Connected Pages</strong>
                            <span>{state.facebookPage}</span>
                          </div>,
                          <div className={styles.requestBusinessItem} key="meta-instagram">
                            <strong>Instagram Page</strong>
                            <span>{state.instagramPage}</span>
                          </div>,
                        ]}
                </div>
                <div className={styles.requestReviewMeta}>
                  {isTiktok ? (
                    <>
                      <span>Timezone: {state.timezone}</span>
                      <span>Primary GEO: {state.geo}</span>
                    </>
                  ) : isGoogle ? (
                    <span>MCC Email: {state.mccEmail}</span>
                  ) : (
                    <>
                      <span>GEO: {state.metaGeo}</span>
                      <span>Final Advertiser: {state.finalAdvertiser === 'yes' ? 'Yes' : 'No'}</span>
                    </>
                  )}
                </div>
              </section>
              <div className={styles.requestPolicyNote}>
                By submitting this request, you confirm the onboarding details are correct. Account verification may take 2-4 business days.
              </div>
            </div>
          ) : null}

          {status ? <div className={styles.requestStatus}>{status}</div> : null}

          <div className={styles.requestFooter}>
            <button
              className={styles.requestBack}
              onClick={() => {
                setStatus('')
                setStep(STEP_ITEMS[Math.max(0, stepIndex(step) - 1)].key)
              }}
              type="button"
              disabled={step === 'platform' || submitting}
            >
              Back
            </button>

            <div className={styles.requestFooterRight}>
              {step !== 'review' ? (
                <button
                  className={styles.requestPrimary}
                  onClick={() => {
                    setStatus('')
                    if (step === 'platform') {
                      if (!['tiktok', 'google', 'meta'].includes(state.platform)) {
                        setStatus('TikTok, Google and Meta are the first flows implemented in the redesign. Select one of them to continue.')
                        return
                      }
                      setStep('business')
                      return
                    }
                    if (step === 'business') {
                      if (!canAdvanceBusiness) {
                        setStatus('Complete the required business fields before continuing.')
                        return
                      }
                      setStep('setup')
                      return
                    }
                    if (step === 'setup') {
                      if (!canAdvanceSetup) {
                        setStatus(
                          isGoogle
                            ? 'Add MCC email and at least one access email before continuing.'
                            : isMeta
                              ? 'Complete Business Manager, GEO, pages and final advertiser details before continuing.'
                            : 'Add at least one TikTok Business ID, timezone and primary GEO.'
                        )
                        return
                      }
                      setStep('review')
                    }
                  }}
                  type="button"
                >
                  Save & Continue
                </button>
              ) : (
                <button className={styles.requestPrimary} disabled={submitting} onClick={submitRequest} type="button">
                  {submitting ? 'Requesting…' : 'Request Account'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
