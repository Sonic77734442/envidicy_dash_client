'use client'

import { useState } from 'react'

export default function LandingPage() {
  const [magnetStatus, setMagnetStatus] = useState('')
  const [ctaStatus, setCtaStatus] = useState('')

  return (
    <div className="auth-page" style={{ padding: '24px' }}>
      <div className="auth-blur" />
      <main className="panel" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Digital Launch Lab</p>
            <h2>Запускаем трафик, который продаёт курс, вебинар или клуб</h2>
            <p className="muted">Лендинг перенесен в Next.js. Основной продуктовый вход: /login</p>
          </div>
          <a className="btn primary" href="/login">Открыть кабинет</a>
        </div>

        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <article className="panel">
            <p className="eyebrow">01 · Аудит</p>
            <h3>Цепляем аудиторию с первых 3 секунд</h3>
            <p className="muted">CustDev, карта возражений, сценарии для контента.</p>
          </article>
          <article className="panel">
            <p className="eyebrow">02 · Запуск</p>
            <h3>Плотная тестовая неделя</h3>
            <p className="muted">10–15 связок креатив + оффер + лендинг.</p>
          </article>
          <article className="panel">
            <p className="eyebrow">03 · Масштаб</p>
            <h3>Стабильные заявки и продажи</h3>
            <p className="muted">Масштабируем только окупаемые каналы.</p>
          </article>
        </div>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <label className="field">
            <span>Email для медиакита</span>
            <input type="email" placeholder="you@example.com" />
          </label>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setMagnetStatus('Готово! Отправим PDF и чек-лист в течение нескольких минут.')}
          >
            Получить медиакит
          </button>
        </div>
        <p className="muted small">{magnetStatus}</p>

        <div className="form-grid" style={{ marginTop: 8 }}>
          <label className="field">
            <span>Контакт для связи</span>
            <input type="text" placeholder="Telegram / WhatsApp" />
          </label>
          <button
            className="btn primary"
            type="button"
            onClick={() => setCtaStatus('Заявка получена. Свяжемся в ближайшие 15 минут в мессенджере.')}
          >
            Записаться на разбор
          </button>
        </div>
        <p className="muted small">{ctaStatus}</p>
      </main>
    </div>
  )
}
