'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '../../components/auth/AuthShell'
import { apiFetch } from '../../lib/api'
import { setAuth } from '../../lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Мы проверим данные и отправим приглашение.')
  const [pending, setPending] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const company = String(form.get('company') || '').trim()
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '').trim()
    const confirm = String(form.get('confirm_password') || '').trim()

    if (!email || !password) {
      setStatus('Заполните обязательные поля.')
      return
    }
    if (password !== confirm) {
      setStatus('Пароли не совпадают. Проверьте ввод.')
      return
    }

    setPending(true)
    setStatus('Создаем аккаунт...')
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Не удалось создать аккаунт')

      setAuth(data)

      if (name || company) {
        await apiFetch('/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify({ name: name || null, company: company || null, language: 'ru' }),
        }).catch(() => {})
      }

      setStatus('Аккаунт создан. Перенаправляем...')
      router.push('/plan')
    } catch (error) {
      setStatus(error?.message || 'Не удалось создать аккаунт. Проверьте данные.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell eyebrow="Регистрация" title="Новый доступ" status={status} right="Invite">
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          <span>Имя</span>
          <input name="name" type="text" placeholder="Анна Маркетолог" required />
        </label>
        <label>
          <span>Компания</span>
          <input name="company" type="text" placeholder="ACME Corp" />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" placeholder="name@gmail.com" required />
        </label>
        <label>
          <span>Пароль</span>
          <input name="password" type="password" placeholder="••••••••" required />
        </label>
        <label>
          <span>Повторите пароль</span>
          <input name="confirm_password" type="password" placeholder="••••••••" required />
        </label>
        <button disabled={pending} className="auth-primary" type="submit">
          {pending ? 'Создаем...' : 'Создать аккаунт'}
        </button>
        <a className="auth-secondary" href="/login">
          Уже есть аккаунт
        </a>
      </form>
    </AuthShell>
  )
}
