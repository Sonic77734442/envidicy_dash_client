'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, messages } from './messages'

const LOCALE_COOKIE = 'locale'
const LOCALE_STORAGE_KEY = 'locale'

const I18nContext = createContext(null)

function normalizeLocale(value) {
  const locale = String(value || '').trim().toLowerCase()
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
}

function readCookieLocale() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function readInitialLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const fromCookie = normalizeLocale(readCookieLocale())
  if (fromCookie !== DEFAULT_LOCALE || readCookieLocale()) return fromCookie
  const fromStorage = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
  if (fromStorage !== DEFAULT_LOCALE || window.localStorage.getItem(LOCALE_STORAGE_KEY)) return fromStorage
  const fromBrowser = normalizeLocale(window.navigator.language?.split('-')[0])
  return fromBrowser
}

function deepGet(object, path) {
  const keys = String(path || '').split('.').filter(Boolean)
  let cursor = object
  for (const key of keys) {
    if (!cursor || typeof cursor !== 'object' || !(key in cursor)) return undefined
    cursor = cursor[key]
  }
  return cursor
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(readInitialLocale())
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }
  }, [locale])

  const value = useMemo(() => {
    const setLocale = (nextLocale) => setLocaleState(normalizeLocale(nextLocale))
    const t = (key, fallback = '') => {
      const localized = deepGet(messages[locale], key)
      if (localized != null) return localized
      const english = deepGet(messages.en, key)
      if (english != null) return english
      return fallback || key
    }
    const tr = (en, ru) => (locale === 'ru' ? ru : en)
    return { locale, setLocale, t, tr }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
