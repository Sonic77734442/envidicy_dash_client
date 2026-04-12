'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { setAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n/client'
import styles from './login.module.css'

const ADMIN_EMAILS = new Set(['romant997@gmail.com', 'kolyadov.denis@gmail.com'])

export default function LoginPage() {
  const router = useRouter()
  const { locale, t } = useI18n()
  const [mode, setMode] = useState('login')
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState(t('login.statusLogin'))

  const helperText = useMemo(
    () =>
      mode === 'login'
        ? t('login.statusLogin')
        : t('login.statusSetPassword'),
    [mode, t]
  )
  const features = useMemo(
    () => [
      { icon: 'speed', title: t('login.feature1Title'), text: t('login.feature1Text') },
      { icon: 'verified_user', title: t('login.feature2Title'), text: t('login.feature2Text') },
      { icon: 'architecture', title: t('login.feature3Title'), text: t('login.feature3Text') },
    ],
    [t]
  )

  useEffect(() => {
    setStatus(mode === 'login' ? t('login.statusLogin') : t('login.statusSetPassword'))
  }, [locale, mode, t])

  async function onLoginSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '').trim()

    if (!email || !password) {
      setStatus(t('login.fillEmailPassword'))
      return
    }

    setPending(true)
    setStatus(t('login.signingIn'))
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Could not sign in')
      setAuth(data)
      setStatus(t('login.accessGranted'))
      const nextEmail = String(data?.email || email || '').toLowerCase()
      router.push(ADMIN_EMAILS.has(nextEmail) ? '/admin/requests' : '/dashboard')
    } catch (error) {
      setStatus(error?.message || t('login.signInFailed'))
    } finally {
      setPending(false)
    }
  }

  async function onSetPasswordSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const next = String(form.get('new_password') || '').trim()
    const confirm = String(form.get('confirm_password') || '').trim()

    if (!email || !next) {
      setStatus(t('login.fillEmailNewPassword'))
      return
    }
    if (next !== confirm) {
      setStatus(t('login.passwordsMismatch'))
      return
    }

    setPending(true)
    setStatus(t('login.savingPassword'))
    try {
      const res = await apiFetch('/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Could not set password')
      setMode('login')
      setStatus(t('login.passwordSaved'))
    } catch (error) {
      setStatus(error?.message || t('login.passwordSetFailed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.hero}>
        <div className={styles.pattern} />
        <div className={styles.heroInner}>
          <Link className={styles.brand} href="/login">
            Envidicy
          </Link>

          <h1 className={styles.heroTitle}>{t('login.heroTitle')}</h1>
          <p className={styles.heroSubtitle}>{t('login.heroSubtitle')}</p>

          <div className={styles.featureList}>
            {features.map((item) => (
              <div className={styles.feature} key={item.title}>
                <span className={`material-symbols-outlined ${styles.featureIcon}`}>{item.icon}</span>
                <div>
                  <p className={styles.featureTitle}>{item.title}</p>
                  <p className={styles.featureText}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroFooter}>
          <span>{t('login.trustedBy')}</span>
          <div className={styles.heroLine} />
        </div>
      </aside>

      <main className={styles.side}>
        <div className={styles.panel}>
          <span className={styles.mobileBrand}>Envidicy</span>

          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>{mode === 'login' ? t('login.signIn') : t('login.setPassword')}</h2>
            <p className={styles.panelText}>{helperText}</p>
          </div>

          <div className={styles.card}>
            {mode === 'login' ? (
              <form className={styles.form} onSubmit={onLoginSubmit}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('login.emailAddress')}</span>
                  <input className={styles.fieldInput} name="email" type="email" placeholder="name@company.com" required />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('login.password')}</span>
                  <span className={styles.fieldInputWrap}>
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      className={styles.visibilityButton}
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </span>
                </label>

                <button className={styles.submit} type="submit" disabled={pending}>
                  <span>{pending ? t('login.signingIn') : t('login.signIn')}</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </form>
            ) : (
              <form className={styles.form} onSubmit={onSetPasswordSubmit}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('login.emailAddress')}</span>
                  <input className={styles.fieldInput} name="email" type="email" placeholder="name@company.com" required />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('login.newPassword')}</span>
                  <input className={styles.fieldInput} name="new_password" type="password" placeholder="••••••••" required />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('login.confirmPassword')}</span>
                  <input className={styles.fieldInput} name="confirm_password" type="password" placeholder="••••••••" required />
                </label>

                <button className={styles.submit} type="submit" disabled={pending}>
                  <span>{pending ? t('login.savingPassword') : t('login.savePassword')}</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </form>
            )}
          </div>

          <div className={styles.bottomLinks}>
            <button type="button" onClick={() => setMode('set-password')}>
              <span>{t('login.setPassword')}</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <span className={styles.dot} />
            <Link href="/register">
              <span>{t('login.needAccess')}</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <p className={styles.status}>{status}</p>
        </div>
      </main>
    </div>
  )
}
