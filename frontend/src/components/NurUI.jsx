import { createContext, useCallback, useContext, useState } from 'react'

// ── Icon ──────────────────────────────────────────────────────────────────────

const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  user:      <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  book:      <><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h12"/></>,
  mail:      <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></>,
  clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></>,
  shield:    <><path d="M12 2 3 7l.1 10.3C3.2 21 7 23.7 12 25c5-1.3 8.8-4 8.9-7.7L21 7l-9-5z"/><path d="m9 12 2 2 4-4"/></>,
  school:    <><path d="M12 3L2 9l10 6 10-6-10-6z"/><path d="M2 17l10 6 10-6"/><path d="M2 12l10 6 10-6"/></>,
  check:     <path d="M5 12l5 5L20 7" strokeWidth="2.5"/>,
  x:         <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  plus:      <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  search:    <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></>,
  chevronL:  <path d="M15 6l-6 6 6 6"/>,
  chevron:   <path d="M9 6l6 6-6 6"/>,
  edit:      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  trash:     <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></>,
  logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></>,
  lock:      <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  copy:      <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  eye:       <><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
  building:  <><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22V12h6v10"/><path d="M9 7h1"/><path d="M9 11h1"/><path d="M14 7h1"/><path d="M14 11h1"/></>,
  star:      <path d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.8 6.5 20.3l1.1-6.3L3 9.6l6.3-.9L12 3z" fill="currentColor" stroke="none"/>,
  bell:      <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  academic:  <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></>,
  list:      <><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></>,
  grid:      <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
}

export function Icon({ name, size = 18, color = 'currentColor' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {PATHS[name] || null}
    </svg>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions, back, onBack }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {back && (
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              color: 'var(--ink-soft)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <Icon name="chevronL" size={16} /> {back}
          </button>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start', paddingTop: 2 }}>
          {actions}
        </div>
      )}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

const TONE_STYLES = {
  primary: { bg: 'var(--primary-light)', color: 'var(--primary)' },
  teal:    { bg: 'var(--teal-l)',        color: 'var(--teal)'    },
  amber:   { bg: 'var(--amber-l)',       color: 'var(--amber)'   },
  rose:    { bg: 'var(--rose-l)',        color: 'var(--rose)'    },
  emerald: { bg: 'var(--emerald-l)',     color: 'var(--emerald)' },
  violet:  { bg: 'var(--violet-l)',      color: 'var(--violet)'  },
}

export function StatCard({ icon, value, label, tone = 'primary', delta }) {
  const ts = TONE_STYLES[tone] || TONE_STYLES.primary
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: ts.bg }}>
        <Icon name={icon} size={20} color={ts.color} />
      </div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value ?? '—'}</div>
        {delta && <div className="stat-delta">{delta}</div>}
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const toast = {
    success: msg => push(msg, 'success'),
    error:   msg => push(msg, 'error'),
    info:    msg => push(msg, 'info'),
  }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon
              name={t.type === 'success' ? 'check' : t.type === 'error' ? 'x' : 'bell'}
              size={16}
              color="#fff"
            />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

// ── Avatar (initials) ─────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  ['var(--primary)', 'var(--violet)'],
  ['var(--teal)',    '#0e7490'],
  ['var(--emerald)', '#047857'],
  ['var(--amber)',   '#b45309'],
]

export function Avatar({ name = '', size = 36 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  const [c1, c2] = AVATAR_COLORS[idx]
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {initials || '?'}
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

export function ConfirmDialog({ open, title, message, onYes, onNo, onCancel, danger = false }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12,
        padding: '28px 32px', maxWidth: 420, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>{title}</h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-outline btn-sm" onClick={onNo}>No</button>
          <button
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onYes}
          >Yes</button>
        </div>
      </div>
    </div>
  )
}
