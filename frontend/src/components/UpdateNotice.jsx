import { useEffect, useRef, useState } from 'react'
import { MOBILE, isAndroid } from '../lib/mobile.js'
import { selfUpdates } from '../lib/channel.js'
import { checkForUpdate, downloadAndInstall, fetchChecksum, RELEASES_PAGE } from '../lib/update.js'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'

const DISMISS_KEY = 'opengym_dismissed_apk_update'
const CHECK_INTERVAL_MS = 60_000

function dismissedVersion() {
  try { return localStorage.getItem(DISMISS_KEY) || '' } catch { return '' }
}
function dismissVersion(v) {
  try { localStorage.setItem(DISMISS_KEY, String(v || '')) } catch { /* ignore */ }
}

/**
 * Automatic in-app APK update notice (CapitalFlow pattern) for Android sideload builds.
 * Checks GitHub releases on boot, app resume, reconnect, and every 60s without blocking the UI.
 */
export default function UpdateNotice() {
  const toast = useUI(s => s.toast)
  const [info, setInfo] = useState(null)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const inFlight = useRef(false)
  const lastCheck = useRef(0)

  useEffect(() => {
    if (!MOBILE) return
    let active = true
    let resumeHandle = null
    let interval = null

    const runCheck = async (force = false) => {
      if (!navigator.onLine || inFlight.current) return
      if (!force && Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return
      inFlight.current = true
      lastCheck.current = Date.now()
      try {
        const res = await checkForUpdate(force)
        if (!active) return
        if (res?.hasUpdate) {
          const marker = String(res.versionCode || res.latestVersion || '')
          setInfo(res)
          setHidden(dismissedVersion() === marker)
        } else {
          setInfo(null)
        }
      } catch {
        // Offline or rate-limited: stay quiet
      } finally {
        inFlight.current = false
      }
    }

    let onOnline = null
    Promise.all([isAndroid(), selfUpdates()]).then(([android, own]) => {
      if (!active || !android || !own) return
      void runCheck(true)
      interval = window.setInterval(() => { void runCheck(false) }, CHECK_INTERVAL_MS)
      onOnline = () => { void runCheck(true) }
      window.addEventListener('online', onOnline)
      import('@capacitor/app').then(({ App }) => {
        if (!active) return
        App.addListener('resume', () => { void runCheck(true) })
          .then(h => { if (active) resumeHandle = h; else h.remove().catch(() => {}) })
          .catch(() => {})
      }).catch(() => {})
    }).catch(() => {})

    return () => {
      active = false
      if (interval) window.clearInterval(interval)
      if (onOnline) window.removeEventListener('online', onOnline)
      resumeHandle?.remove?.().catch(() => {})
    }
  }, [])

  if (!MOBILE || !info?.hasUpdate || hidden) return null

  const marker = String(info.versionCode || info.latestVersion || '')
  const onDismiss = () => {
    dismissVersion(marker)
    setHidden(true)
  }

  const onInstall = async () => {
    if (busy) return
    if (!info.apkUrl) {
      window.open(RELEASES_PAGE, '_blank', 'noopener')
      return
    }
    setBusy(true)
    setPct(0)
    try {
      const expectedHash = await fetchChecksum(info.hashUrl)
      if (!/^[0-9a-f]{64}$/i.test(expectedHash || '')) {
        throw new Error(t('Checksum not available, so not installing'))
      }
      await downloadAndInstall(info.apkUrl, expectedHash, (received, total) => {
        if (total > 0) setPct(Math.min(100, Math.round((received / total) * 100)))
      })
    } catch (e) {
      toast(e?.message || t('Update failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + var(--conn, 0px) + 8px)',
        left: 12,
        right: 12,
        zIndex: 90,
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          {t('Update available')} · v{info.latestVersion}
        </div>
        <div className="muted small" style={{ marginTop: 2 }}>
          {busy
            ? (pct > 0 ? t('Downloading… {0}%', pct) : t('Downloading update…'))
            : t('A new Full HD APK version is ready to install.')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!busy && (
          <button type="button" className="btn ghost sm" onClick={onDismiss}>
            {t('Not now')}
          </button>
        )}
        <button type="button" className="btn primary sm" disabled={busy} onClick={onInstall}>
          {busy ? `${pct}%` : t('Update now')}
        </button>
      </div>
    </div>
  )
}

