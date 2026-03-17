'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '../../components/auth/AuthShell'
import { apiFetch } from '../../lib/api'
import { setAuth } from '../../lib/auth'

const ADMIN_EMAILS = new Set(['romant997@gmail.com', 'kolyadov.denis@gmail.com'])

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [status, setStatus] = useState('Введите email и пароль, чтобы продолжить.')
  const [pending, setPending] = useState(false)

  const modeText = useMemo(
    () =>
      mode === 'login'
        ? 'Введите email и пароль, чтобы продолжить.'
        : 'Укажите дополнительный email и задайте для него новый пароль.',
    [mode]
  )

  async function onLoginSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '').trim()

    if (!email || !password) {
      setStatus('Заполните, пожалуйста, email и пароль.')
      return
    }

    setPending(true)
    setStatus('Выполняется вход...')
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Не удалось войти')
      setAuth(data)
      setStatus('Вход выполнен. Перенаправление...')
      const nextEmail = String(data?.email || email || '').toLowerCase()
      router.push(ADMIN_EMAILS.has(nextEmail) ? '/admin/requests' : '/plan')
    } catch (error) {
      setStatus(error?.message || 'Не удалось войти. Проверьте почту и пароль.')
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
      setStatus('Заполните email и новый пароль.')
      return
    }
    if (next !== confirm) {
      setStatus('Пароли не совпадают.')
      return
    }

    setPending(true)
    setStatus('Сохранение пароля...')
    try {
      const res = await apiFetch('/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Не удалось задать пароль')
      setMode('login')
      setStatus('Пароль сохранен. Теперь можно войти.')
    } catch (error) {
      setStatus(error?.message || 'Не удалось задать пароль.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell eyebrow="Вход" title="В ваш кабинет" status={status || modeText} right="Private">
      <div className="auth-switch">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
          Войти
        </button>
        <button type="button" className={mode !== 'login' ? 'active' : ''} onClick={() => setMode('set-password')}>
          Задать пароль
        </button>
      </div>

      {mode === 'login' ? (
        <form className="auth-form" onSubmit={onLoginSubmit}>
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="name@gmail.com" required />
          </label>
          <label>
            <span>Пароль</span>
            <input name="password" type="password" placeholder="Введите" required />
          </label>
          <button disabled={pending} className="auth-primary" type="submit">
            {pending ? 'Выполняется...' : 'Войти'}
          </button>
          <a className="auth-secondary" href="/register">
            Создать аккаунт
          </a>
        </form>
      ) : (
        <form className="auth-form" onSubmit={onSetPasswordSubmit}>
          <label>
            <span>Email доступа</span>
            <input name="email" type="email" placeholder="team@company.com" required />
          </label>
          <label>
            <span>Новый пароль</span>
            <input name="new_password" type="password" placeholder="Введите" required />
          </label>
          <label>
            <span>Повторите пароль</span>
            <input name="confirm_password" type="password" placeholder="Введите" required />
          </label>
          <button disabled={pending} className="auth-primary" type="submit">
            {pending ? 'Сохраняем...' : 'Сохранить пароль'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
