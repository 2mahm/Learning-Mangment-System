import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import { Icon, PageHeader, StatCard } from '../../components/NurUI'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

export default function TeacherDashboard() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const { t }      = useTranslation()

  const TRACK_COLOR = {
    arabic:  { bg: '#FFE4E6', color: '#E11D48', label: t('teacher.subjectGroups.tracks.arabic') },
    quran:   { bg: '#D1FAE5', color: '#059669', label: t('teacher.subjectGroups.tracks.quran') },
    culture: { bg: '#EDE9FE', color: '#7C3AED', label: t('teacher.subjectGroups.tracks.culture') },
  }
  const [groups,   setGroups]   = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    client.get('/content/subject-groups/')
      .then(res => setGroups(res.data))
      .finally(() => setLoading(false))
  }, [])

  const totalLessons = groups.reduce((s, g) => s + (g.lesson_count ?? 0), 0)
  const pubLessons   = groups.reduce((s, g) => s + (g.published_lesson_count ?? 0), 0)

  return (
    <Layout>
      <PageHeader
        title={t('teacher.dashboard.welcomeBack', { name: user?.name?.split(' ')[0] ?? 'Teacher' })}
        subtitle={t('teacher.dashboard.subtitle')}
      />

      {/* Stats row */}
      <div className="stats-row">
        <StatCard icon="book"     label={t('teacher.dashboard.subjectGroups')}    value={groups.length}  tone="primary" />
        <StatCard icon="list"     label={t('teacher.dashboard.totalLessons')}     value={totalLessons}   tone="teal"    />
        <StatCard icon="eye"      label={t('teacher.dashboard.publishedLessons')} value={pubLessons}     tone="emerald" />
        <StatCard icon="academic" label={t('teacher.dashboard.draftLessons')}     value={totalLessons - pubLessons} tone="amber" />
      </div>

      {/* Subject groups grid */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{t('teacher.dashboard.yourGroups')}</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/teacher/subject-groups')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="plus" size={14} color="#fff" /> {t('teacher.dashboard.newGroup')}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <span className="spinner spinner-dark" />
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12, opacity: .5 }}>📖</div>
            <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{t('teacher.dashboard.noGroups')}</p>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20 }}>
              {t('teacher.dashboard.noGroupsSub')}
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/teacher/subject-groups')}
            >
              {t('teacher.dashboard.createGroup')}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
          {groups.map(g => {
            const tc = TRACK_COLOR[g.subject_track] || TRACK_COLOR.arabic
            return (
              <div
                key={g.id}
                className="card"
                onClick={() => navigate(`/teacher/subject-groups/${g.id}`)}
                style={{ cursor: 'pointer', transition: 'box-shadow .15s', overflow: 'hidden' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
              >
                {/* Track stripe */}
                <div style={{ height: 4, background: tc.color }} />
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="book" size={18} color={tc.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {g.title}
                      </div>
                      <div style={{ marginTop: 3 }}>
                        <span className="badge" style={{ background: tc.bg, color: tc.color, fontSize: 11 }}>
                          {tc.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>
                        {g.lesson_count ?? 0}
                      </span> {t('teacher.dashboard.lessons')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--emerald)', fontSize: 15 }}>
                        {g.published_lesson_count ?? 0}
                      </span> {t('teacher.dashboard.published')}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
