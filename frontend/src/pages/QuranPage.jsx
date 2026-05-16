import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getSurahs, getSurahEditions, searchQuran, audioUrl, mergeEditions } from '../api/quran'

// ── Shared helpers ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <span className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
    </div>
  )
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10,
        border: 'none', cursor: 'pointer', transition: 'all .15s',
        background: active ? 'var(--primary)' : 'var(--gray-100)',
        color: active ? '#fff' : 'var(--gray-700)',
        boxShadow: active ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function ArabicLine({ text }) {
  return (
    <div style={{
      direction: 'rtl', textAlign: 'right', fontFamily: "'Amiri', 'Arabic Typesetting', serif",
      fontSize: 24, lineHeight: 2.2, color: 'var(--gray-900)', letterSpacing: 0.5,
    }}>
      {text}
    </div>
  )
}

// ── Browse Tab ────────────────────────────────────────────────────────────────

function AyahCard({ ayah, tafsirOpen, onToggleTafsir, playing, onPlayAudio }) {
  const { t } = useTranslation()
  return (
    <div style={{
      marginBottom: 16, padding: '20px 24px', borderRadius: 14,
      border: '2px solid var(--gray-100)', background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {ayah.numberInSurah}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onPlayAudio}
            title={playing ? t('quran.pause') : t('quran.listen')}
            style={{
              padding: '5px 12px', fontSize: 13, borderRadius: 8,
              border: '1.5px solid var(--gray-200)', cursor: 'pointer',
              background: playing ? 'var(--primary)' : 'transparent',
              color: playing ? '#fff' : 'var(--gray-600)',
              transition: 'all .15s',
            }}
          >
            {playing ? `⏸ ${t('quran.pause')}` : `▶ ${t('quran.listen')}`}
          </button>
          <button
            onClick={onToggleTafsir}
            style={{
              padding: '5px 12px', fontSize: 13, borderRadius: 8,
              border: '1.5px solid var(--gray-200)', cursor: 'pointer',
              background: tafsirOpen ? 'var(--gray-100)' : 'transparent',
              color: 'var(--gray-600)', transition: 'all .15s',
            }}
          >
            {tafsirOpen ? t('quran.hideTafsir') : t('quran.showTafsir')}
          </button>
        </div>
      </div>

      <ArabicLine text={ayah.arabic} />

      {ayah.english && (
        <div style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.7, marginTop: 10, borderTop: '1px solid var(--gray-100)', paddingTop: 10 }}>
          {ayah.english}
        </div>
      )}

      {tafsirOpen && ayah.tafsir && (
        <div style={{
          marginTop: 12, padding: '12px 16px', borderRadius: 10,
          background: 'var(--gray-50, #f9fafb)', border: '1.5px solid var(--gray-100)',
          direction: 'rtl', textAlign: 'right',
          fontSize: 14, lineHeight: 1.9, color: 'var(--gray-700)',
          fontFamily: "'Amiri', 'Arabic Typesetting', serif",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 4, direction: 'ltr', textAlign: 'left' }}>
            تفسير الميسر
          </div>
          {ayah.tafsir}
        </div>
      )}
    </div>
  )
}

