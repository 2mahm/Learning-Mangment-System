import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import studentClient from '../../api/studentClient'
import './kiddo-theme.css'
import {
  TRACK_CONFIG, KiddoIcon, KiddoMascot, KPill, KProgress, KSpinner,
} from './kiddo-components'

// ── Bottom Nav ────────────────────────────────────────────────────────────────

function BottomNav({ current, onHome, onLearn, onRewards, onProfile }) {
  const { t } = useTranslation()
  const items = [
    { id: 'home',    icon: 'home',   label: t('student.dashboard.home'),    action: onHome    },
    { id: 'learn',   icon: 'book',   label: t('student.dashboard.learn'),   action: onLearn   },
    { id: 'rewards', icon: 'trophy', label: t('student.dashboard.rewards'), action: onRewards },
    { id: 'me',      icon: 'smile',  label: t('student.dashboard.me'),      action: onProfile },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--k-surface)',
      borderTop: '1px solid rgba(0,0,0,.06)',
      padding: '8px 6px 20px',
      display: 'flex', justifyContent: 'space-around',
      boxShadow: '0 -8px 20px rgba(0,0,0,.06)',
      zIndex: 50,
    }}>
      {items.map(it => (
        <button key={it.id} onClick={it.action} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '4px 12px', borderRadius: 14,
          color: current === it.id ? 'var(--k-primary)' : 'var(--k-ink-soft)',
        }}>
          <div style={{
            background: current === it.id ? 'rgba(255,138,61,.15)' : 'transparent',
            borderRadius: 12, padding: '6px 12px',
          }}>
            <KiddoIcon
              name={it.icon} size={26}
              color={current === it.id ? 'var(--k-primary)' : 'var(--k-ink-soft)'}
            />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800,
            fontFamily: 'var(--k-display-font)',
          }}>
            {it.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Home Screen ───────────────────────────────────────────────────────────────

function HomeScreen({ student, groups, loading, onLearn }) {
  const firstName = student.name?.split(' ')[0] || student.name

  return (
    <div style={{ padding: '16px 16px 100px', minHeight: '100%' }}>

      {/* Greeting row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--k-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, boxShadow: '0 3px 0 var(--k-primary-d)',
            overflow: 'hidden',
          }}>
            {student.avatar_url
              ? <img src={student.avatar_url} alt="avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '🎒'
            }
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--k-ink-soft)', fontWeight: 700 }}>Hi,</div>
            <div style={{
              fontFamily: 'var(--k-display-font)', fontSize: 22,
              color: 'var(--k-ink)', lineHeight: 1,
            }}>
              {firstName}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <KPill color="var(--k-red)">🔥 7</KPill>
          <KPill color="var(--k-yellow)">⭐ 124</KPill>
        </div>
      </div>

      {/* Today's mission card */}
      {loading ? null : groups.length > 0 && (
        <div
          onClick={onLearn}
          style={{
            background: 'linear-gradient(135deg, var(--k-primary) 0%, var(--k-pink) 100%)',
            borderRadius: 28, padding: 18, color: '#fff',
            position: 'relative', overflow: 'hidden',
            cursor: 'pointer', marginBottom: 20,
            boxShadow: '0 8px 0 rgba(0,0,0,.12)',
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 130,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, opacity: .85,
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>
              Today's Mission
            </div>
            <div style={{
              fontFamily: 'var(--k-display-font)', fontSize: 22,
              lineHeight: 1.2, marginTop: 5,
            }}>
              {groups[0].title}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
            }}>
              <KiddoIcon name="play" size={14} color="#fff" />
              <span style={{ fontWeight: 800, fontSize: 14 }}>Start Now</span>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <KiddoMascot size={92} />
          </div>
        </div>
      )}

      {/* Subjects section */}
      <div style={{
        fontFamily: 'var(--k-display-font)', fontSize: 18,
        marginBottom: 12, color: 'var(--k-ink)',
      }}>
        Subjects
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <KSpinner size={32} />
        </div>
      ) : groups.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '32px 0',
          color: 'var(--k-ink-soft)', fontFamily: 'var(--k-display-font)', fontSize: 16,
        }}>
          No content available yet.
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
        }}>
          {groups.slice(0, 6).map(g => {
            const tc = TRACK_CONFIG[g.subject_track] || TRACK_CONFIG.arabic
            return (
              <button
                key={g.id}
                onClick={onLearn}
                className="k-anim-wiggle"
                style={{
                  border: 'none',
                  background: `${tc.color}28`,
                  borderRadius: 22, padding: '16px 8px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  cursor: 'pointer',
                  boxShadow: `0 4px 0 ${tc.color}50`,
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 14, background: tc.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontFamily: 'var(--k-display-font)',
                  fontWeight: 800, fontSize: 18,
                  boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.15)',
                }}>
                  {tc.emoji}
                </div>
                <span style={{
                  fontFamily: 'var(--k-display-font)', fontWeight: 700, fontSize: 11,
                  color: 'var(--k-ink)', textAlign: 'center', lineHeight: 1.3,
                }}>
                  {g.title}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Keep learning */}
      {groups.length > 0 && (
        <>
          <div style={{
            fontFamily: 'var(--k-display-font)', fontSize: 18,
            margin: '22px 0 12px', color: 'var(--k-ink)',
          }}>
            Keep Learning
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.slice(0, 3).map(g => {
              const tc = TRACK_CONFIG[g.subject_track] || TRACK_CONFIG.arabic
              return (
                <div
                  key={g.id}
                  onClick={onLearn}
                  style={{
                    background: 'var(--k-surface)', borderRadius: 20, padding: 12,
                    display: 'flex', gap: 12, alignItems: 'center',
                    boxShadow: 'var(--k-card-sh)', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, background: tc.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, flexShrink: 0,
                  }}>
                    {tc.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--k-display-font)', fontSize: 15,
                      color: 'var(--k-ink)', marginBottom: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {g.title}
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--k-ink-soft)', marginBottom: 6,
                    }}>
                      {g.published_lesson_count} lesson{g.published_lesson_count !== 1 ? 's' : ''}
                    </div>
                    <KProgress value={0} color={tc.color} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Rewards Screen ────────────────────────────────────────────────────────────

function RewardsScreen() {
  const badges = [
    { name: 'Star Learner', color: 'var(--k-primary)', icon: 'trophy', earned: true  },
    { name: 'Reader',       color: 'var(--k-accent)',  icon: 'book',   earned: true  },
    { name: 'Artist',       color: 'var(--k-pink)',    icon: 'palette', earned: true },
    { name: '7-Day Streak', color: 'var(--k-red)',     icon: 'flame',  earned: true  },
    { name: 'Scientist',    color: 'var(--k-green)',   icon: 'lock',   earned: false },
    { name: 'Coder',        color: 'var(--k-violet)',  icon: 'lock',   earned: false },
  ]
  const stats = [
    { label: 'Day Streak', val: 7,   color: 'var(--k-red)',    icon: 'flame' },
    { label: 'Stars',      val: 124, color: 'var(--k-yellow)', icon: 'star'  },
    { label: 'Coins',      val: 38,  color: 'var(--k-primary)', icon: 'coin' },
  ]
  return (
    <div style={{ padding: '16px 16px 100px', minHeight: '100%' }}>
      <h2 style={{
        fontFamily: 'var(--k-display-font)', fontSize: 24,
        margin: '0 0 16px', color: 'var(--k-ink)',
      }}>
        Rewards
      </h2>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: 'var(--k-surface)', borderRadius: 20, padding: '12px 8px',
            textAlign: 'center', boxShadow: 'var(--k-card-sh)',
          }}>
            <div style={{
              width: 40, height: 40, margin: '0 auto 6px', borderRadius: 12,
              background: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <KiddoIcon name={s.icon} size={22} color="#fff" />
            </div>
            <div style={{
              fontFamily: 'var(--k-display-font)', fontSize: 22,
              color: 'var(--k-ink)', lineHeight: 1,
            }}>
              {s.val}
            </div>
            <div style={{ fontSize: 11, color: 'var(--k-ink-soft)', fontWeight: 700, marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div style={{
        fontFamily: 'var(--k-display-font)', fontSize: 18,
        marginBottom: 12, color: 'var(--k-ink)',
      }}>
        Badges
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {badges.map((b, i) => (
          <div key={i} style={{
            background: 'var(--k-surface)', borderRadius: 18, padding: '14px 6px',
            textAlign: 'center', boxShadow: 'var(--k-card-sh)',
            opacity: b.earned ? 1 : 0.4,
          }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 6px', borderRadius: '50%',
              background: b.earned ? b.color : 'rgba(0,0,0,.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: b.earned ? '0 4px 0 rgba(0,0,0,.15)' : 'none',
            }}>
              <KiddoIcon name={b.icon} size={28} color="#fff" />
            </div>
            <div style={{
              fontSize: 11, fontWeight: 800, color: 'var(--k-ink)',
              lineHeight: 1.2, padding: '0 4px',
            }}>
              {b.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Profile Screen ────────────────────────────────────────────────────────────

function ProfileScreen({ student, onLogout, onAvatarChange }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    setUploading(true)
    try {
      const res = await studentClient.post('/student-avatar/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onAvatarChange(res.data.avatar_url)
    } catch {
      // silently ignore upload errors
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const rows = [
    { icon: 'sound',    label: 'Sound',    toggle: true, on: true  },
    { icon: 'palette',  label: 'Theme',    toggle: false           },
    { icon: 'settings', label: 'Settings', toggle: false           },
  ]
  return (
    <div style={{ padding: '16px 16px 100px', minHeight: '100%' }}>

      {/* Avatar block */}
      <div style={{ textAlign: 'center', padding: '20px 0 28px' }}>
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {/* Tappable avatar */}
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          style={{
            position: 'relative', width: 110, height: 110, margin: '0 auto 14px',
            borderRadius: '50%', background: 'var(--k-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 60, boxShadow: '0 6px 0 var(--k-primary-d)',
            cursor: 'pointer', overflow: 'hidden',
          }}
        >
          {student.avatar_url
            ? <img src={student.avatar_url} alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : '🎒'
          }
          {/* Camera overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,.35)', padding: '6px 0 4px',
            display: 'flex', justifyContent: 'center',
          }}>
            {uploading
              ? <span style={{ fontSize: 14 }}>⏳</span>
              : <span style={{ fontSize: 14 }}>📷</span>
            }
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--k-display-font)', fontSize: 26, color: 'var(--k-ink)',
        }}>
          {student.name}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
          {student.grade && <KPill color="var(--k-primary)">Grade {student.grade}</KPill>}
          <KPill color="var(--k-yellow)">⭐ 124</KPill>
        </div>
      </div>

      {/* Info card */}
      <div style={{
        background: 'var(--k-surface)', borderRadius: 20,
        boxShadow: 'var(--k-card-sh)', overflow: 'hidden', marginBottom: 16,
      }}>
        {[
          { label: 'Username', value: student.username },
          { label: 'Grade',    value: student.grade    },
          { label: 'Parent',   value: student.parent_name },
        ].filter(r => r.value).map((r, i, arr) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px',
            borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: 'var(--k-ink-soft)',
              textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
              {r.label}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 600, color: 'var(--k-ink)',
              fontFamily: r.label === 'Username' ? 'monospace' : 'inherit',
            }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {/* Settings rows */}
      <div style={{
        background: 'var(--k-surface)', borderRadius: 20,
        boxShadow: 'var(--k-card-sh)', overflow: 'hidden', marginBottom: 16,
      }}>
        {rows.map((row, i, arr) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
            borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(255,138,61,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <KiddoIcon name={row.icon} size={20} color="var(--k-primary)" />
            </div>
            <div style={{
              flex: 1, fontFamily: 'var(--k-display-font)',
              fontSize: 16, color: 'var(--k-ink)',
            }}>
              {row.label}
            </div>
            {row.toggle ? (
              <div style={{
                width: 50, height: 28, borderRadius: 999,
                background: row.on ? 'var(--k-green)' : 'rgba(0,0,0,.15)',
                position: 'relative', cursor: 'pointer',
              }}>
                <div style={{
                  position: 'absolute', top: 3,
                  left: row.on ? 25 : 3,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#fff', transition: 'left .2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,.2)',
                }} />
              </div>
            ) : (
              <KiddoIcon name="chevron" size={20} color="var(--k-ink-soft)" />
            )}
          </div>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={onLogout}
        style={{
          width: '100%', padding: '16px', border: 'none', borderRadius: 20,
          background: 'var(--k-red)', color: '#fff',
          fontFamily: 'var(--k-display-font)', fontSize: 17, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 5px 0 rgba(200,50,50,.4)',
        }}
      >
        Sign Out
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [screen,  setScreen]  = useState('home')
  const [groups,  setGroups]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('lms_student')
    if (!stored) {
      navigate('/login', { replace: true })
      return
    }
    setStudent(JSON.parse(stored))
    studentClient.get('/content/published/subject-groups/')
      .then(res => setGroups(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('lms_student')
    navigate('/login', { replace: true })
  }

  const handleAvatarChange = (avatarUrl) => {
    const updated = { ...student, avatar_url: avatarUrl }
    setStudent(updated)
    localStorage.setItem('lms_student', JSON.stringify(updated))
  }

  const goLearn = () => navigate('/student/content')

  if (!student) return null

  return (
    <div className="kiddo-wrap" style={{ maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {screen === 'home' && (
        <HomeScreen
          student={student}
          groups={groups}
          loading={loading}
          onLearn={goLearn}
        />
      )}
      {screen === 'rewards' && <RewardsScreen />}
      {screen === 'profile' && (
        <ProfileScreen student={student} onLogout={handleLogout} onAvatarChange={handleAvatarChange} />
      )}

      <BottomNav
        current={screen === 'rewards' ? 'rewards' : screen === 'profile' ? 'me' : 'home'}
        onHome={() => setScreen('home')}
        onLearn={goLearn}
        onRewards={() => setScreen('rewards')}
        onProfile={() => setScreen('profile')}
      />
    </div>
  )
}
