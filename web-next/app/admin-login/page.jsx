'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '../../components/auth/AuthShell'
import { apiFetch } from '../../lib/api'
import { useI18n } from '../../lib/i18n/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const { tr } = useI18n()
  const [status, setStatus] = useState(tr('Admin token is required for password reset.', 'Нужен админ-токен для сброса.'))
  const [pending, setPending] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let active = true
    async function checkKey() {
      const key = new URLSearchParams(window.location.search).get('key') || ''
      if (!key) {
        router.replace('/login')
        return
      }
      try {
        const res = await apiFetch(`/admin/check-key?key=${encodeURIComponent(key)}`)
        if (!res.ok) throw new Error('invalid')
        if (active) {
          setAllowed(true)
          setStatus(tr('Key verified. You can reset the password.', 'Ключ подтвержден. Можно сбрасывать пароль.'))
        }
      } catch {
        router.replace('/login')
      }
    }
    checkKey()
    return () => {
      active = false
    }
  }, [router])

  async function onSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const newPassword = String(form.get('password') || '').trim()
    const token = String(form.get('token') || '').trim()

    if (!email || !newPassword || !token) {
      setStatus(tr('Fill in all fields.', 'Заполните все поля.'))
      return
    }

    setPending(true)
    setStatus(tr('Resetting password...', 'Сбрасываем пароль...'))
    try {
      const res = await apiFetch('/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, new_password: newPassword }),
      })
      if (!res.ok) throw new Error('bad')
      setStatus(tr('Password updated. You can now log in.', 'Пароль обновлен. Теперь можно войти.'))
    } catch {
      setStatus(tr('Failed to reset password. Check the token.', 'Не удалось сбросить пароль. Проверьте токен.'))
    } finally {
      setPending(false)
    }
  }

  if (!allowed) {
    return <AuthShell eyebrow={tr('Admin', 'Админ')} title={tr('Password Reset', 'Сброс пароля')} status={status} right="Private" />
  }

  return (
    <AuthShell eyebrow={tr('Admin', 'Админ')} title={tr('Password Reset', 'Сброс пароля')} status={status} right="Private">
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          <span>Email</span>
          <input name="email" type="email" placeholder="name@gmail.com" required />
        </label>
        <label>
          <span>{tr('New password', 'Новый пароль')}</span>
          <input name="password" type="password" placeholder="••••••••" required />
        </label>
        <label>
          <span>Admin token</span>
          <input name="token" type="text" placeholder="Bearer token" required />
        </label>
        <button disabled={pending} className="auth-primary" type="submit">
          {pending ? tr('Resetting...', 'Сбрасываем...') : tr('Reset password', 'Сбросить пароль')}
        </button>
        <a className="auth-secondary" href="/login">
          {tr('Back to login', 'Вернуться ко входу')}
        </a>
      </form>
    </AuthShell>
  )
}