function BrowseTab({ surahs }) {
  const { t } = useTranslation()
  const [surahNum, setSurahNum] = useState(1)
  const [surahInfo, setSurahInfo] = useState(null)
  const [ayahs, setAyahs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tafsirOpen, setTafsirOpen] = useState({})
  const [playingNum, setPlayingNum] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    setAyahs([])
    setTafsirOpen({})
    setPlayingNum(null)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }

    getSurahEditions(surahNum, ['ar.uthmani', 'en.sahih', 'ar.muyassar'])
      .then(data => {
        setSurahInfo({ name: data[0]?.name, englishName: data[0]?.englishName, englishNameTranslation: data[0]?.englishNameTranslation, numberOfAyahs: data[0]?.numberOfAyahs })
        setAyahs(mergeEditions(data))
      })
      .catch(() => setError(t('quran.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [surahNum])

  const toggleAudio = (globalNum) => {
    if (playingNum === globalNum) {
      audioRef.current?.pause()
      setPlayingNum(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(audioUrl(globalNum))
    audioRef.current = audio
    audio.play().catch(() => {})
    setPlayingNum(globalNum)
    audio.onended = () => setPlayingNum(null)
    audio.onerror = () => setPlayingNum(null)
  }

  return (
    <div>
      {/* Surah selector */}
      <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <select
          value={surahNum}
          onChange={e => setSurahNum(+e.target.value)}
          className="form-control"
          style={{ maxWidth: 320 }}
        >
          {surahs.map(s => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.englishName} — {s.name}
            </option>
          ))}
        </select>
        {surahInfo && (
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            {surahInfo.englishNameTranslation} · {surahInfo.numberOfAyahs} {t('quran.ayahs')}
          </div>
        )}
      </div>

      {/* Surah header */}
      {surahInfo && (
        <div style={{
          marginBottom: 20, padding: '18px 24px', borderRadius: 14,
          background: 'var(--primary)', color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Amiri', serif", fontSize: 28, marginBottom: 4 }}>
            {surahInfo.name}
          </div>
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            {surahInfo.englishName} — {surahInfo.englishNameTranslation}
          </div>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? <Spinner /> : ayahs.map(ayah => (
        <AyahCard
          key={ayah.numberInSurah}
          ayah={ayah}
          tafsirOpen={!!tafsirOpen[ayah.numberInSurah]}
          onToggleTafsir={() => setTafsirOpen(p => ({ ...p, [ayah.numberInSurah]: !p[ayah.numberInSurah] }))}
          playing={playingNum === ayah.number}
          onPlayAudio={() => toggleAudio(ayah.number)}
        />
      ))}
    </div>
  )
}

// ── Search Tab ────────────────────────────────────────────────────────────────

function highlightMatch(text, keyword) {
  if (!keyword || !text.includes(keyword)) return text
  const parts = text.split(keyword)
  return parts.reduce((acc, part, i) => {
    if (i === 0) return [part]
    return [
      ...acc,
      <mark key={i} style={{ background: '#fef08a', borderRadius: 3, padding: '0 2px' }}>{keyword}</mark>,
      part,
    ]
  }, [])
}

function SearchTab() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const data = await searchQuran(query.trim())
      setResults((data.matches || []).slice(0, 10))
    } catch {
      setError(t('quran.searchFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          dir="rtl"
          className="form-control"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('quran.searchPlaceholder')}
          style={{ flex: 1, fontSize: 18, textAlign: 'right', fontFamily: "'Amiri', serif" }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : t('quran.search')}
        </button>
      </form>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {results !== null && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <p>{t('quran.noResults')}</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
            {t('quran.showing', { n: results.length })}
          </div>
          {results.map(match => (
            <div key={match.number} style={{
              marginBottom: 14, padding: '16px 20px', borderRadius: 12,
              border: '2px solid var(--gray-100)', background: '#fff',
            }}>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 8 }}>
                {match.surah.englishName} ({match.surah.number}:{match.numberInSurah})
                <span style={{ fontWeight: 400, color: 'var(--gray-400)', marginLeft: 8 }}>
                  — {match.surah.name}
                </span>
              </div>
              <div style={{
                direction: 'rtl', textAlign: 'right',
                fontFamily: "'Amiri', 'Arabic Typesetting', serif",
                fontSize: 20, lineHeight: 2.1, color: 'var(--gray-900)',
              }}>
                {highlightMatch(match.text, query.trim())}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Memorize Tab ──────────────────────────────────────────────────────────────

const PRAISE = [
  'Excellent! 🌟', 'Great job! 🎉', 'Well done! ✨', 'Amazing! 🏆', 'Keep it up! 💪',
  'Brilliant! 🌙', 'You remembered! 🌸', 'MashaAllah! 🌟',
]
const ENCOURAGEMENT = [
  "It's okay! Practice makes perfect.",
  "Keep trying! You'll get it next time.",
  "Don't give up! Learning takes time.",
  "Nice effort! Review this ayah and try again.",
]
const randomFrom = arr => arr[Math.floor(Math.random() * arr.length)]

function generateOptions(ayahs, questionAyah) {
  const nextIdx = ayahs.findIndex(a => a.numberInSurah === questionAyah.numberInSurah + 1)
  const correctAyah = ayahs[nextIdx]
  if (!correctAyah) return { correct: '', options: [] }

  const pool = ayahs.filter(a =>
    a.numberInSurah !== questionAyah.numberInSurah &&
    a.numberInSurah !== correctAyah.numberInSurah
  )
  const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, 3).map(a => a.arabic)
  const options = [correctAyah.arabic, ...distractors].sort(() => Math.random() - 0.5)
  return { correct: correctAyah.arabic, options }
}

function MemorizeTab({ surahs }) {
  const { t } = useTranslation()
  const [difficulty, setDifficulty] = useState('juz_amma')
  const [customSurah, setCustomSurah] = useState(78)
  const [phase, setPhase] = useState('setup') // setup | loading | question | answered | done
  const [surahAyahs, setSurahAyahs] = useState([])
  const [surahName, setSurahName] = useState('')
  const [questionList, setQuestionList] = useState([])
  const [qIdx, setQIdx] = useState(0)
  const [currentOptions, setCurrentOptions] = useState([])
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [feedbackMsg, setFeedbackMsg] = useState('')

  const startQuiz = async () => {
    setPhase('loading')
    const surahNum = difficulty === 'juz_amma'
      ? Math.floor(Math.random() * (114 - 78 + 1)) + 78
      : customSurah

    try {
      const data = await getSurahEditions(surahNum, ['ar.uthmani', 'en.sahih'])
      const ayahs = mergeEditions(data)
      setSurahAyahs(ayahs)
      setSurahName(`${data[0]?.englishName} (${data[0]?.name})`)

      const eligible = ayahs.slice(0, -1) // exclude last (no next ayah)
      if (eligible.length === 0) { setPhase('setup'); return }

      const shuffled = [...eligible].sort(() => Math.random() - 0.5).slice(0, 10)
      setQuestionList(shuffled)
      setQIdx(0)
      setScore({ correct: 0, total: 0 })

      const { correct, options } = generateOptions(ayahs, shuffled[0])
      setCorrectAnswer(correct)
      setCurrentOptions(options)
      setSelectedAnswer(null)
      setPhase('question')
    } catch {
      setPhase('setup')
    }
  }

  const handleAnswer = (answer) => {
    const isCorrect = answer === correctAnswer
    setSelectedAnswer(answer)
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setFeedbackMsg(isCorrect ? randomFrom(PRAISE) : randomFrom(ENCOURAGEMENT))
    setPhase('answered')
  }

  const handleNext = () => {
    const next = qIdx + 1
    if (next >= questionList.length) { setPhase('done'); return }
    const { correct, options } = generateOptions(surahAyahs, questionList[next])
    setQIdx(next)
    setCorrectAnswer(correct)
    setCurrentOptions(options)
    setSelectedAnswer(null)
    setFeedbackMsg('')
    setPhase('question')
  }

  const isCorrect = selectedAnswer === correctAnswer

  // ── Setup screen ──
  if (phase === 'setup') return (
    <div style={{ maxWidth: 480 }}>
      <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 24, lineHeight: 1.7 }}>
        Test your memory! An ayah will appear and you must pick the <strong>next ayah</strong> from four choices.
      </p>

      <div className="form-group">
        <label className="form-label">{t('quran.difficulty')}</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { value: 'juz_amma', label: t('quran.juzAmma') },
            { value: 'custom',   label: t('quran.chooseSurah') },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`btn btn-sm ${difficulty === opt.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setDifficulty(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {difficulty === 'custom' && (
        <div className="form-group">
          <label className="form-label">{t('quran.selectSurah')}</label>
          <select
            className="form-control"
            value={customSurah}
            onChange={e => setCustomSurah(+e.target.value)}
          >
            {surahs.map(s => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.englishName} — {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button className="btn btn-primary" style={{ marginTop: 8, minWidth: 160 }} onClick={startQuiz}>
        {t('quran.startQuiz')}
      </button>
    </div>
  )

  if (phase === 'loading') return <Spinner />

  // ── Done screen ──
  if (phase === 'done') {
    const pct = score.total > 0 ? Math.round(score.correct / score.total * 100) : 0
    const emoji = pct === 100 ? '🏆' : pct >= 70 ? '🌟' : pct >= 40 ? '👍' : '📚'
    return (
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{
          padding: '32px 24px', borderRadius: 16, marginBottom: 24,
          background: pct >= 70 ? '#f0fdf4' : '#f9fafb',
          border: `2px solid ${pct >= 70 ? '#a7f3d0' : 'var(--gray-200)'}`,
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{emoji}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: pct >= 70 ? '#059669' : 'var(--gray-700)' }}>
            {pct}%
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: 'var(--gray-700)' }}>
            {score.correct} / {score.total} {t('quran.correct')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 8 }}>
            Surah {surahName}
          </div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 20, lineHeight: 1.7 }}>
          {pct === 100
            ? t('quran.perfectScore')
            : pct >= 70
            ? t('quran.goodScore')
            : t('quran.keepPracticing')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={startQuiz}>{t('quran.tryAgain')}</button>
          <button className="btn btn-outline" onClick={() => setPhase('setup')}>{t('quran.newQuiz')}</button>
        </div>
      </div>
    )
  }

  // ── Question / Answered screens ──
  const currentQ = questionList[qIdx]
  return (
    <div style={{ maxWidth: 580 }}>
      {/* Score & progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          {t('quran.question', { current: qIdx + 1, total: questionList.length })}
          <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--gray-400)' }}>{surahName}</span>
        </div>
        <div style={{
          padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
          background: 'var(--primary-light, #eff6ff)', color: 'var(--primary)',
        }}>
          {score.correct} / {score.total} ✓
        </div>
      </div>

      {/* Prompt */}
      <div style={{
        padding: '20px 24px', borderRadius: 14, marginBottom: 20,
        background: 'var(--gray-50, #f9fafb)', border: '2px solid var(--gray-100)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 10, fontWeight: 600 }}>
          {t('quran.whatComesAfter')}
        </div>
        <ArabicLine text={currentQ.arabic} />
        {currentQ.english && (
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 8 }}>
            {currentQ.english}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {currentOptions.map((opt, i) => {
          const isSelected = selectedAnswer === opt
          const isRight    = opt === correctAnswer
          let bg = '#fff', border = 'var(--gray-200)', color = 'var(--gray-800)'
          if (phase === 'answered') {
            if (isRight)            { bg = '#f0fdf4'; border = '#10b981'; color = '#065f46' }
            else if (isSelected)    { bg = '#fff5f5'; border = '#f87171'; color = '#7f1d1d' }
          } else if (isSelected) {
            bg = 'var(--primary-light, #eff6ff)'; border = 'var(--primary)'; color = 'var(--primary)'
          }

          return (
            <div
              key={i}
              onClick={phase === 'question' ? () => handleAnswer(opt) : undefined}
              style={{
                padding: '14px 18px', borderRadius: 12,
                border: `2px solid ${border}`, background: bg, color,
                cursor: phase === 'question' ? 'pointer' : 'default',
                transition: 'all .15s',
                direction: 'rtl', textAlign: 'right',
                fontFamily: "'Amiri', 'Arabic Typesetting', serif",
                fontSize: 18, lineHeight: 1.9,
              }}
            >
              {opt}
              {phase === 'answered' && isRight  && <span style={{ marginRight: 8, float: 'left' }}>✅</span>}
              {phase === 'answered' && isSelected && !isRight && <span style={{ marginRight: 8, float: 'left' }}>❌</span>}
            </div>
          )
        })}
      </div>

      {/* Feedback */}
      {phase === 'answered' && (
        <div style={{
          padding: '16px 20px', borderRadius: 12, marginBottom: 16, textAlign: 'center',
          background: isCorrect ? '#f0fdf4' : '#fefce8',
          border: `2px solid ${isCorrect ? '#a7f3d0' : '#fde68a'}`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: isCorrect ? '#065f46' : '#92400e' }}>
            {feedbackMsg}
          </div>
          {!isCorrect && (
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 6 }}>
              The correct answer is highlighted above in green.
            </div>
          )}
        </div>
      )}

      {phase === 'answered' && (
        <button className="btn btn-primary" style={{ width: '100%', padding: '13px 0', fontSize: 15 }} onClick={handleNext}>
          {qIdx + 1 >= questionList.length ? 'See Results' : 'Next Question →'}
        </button>
      )}
    </div>
  )
}

// ── Main QuranPage ────────────────────────────────────────────────────────────

export default function QuranPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('browse')
  const [surahs, setSurahs] = useState([])
  const [loadingSurahs, setLoadingSurahs] = useState(true)

  useEffect(() => {
    getSurahs()
      .then(data => setSurahs(data))
      .catch(() => {})
      .finally(() => setLoadingSurahs(false))
  }, [])

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '32px 24px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>
          📖 {t('quran.title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
          {t('quran.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <TabBtn label={`📖 ${t('quran.browse')}`}   active={tab === 'browse'}   onClick={() => setTab('browse')} />
        <TabBtn label={`🔍 ${t('quran.search')}`}   active={tab === 'search'}   onClick={() => setTab('search')} />
        <TabBtn label={`🧠 ${t('quran.memorize')}`} active={tab === 'memorize'} onClick={() => setTab('memorize')} />
      </div>

      {loadingSurahs ? (
        <Spinner />
      ) : (
        <>
          {tab === 'browse'   && <BrowseTab   surahs={surahs} />}
          {tab === 'search'   && <SearchTab />}
          {tab === 'memorize' && <MemorizeTab surahs={surahs} />}
        </>
      )}
    </div>
  )
}
