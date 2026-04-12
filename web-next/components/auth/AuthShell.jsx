'use client'

import { useI18n } from '../../lib/i18n/client'

export default function AuthShell({ eyebrow, title, status, children, right }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="auth-page">
      <div className="auth-blur" />
      <div className="auth-card">
        <div className="auth-head">
          <div>
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {right ? <span className="auth-chip">{right}</span> : null}
            <div className="topbar-locale" aria-label={t('locale.switchAria')}>
              <button
                type="button"
                className={`topbar-locale-btn ${locale === 'en' ? 'active' : ''}`}
                onClick={() => setLocale('en')}
              >
                {t('locale.en')}
              </button>
              <button
                type="button"
                className={`topbar-locale-btn ${locale === 'ru' ? 'active' : ''}`}
                onClick={() => setLocale('ru')}
              >
                {t('locale.ru')}
              </button>
            </div>
          </div>
        </div>
        {children}
        <p className="auth-status">{status}</p>
      </div>
    </div>
  )
}
