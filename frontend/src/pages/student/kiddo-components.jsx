// Shared Kiddo design-system components — ported from the handoff prototype

export const TRACK_CONFIG = {
  arabic:  { color: '#FF6B9D', shadow: '#d94f80', emoji: 'أ',  label: 'Arabic'  },
  quran:   { color: '#4CD471', shadow: '#2eb554', emoji: 'ﷲ', label: "Qur'an"  },
  culture: { color: '#8B5CF6', shadow: '#6b3fcc', emoji: '🎨', label: 'Culture' },
}

export function KiddoIcon({ name, size = 24, color = 'currentColor' }) {
  const s = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  const p = {
    home:     <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></>,
    book:     <><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h12"/></>,
    trophy:   <><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M5 5v2a3 3 0 0 0 3 3M19 5v2a3 3 0 0 1-3 3"/><path d="M9 14h6v3H9zM7 20h10"/></>,
    smile:    <><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".8" fill={color}/><circle cx="15" cy="10" r=".8" fill={color}/><path d="M8 14a4 4 0 0 0 8 0"/></>,
    star:     <path d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.8 6.5 20.3l1.1-6.3L3 9.6l6.3-.9L12 3z" fill={color} stroke="none"/>,
    flame:    <path d="M12 3s4 4 4 8a4 4 0 1 1-8 0c0-2 1-3 1-3s0 2 2 2 1-3 1-7z" fill={color} stroke="none"/>,
    coin:     <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M12 9v6M9 12h6"/></>,
    play:     <path d="M7 5l12 7-12 7V5z" fill={color}/>,
    lock:     <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    chevron:  <path d="M9 6l6 6-6 6"/>,
    chevronL: <path d="M15 6l-6 6 6 6"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2L5 5.8l-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.9c.6.5 1.3.9 2 1.2L10 21h4l.5-2.5c.7-.3 1.4-.7 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/></>,
    sound:    <><path d="M5 9h4l5-4v14l-5-4H5z"/><path d="M17 9a4 4 0 0 1 0 6"/></>,
    palette:  <><path d="M12 3a9 9 0 1 0 0 18c1 0 2-1 2-2s-1-1-1-2 1-2 2-2h2a4 4 0 0 0 4-4c0-4-4-8-9-8z"/><circle cx="7.5" cy="11.5" r="1" fill={color}/><circle cx="10.5" cy="7.5" r="1" fill={color}/><circle cx="15.5" cy="8.5" r="1" fill={color}/></>,
    check:    <path d="M5 12l5 5L20 7" strokeWidth="3"/>,
    user:     <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  }
  return <svg {...s}>{p[name] || null}</svg>
}

export function KiddoMascot({ size = 120, float: floatAnim = false }) {
  return (
    <div className={floatAnim ? 'k-anim-float' : ''} style={{ display: 'inline-block' }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible' }}>
        <ellipse cx="100" cy="186" rx="60" ry="6" fill="rgba(0,0,0,.1)" />
        <path
          d="M40 110 C 40 60, 70 40, 100 40 C 130 40, 160 60, 160 110 L 160 150 C 160 175, 140 185, 100 185 C 60 185, 40 175, 40 150 Z"
          fill="#FFB45C" stroke="#2B1D47" strokeWidth="4"
        />
        <ellipse cx="100" cy="135" rx="38" ry="32" fill="#FFE9C9" />
        <path d="M55 60 L 45 35 L 75 50 Z" fill="#FFB45C" stroke="#2B1D47" strokeWidth="4" strokeLinejoin="round" />
        <path d="M145 60 L 155 35 L 125 50 Z" fill="#FFB45C" stroke="#2B1D47" strokeWidth="4" strokeLinejoin="round" />
        <path d="M58 55 L 53 42 L 68 49 Z" fill="#FF8A3D" />
        <path d="M142 55 L 147 42 L 132 49 Z" fill="#FF8A3D" />
        <ellipse cx="60" cy="115" rx="10" ry="6" fill="#FF6B9D" opacity=".55" />
        <ellipse cx="140" cy="115" rx="10" ry="6" fill="#FF6B9D" opacity=".55" />
        <circle cx="78" cy="95" r="7" fill="#2B1D47" />
        <circle cx="122" cy="95" r="7" fill="#2B1D47" />
        <circle cx="80" cy="93" r="2" fill="#fff" />
        <circle cx="124" cy="93" r="2" fill="#fff" />
        <path d="M88 115 Q 100 128 112 115" stroke="#2B1D47" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <circle cx="36" cy="130" r="14" fill="#FFB45C" stroke="#2B1D47" strokeWidth="4" />
        <circle cx="164" cy="130" r="14" fill="#FFB45C" stroke="#2B1D47" strokeWidth="4" />
      </svg>
    </div>
  )
}

export function KPill({ children, color = 'var(--k-primary)' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: color, color: '#fff', padding: '5px 13px',
      borderRadius: 999, fontFamily: 'var(--k-display-font)', fontWeight: 700, fontSize: 13,
    }}>
      {children}
    </span>
  )
}

export function KProgress({ value = 0, color = 'var(--k-primary)', height = 10 }) {
  return (
    <div style={{ background: 'rgba(0,0,0,.08)', height, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${Math.max(0, Math.min(100, value))}%`,
        background: color, borderRadius: 999,
        transition: 'width .4s cubic-bezier(.2,.9,.3,1.2)',
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.12), inset 0 2px 0 rgba(255,255,255,.2)',
      }} />
    </div>
  )
}

export function KSpinner({ size = 28 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '3px solid rgba(255,138,61,.25)',
      borderTopColor: 'var(--k-primary)',
      borderRadius: '50%',
      animation: 'k-spin 1s linear infinite',
    }} />
  )
}
