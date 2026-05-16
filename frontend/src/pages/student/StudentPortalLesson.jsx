import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import studentClient from '../../api/studentClient'
import { submitExerciseStudent as submitExercise, getMyResultStudent as getMyResult } from '../../api/exercises'
import { getSurahEditions, mergeEditions, audioUrl } from '../../api/quran'

// ── Matching helpers ──────────────────────────────────────────────────────────

const PAIR_COLORS = [
  { border: '#E53E3E', bg: '#FFF5F5', text: '#742A2A' },
  { border: '#3182CE', bg: '#EBF8FF', text: '#2A4365' },
  { border: '#D69E2E', bg: '#FFFFF0', text: '#744210' },
  { border: '#38A169', bg: '#F0FFF4', text: '#1C4532' },
  { border: '#805AD5', bg: '#FAF5FF', text: '#44337A' },
  { border: '#DD6B20', bg: '#FFFAF0', text: '#7B341E' },
  { border: '#D53F8C', bg: '#FFF5F7', text: '#702459' },
  { border: '#2C7A7B', bg: '#E6FFFA', text: '#234E52' },
]

function MatchingInput({ lefts = [], options = [], answer, onChange }) {
  const shuffled = useMemo(
    () => options.length > 0 ? [...options].sort(() => Math.random() - 0.5) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(options)]
  )
  const [selectedLeft, setSelectedLeft] = useState(null)
  const [colorMap, setColorMap] = useState({})

  const handleLeftClick = (pairId) => {
    setSelectedLeft(prev => prev === pairId ? null : pairId)
  }

  const handleRightClick = (rightVal) => {
    if (!selectedLeft) return
    const newAnswer   = { ...(answer || {}) }
    const newColorMap = { ...colorMap }

    const prevLeft = Object.entries(newAnswer).find(([, v]) => v === rightVal)?.[0]
    if (prevLeft) { delete newAnswer[prevLeft]; delete newColorMap[prevLeft] }

    const usedIndices = new Set(Object.values(newColorMap))
    let colorIdx = 0
    while (usedIndices.has(colorIdx)) colorIdx++
    colorIdx = colorIdx % PAIR_COLORS.length

    newAnswer[selectedLeft]   = rightVal
    newColorMap[selectedLeft] = colorIdx
    setColorMap(newColorMap)
    setSelectedLeft(null)
    onChange(newAnswer)
  }

  const handleReset = () => { setSelectedLeft(null); setColorMap({}); onChange({}) }

  const itemStyle = (active, colorIdx) => {
    const c = colorIdx !== undefined ? PAIR_COLORS[colorIdx % PAIR_COLORS.length] : null
    return {
      padding: '10px 16px', borderRadius: 8,
      border: `1.5px solid ${active ? '#7F77DD' : c ? c.border : 'var(--gray-200)'}`,
      background: active ? '#EEEDFE' : c ? c.bg : '#fff',
      color: active ? '#3C3489' : c ? c.text : 'var(--gray-800)',
      fontSize: 14, cursor: 'pointer', userSelect: 'none',
      textAlign: 'center', transition: 'all .15s',
    }
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 10 }}>
        Click a left item then a right item to connect them.
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 140, flexShrink: 0 }}>
          {lefts.map(p => {
            const isSelected = selectedLeft === p.id
            const colorIdx   = isSelected ? undefined : colorMap[p.id]
            return (
              <div key={p.id} onClick={() => handleLeftClick(p.id)} style={itemStyle(isSelected, colorIdx)}>
                {p.text}
              </div>
            )
          })}
        </div>
        <div style={{ width: 24, flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 140, flexShrink: 0 }}>
          {shuffled.map(r => {
            const matchedLeftId = Object.entries(answer || {}).find(([, v]) => v === r)?.[0]
            const colorIdx      = matchedLeftId !== undefined ? colorMap[matchedLeftId] : undefined
            const isTarget      = selectedLeft !== null
            return (
              <div key={r} onClick={() => handleRightClick(r)} style={{
                ...itemStyle(false, colorIdx),
                border: colorIdx !== undefined
                  ? `1.5px solid ${PAIR_COLORS[colorIdx % PAIR_COLORS.length].border}`
                  : isTarget ? '1.5px solid #7F77DD55' : '1.5px solid var(--gray-200)',
                cursor: isTarget || colorIdx !== undefined ? 'pointer' : 'default',
              }}>
                {r}
              </div>
            )
          })}
        </div>
      </div>
      {Object.keys(answer || {}).length > 0 && (
        <button type="button" onClick={handleReset} style={{
          marginTop: 10, fontSize: 12, padding: '4px 14px',
          border: '1px solid var(--gray-200)', borderRadius: 6,
          background: 'transparent', color: 'var(--gray-500)', cursor: 'pointer',
        }}>
          Reset
        </button>
      )}
    </div>
  )
}

// ── Custom question components ────────────────────────────────────────────────

function QuestionCard({ index, question, children }) {
  return (
    <div style={{
      marginBottom: 20, padding: '20px 24px', borderRadius: 14,
      border: '2px solid var(--gray-100)', background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)', marginBottom: 14, lineHeight: 1.5 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: '50%', background: 'var(--primary)',
          color: '#fff', fontSize: 12, fontWeight: 800, marginRight: 10, flexShrink: 0,
        }}>{index + 1}</span>
        {question.text}
      </div>
      {question.image && (
        <img src={question.image} alt=""
          style={{ maxWidth: 260, borderRadius: 8, marginBottom: 14, display: 'block' }} />
      )}
      {children}
    </div>
  )
}

function MultiChoiceQuestion({ question, index, answer, onChange }) {
  return (
    <QuestionCard index={index} question={question}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(question.choices || []).map(choice => {
          const selected = answer === choice
          return (
            <div key={choice} onClick={() => onChange(choice)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 10,
              border: `2px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
              background: selected ? 'var(--primary-light, #eff6ff)' : '#fafafa',
              cursor: 'pointer', transition: 'all .15s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selected ? 'var(--primary)' : 'var(--gray-300)'}`,
                background: selected ? 'var(--primary)' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <span style={{ fontSize: 14, color: 'var(--gray-800)', fontWeight: selected ? 600 : 400 }}>
                {choice}
              </span>
            </div>
          )
        })}
      </div>
    </QuestionCard>
  )
}

function TrueFalseQuestion({ question, index, answer, onChange }) {
  return (
    <QuestionCard index={index} question={question}>
      <div style={{ display: 'flex', gap: 12 }}>
        {[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }].map(opt => {
          const selected = answer === opt.value
          return (
            <div key={opt.value} onClick={() => onChange(opt.value)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '14px 0', borderRadius: 10,
              border: `2px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
              background: selected ? 'var(--primary-light, #eff6ff)' : '#fafafa',
              cursor: 'pointer', fontWeight: selected ? 700 : 400, fontSize: 15,
              color: selected ? 'var(--primary)' : 'var(--gray-700)', transition: 'all .15s',
            }}>
              {opt.label}
            </div>
          )
        })}
      </div>
    </QuestionCard>
  )
}

function TextQuestion({ question, index, answer, onChange }) {
  return (
    <QuestionCard index={index} question={question}>
      <textarea
        value={answer || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Type your answer here…"
        rows={3}
        style={{
          width: '100%', padding: '12px 14px', fontSize: 14,
          border: '2px solid var(--gray-200)', borderRadius: 10,
          fontFamily: 'inherit', resize: 'vertical',
          background: '#fff', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color .15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
        onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
      />
    </QuestionCard>
  )
}

function MatchingQuestion({ question, index, answer, onChange }) {
  return (
    <QuestionCard index={index} question={question}>
      <MatchingInput
        lefts={question.lefts || []}
        options={question.options || []}
        answer={answer || {}}
        onChange={onChange}
      />
    </QuestionCard>
  )
}

function OrderingQuestion({ question, index, answer, onChange }) {
  const [shuffled] = useState(() => {
    const arr = [...(question.items || [])]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  })

  const orderedItems = useMemo(() => {
    if (Array.isArray(answer) && answer.length === (question.items || []).length) {
      const itemMap = Object.fromEntries((question.items || []).map(it => [it.id, it]))
      return answer.map(id => itemMap[id]).filter(Boolean)
    }
    return shuffled
  }, [answer, shuffled]) // eslint-disable-line react-hooks/exhaustive-deps

  const dragIdx = useRef(null)

  const reorder = (updated) => onChange(updated.map(it => it.id))

  const handleDrop = (dropIdx) => {
    if (dragIdx.current === null || dragIdx.current === dropIdx) return
    const updated = [...orderedItems]
    const [moved] = updated.splice(dragIdx.current, 1)
    updated.splice(dropIdx, 0, moved)
    reorder(updated)
    dragIdx.current = null
  }

  const moveItem = (idx, dir) => {
    const target = idx + dir
    if (target < 0 || target >= orderedItems.length) return
    const updated = [...orderedItems];
    [updated[idx], updated[target]] = [updated[target], updated[idx]]
    reorder(updated)
  }

  return (
    <QuestionCard index={index} question={question}>
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 10 }}>
        Drag the items or use the arrows to put them in the correct order.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orderedItems.map((item, i) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => { dragIdx.current = i }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 10,
              border: '2px solid var(--gray-200)', background: '#fafafa',
              cursor: 'grab', userSelect: 'none', transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 18, color: 'var(--gray-300)', cursor: 'grab' }}>⠿</span>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--gray-800)' }}>{item.text}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} style={{
                background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6,
                padding: '2px 8px', fontSize: 12, cursor: i === 0 ? 'not-allowed' : 'pointer',
                color: i === 0 ? 'var(--gray-300)' : 'var(--gray-600)',
              }}>▲</button>
              <button type="button" onClick={() => moveItem(i, 1)} disabled={i === orderedItems.length - 1} style={{
                background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6,
                padding: '2px 8px', fontSize: 12,
                cursor: i === orderedItems.length - 1 ? 'not-allowed' : 'pointer',
                color: i === orderedItems.length - 1 ? 'var(--gray-300)' : 'var(--gray-600)',
              }}>▼</button>
            </div>
          </div>
        ))}
      </div>
    </QuestionCard>
  )
}

function FillBlankQuestion({ question, index, answer, onChange }) {
  const parts    = (question.text || '').split('___')
  const wordBank = question.word_bank || []

  return (
    <div style={{
      marginBottom: 20, padding: '20px 24px', borderRadius: 14,
      border: '2px solid var(--gray-100)', background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    }}>
      <div style={{
        fontWeight: 700, fontSize: 15, color: 'var(--gray-900)',
        marginBottom: 14, lineHeight: 2,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: '50%', background: 'var(--primary)',
          color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 2,
        }}>{index + 1}</span>
        <span>
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <span
                  onClick={() => answer && onChange('')}
                  title={answer ? 'Click to clear' : ''}
                  style={{
                    display: 'inline-block', minWidth: 100, padding: '2px 10px',
                    border: `2px solid ${answer ? 'var(--primary)' : 'var(--gray-300)'}`,
                    borderRadius: 6, marginInline: 4, textAlign: 'center', fontWeight: 600,
                    color: answer ? 'var(--primary)' : 'var(--gray-400)',
                    cursor: answer ? 'pointer' : 'default',
                    background: answer ? 'var(--primary-light, #eff6ff)' : 'var(--gray-50)',
                    transition: 'all .15s',
                  }}
                >
                  {answer || '     '}
                </span>
              )}
            </span>
          ))}
        </span>
      </div>
      {question.image && (
        <img src={question.image} alt=""
          style={{ maxWidth: 260, borderRadius: 8, marginBottom: 14, display: 'block' }} />
      )}
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>Click a word to fill the blank</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {wordBank.map((word, i) => {
          const selected = answer === word
          return (
            <button key={i} type="button"
              onClick={() => onChange(selected ? '' : word)}
              style={{
                padding: '8px 16px', borderRadius: 20,
                border: `2px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
                background: selected ? 'var(--primary-light, #eff6ff)' : '#fafafa',
                color: selected ? 'var(--primary)' : 'var(--gray-700)',
                fontSize: 14, fontWeight: selected ? 700 : 400,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {word}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WordScrambleQuestion({ question, index, answer, onChange }) {
  const [tiles, setTiles] = useState(() => {
    const letters = (question.correct || '').toLowerCase().split('')
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]]
    }
    return letters.map((char, i) => ({ id: i, char, placed: false }))
  })
  const [placedOrder, setPlacedOrder] = useState([])

  useEffect(() => {
    if (!answer) {
      setTiles(t => t.map(tile => ({ ...tile, placed: false })))
      setPlacedOrder([])
    }
  }, [answer])

  const tileById = Object.fromEntries(tiles.map(t => [t.id, t]))
  const placed    = placedOrder.map(id => tileById[id])
  const available = tiles.filter(t => !t.placed)

  const placeChar = (tileId) => {
    const newOrder = [...placedOrder, tileId]
    setTiles(tiles.map(t => t.id === tileId ? { ...t, placed: true } : t))
    setPlacedOrder(newOrder)
    onChange(newOrder.map(id => tileById[id].char).join(''))
  }

  const removeChar = (tileId) => {
    const newOrder = placedOrder.filter(id => id !== tileId)
    setTiles(tiles.map(t => t.id === tileId ? { ...t, placed: false } : t))
    setPlacedOrder(newOrder)
    onChange(newOrder.map(id => tileById[id].char).join(''))
  }

  const reset = () => {
    setTiles(t => t.map(tile => ({ ...tile, placed: false })))
    setPlacedOrder([])
    onChange('')
  }

  const tileStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 44, borderRadius: 8,
    border: `2px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`,
    background: active ? 'var(--primary)' : '#fff',
    color: active ? '#fff' : 'var(--gray-800)',
    fontSize: 18, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,.08)',
    transition: 'all .15s', userSelect: 'none',
  })

  return (
    <QuestionCard index={index} question={question}>
      <div style={{
        minHeight: 52, padding: '8px 12px', marginBottom: 16, borderRadius: 10,
        border: '2px dashed var(--gray-200)', background: 'var(--gray-50)',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
      }}>
        {placed.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--gray-300)' }}>Click letters below to build your answer…</span>
        ) : (
          placed.map(t => (
            <span key={t.id} onClick={() => removeChar(t.id)} style={tileStyle(true)} title="Click to remove">
              {t.char.toUpperCase()}
            </span>
          ))
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {available.map(t => (
          <span key={t.id} onClick={() => placeChar(t.id)} style={tileStyle(false)}>
            {t.char.toUpperCase()}
          </span>
        ))}
      </div>
      {placed.length > 0 && (
        <button type="button" onClick={reset} style={{
          fontSize: 12, padding: '4px 14px',
          border: '1px solid var(--gray-200)', borderRadius: 6,
          background: 'transparent', color: 'var(--gray-500)', cursor: 'pointer',
        }}>
          Reset
        </button>
      )}
    </QuestionCard>
  )
}

// ── Result display ────────────────────────────────────────────────────────────

function MatchingResultRows({ detail }) {
  const pairs      = detail.pairs      || []
  const studentMap = typeof detail.student_answer === 'object' ? (detail.student_answer || {}) : {}
  const correctMap = typeof detail.correct_answer  === 'object' ? (detail.correct_answer  || {}) : {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      {pairs.map(pair => {
        const given   = studentMap[pair.id] || '(no answer)'
        const correct = correctMap[pair.id]  || ''
        const isRight = given === correct
        return (
          <div key={pair.id} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{isRight ? '✅' : '❌'}</span>
            <strong>{pair.left}</strong>
            <span style={{ color: 'var(--gray-400)' }}>→</span>
            <span style={{ color: isRight ? '#059669' : '#dc2626' }}>{given}</span>
            {!isRight && (
              <span style={{ color: '#059669' }}>
                (should be: <strong>{correct}</strong>)
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function OrderingResultRows({ detail }) {
  const items      = detail.items || []
  const studentOrd = Array.isArray(detail.student_answer) ? detail.student_answer : []
  const correctOrd = Array.isArray(detail.correct_answer) ? detail.correct_answer : []
  const itemMap    = Object.fromEntries(items.map(it => [it.id, it.text]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      {correctOrd.map((id, i) => {
        const studentId = studentOrd[i]
        const isRight   = studentId === id
        return (
          <div key={id} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ minWidth: 22, color: 'var(--gray-400)', fontSize: 12 }}>{i + 1}.</span>
            <span>{isRight ? '✅' : '❌'}</span>
            <span style={{ color: isRight ? '#059669' : '#dc2626' }}>
              {itemMap[studentId] || '(missing)'}
            </span>
            {!isRight && (
              <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                (should be: <strong>{itemMap[id]}</strong>)
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InlineQuestionResult({ question: q, detail: d, index }) {
  if (!d) return null
  const isCorrect   = d.is_correct
  const borderColor = isCorrect === true ? '#a7f3d0' : isCorrect === false ? '#fecaca' : 'var(--gray-200)'
  const bgColor     = isCorrect === true ? '#f0fdf4' : isCorrect === false ? '#fff5f5' : '#fff'

  return (
    <div style={{ padding: 16, marginBottom: 12, borderRadius: 12, border: `2px solid ${borderColor}`, background: bgColor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-800)', flex: 1 }}>
          {index + 1}. {d.text}
        </span>
        {isCorrect !== null && (
          <span style={{ fontSize: 20, flexShrink: 0 }}>{isCorrect ? '✅' : '❌'}</span>
        )}
      </div>
      {d.image && (
        <img src={d.image} alt="" style={{ maxWidth: 200, borderRadius: 8, marginBottom: 8, display: 'block' }} />
      )}
      {d.type === 'matching' ? (
        <MatchingResultRows detail={d} />
      ) : d.type === 'ordering' ? (
        <OrderingResultRows detail={d} />
      ) : (
        <div style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--gray-500)' }}>Your answer: </span>
          <strong style={{ color: isCorrect ? '#065f46' : '#dc2626' }}>
            {!d.student_answer || typeof d.student_answer === 'object'
              ? '(no answer)'
              : d.student_answer === 'true' ? 'True'
              : d.student_answer === 'false' ? 'False'
              : d.student_answer}
          </strong>
          {isCorrect === false && d.correct_answer && typeof d.correct_answer !== 'object' && (
            <div style={{ marginTop: 3 }}>
              <span style={{ color: 'var(--gray-500)' }}>Correct answer: </span>
              <strong style={{ color: '#065f46' }}>
                {d.correct_answer === 'true' ? 'True'
                 : d.correct_answer === 'false' ? 'False'
                 : d.correct_answer}
              </strong>
            </div>
          )}
        </div>
      )}
      {q?.hint && (
        <div style={{
          marginTop: 10, padding: '7px 12px', background: '#fefce8',
          border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e',
        }}>
          💡 {q.hint}
        </div>
      )}
    </div>
  )
}

function ExerciseResult({ result, exercise, onRetry }) {
  const pct     = result.percentage || 0
  const passed  = pct >= 70
  const emoji   = pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '📚'
  const bg      = pct >= 70 ? '#d1fae5' : pct >= 40 ? '#fef3c7' : '#fee2e2'
  const color   = pct >= 70 ? '#065f46' : pct >= 40 ? '#92400e' : '#991b1b'
  const message = pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good job!' : 'Keep practicing!'

  const questionMap = Object.fromEntries((exercise.questions || []).map(q => [q.id, q]))

  return (
    <div>
      {/* Score summary */}
      <div style={{ textAlign: 'center', padding: '28px 20px', background: bg, borderRadius: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{emoji}</div>
        <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{pct}%</div>
        <div style={{ fontSize: 15, fontWeight: 600, color, marginTop: 4 }}>
          {result.score} / {result.total} correct
        </div>
        <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>{message}</div>
      </div>

      {/* Per-question breakdown */}
      {result.details.map((d, i) => (
        <InlineQuestionResult key={d.id} question={questionMap[d.id]} detail={d} index={i} />
      ))}

      <button onClick={onRetry} style={{
        width: '100%', marginTop: 12, padding: '13px 0',
        fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none',
        background: passed ? 'var(--gray-150, #e5e7eb)' : 'var(--primary)',
        color: passed ? 'var(--gray-700)' : '#fff', cursor: 'pointer',
      }}>
        {passed ? 'Try Again' : 'Retry to Improve'}
      </button>
    </div>
  )
}

// ── Exercise viewer ───────────────────────────────────────────────────────────

function ExerciseViewer({ section, onStatusChange }) {
  const exercise  = section?.content_body || {}
  const questions = exercise.questions || []

  const [phase,   setPhase]   = useState('loading') // loading | ready | submitting | done
  const [result,  setResult]  = useState(null)
  const [answers, setAnswers] = useState({})

  useEffect(() => {
    if (!section?.id) return
    setPhase('loading')
    setAnswers({})
    setResult(null)
    getMyResult(section.id)
      .then(res => {
        if (res.data.attempted) { setResult(res.data); setPhase('done') }
        else setPhase('ready')
      })
      .catch(() => setPhase('ready'))
  }, [section?.id])

  const handleSubmit = async () => {
    setPhase('submitting')
    try {
      const res = await submitExercise(section.id, answers)
      setResult(res.data)
      setPhase('done')
      onStatusChange?.(section.id, res.data)
    } catch {
      setPhase('done')
    }
  }

  const handleRetry = () => {
    setResult(null)
    setAnswers({})
    setPhase('ready')
    onStatusChange?.(section.id, null)
  }

  const hasAnswer = (q) => {
    const a = answers[q.id]
    if (q.type === 'matching')      return a && Object.keys(a).length === (q.lefts || []).length
    if (q.type === 'ordering')      return Array.isArray(a) && a.length === (q.items || []).length
    if (q.type === 'word_scramble') return typeof a === 'string' && a.length === (q.correct || '').length
    return a !== undefined && a !== ''
  }
  const answeredCount = questions.filter(hasAnswer).length
  const allAnswered   = answeredCount === questions.length && questions.length > 0
  const progress      = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0

  if (phase === 'loading') return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <span className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
    </div>
  )

  if (phase === 'submitting') return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <span className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
      <p style={{ marginTop: 16, fontWeight: 600, color: 'var(--gray-600)' }}>Checking your answers…</p>
    </div>
  )

  if (phase === 'done' && result) return (
    <ExerciseResult result={result} exercise={exercise} onRetry={handleRetry} />
  )

  if (questions.length === 0) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>
      This exercise has no questions yet.
    </div>
  )

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Progress</span>
          <span>{answeredCount} / {questions.length} answered</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--gray-100)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 4,
            background: allAnswered ? '#10b981' : 'var(--primary)',
            transition: 'width .3s ease',
          }} />
        </div>
      </div>

      {/* Questions */}
      {questions.map((q, idx) => {
        const answer   = answers[q.id]
        const onChange = val => setAnswers(prev => ({ ...prev, [q.id]: val }))

        if (q.type === 'multiple_choice')
          return <MultiChoiceQuestion key={q.id} question={q} index={idx} answer={answer} onChange={onChange} />
        if (q.type === 'true_false')
          return <TrueFalseQuestion key={q.id} question={q} index={idx} answer={answer} onChange={onChange} />
        if (q.type === 'matching')
          return <MatchingQuestion key={q.id} question={q} index={idx} answer={answer} onChange={onChange} />
        if (q.type === 'ordering')
          return <OrderingQuestion key={q.id} question={q} index={idx} answer={answer} onChange={onChange} />
        if (q.type === 'fill_blank')
          return <FillBlankQuestion key={q.id} question={q} index={idx} answer={answer} onChange={onChange} />
        if (q.type === 'word_scramble')
          return <WordScrambleQuestion key={q.id} question={q} index={idx} answer={answer} onChange={onChange} />
        return <TextQuestion key={q.id} question={q} index={idx} answer={answer} onChange={onChange} />
      })}

      {/* Submit */}
      <button
        onClick={allAnswered ? handleSubmit : undefined}
        style={{
          width: '100%', padding: '14px 0', marginTop: 8,
          fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none',
          background: allAnswered ? 'var(--primary)' : 'var(--gray-200)',
          color: allAnswered ? '#fff' : 'var(--gray-400)',
          cursor: allAnswered ? 'pointer' : 'not-allowed',
          transition: 'all .2s',
        }}
      >
        {allAnswered
          ? 'Submit Answers'
          : `Answer all questions (${questions.length - answeredCount} remaining)`}
      </button>
    </div>
  )
}

// ── Quran display section ─────────────────────────────────────────────────────

function QuranDisplaySection({ section }) {
  const { surah, ayah_start, ayah_end } = section.content_body || {}
  const [ayahs,       setAyahs]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [tafsirOpen,  setTafsirOpen]  = useState({})
  const [playingNum,  setPlayingNum]  = useState(null)
  const [surahInfo,   setSurahInfo]   = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    if (!surah) { setLoading(false); return }
    getSurahEditions(surah, ['ar.uthmani', 'en.sahih', 'ar.muyassar'])
      .then(data => {
        setSurahInfo({ name: data[0]?.name, englishName: data[0]?.englishName })
        const all = mergeEditions(data)
        const start = ayah_start || 1
        const end   = ayah_end   || all.length
        setAyahs(all.filter(a => a.numberInSurah >= start && a.numberInSurah <= end))
      })
      .catch(() => setError('Could not load Quran text.'))
      .finally(() => setLoading(false))
  }, [surah, ayah_start, ayah_end])

  const toggleAudio = (globalNum) => {
    if (playingNum === globalNum) {
      audioRef.current?.pause(); setPlayingNum(null); return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(audioUrl(globalNum))
    audioRef.current = audio
    audio.play().catch(() => {})
    setPlayingNum(globalNum)
    audio.onended = () => setPlayingNum(null)
    audio.onerror = () => setPlayingNum(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
    </div>
  )
  if (error) return <div style={{ padding: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</div>

  return (
    <div style={{
      borderRadius: 14, border: '2px solid var(--primary-light, #bfdbfe)',
      overflow: 'hidden', background: '#fff',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', background: 'var(--primary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
          ☪ {surahInfo?.englishName}
          {ayah_start && ayah_end && ayah_start !== ayah_end &&
            <span style={{ fontWeight: 400, opacity: 0.85, marginLeft: 8 }}>
              Ayahs {ayah_start}–{ayah_end}
            </span>
          }
        </div>
        <div style={{
          direction: 'rtl', color: '#fff', opacity: 0.9,
          fontFamily: "'Amiri', 'Arabic Typesetting', serif", fontSize: 18,
        }}>
          {surahInfo?.name}
        </div>
      </div>

      {/* Ayahs */}
      <div style={{ padding: '4px 0' }}>
        {ayahs.map(ayah => (
          <div key={ayah.numberInSurah} style={{
            padding: '16px 20px', borderBottom: '1px solid var(--gray-100)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {ayah.numberInSurah}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleAudio(ayah.number)}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 7,
                    border: '1.5px solid var(--gray-200)', cursor: 'pointer',
                    background: playingNum === ayah.number ? 'var(--primary)' : 'transparent',
                    color: playingNum === ayah.number ? '#fff' : 'var(--gray-600)',
                  }}
                >
                  {playingNum === ayah.number ? '⏸' : '▶'}
                </button>
                {ayah.tafsir && (
                  <button
                    onClick={() => setTafsirOpen(p => ({ ...p, [ayah.numberInSurah]: !p[ayah.numberInSurah] }))}
                    style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 7,
                      border: '1.5px solid var(--gray-200)', cursor: 'pointer',
                      background: tafsirOpen[ayah.numberInSurah] ? 'var(--gray-100)' : 'transparent',
                      color: 'var(--gray-600)',
                    }}
                  >
                    تفسير
                  </button>
                )}
              </div>
            </div>

            <div style={{
              direction: 'rtl', textAlign: 'right',
              fontFamily: "'Amiri', 'Arabic Typesetting', serif",
              fontSize: 22, lineHeight: 2.1, color: 'var(--gray-900)',
            }}>
              {ayah.arabic}
            </div>

            {ayah.english && (
              <div style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.7, marginTop: 8 }}>
                {ayah.english}
              </div>
            )}

            {tafsirOpen[ayah.numberInSurah] && ayah.tafsir && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 8,
                background: 'var(--gray-50, #f9fafb)', border: '1px solid var(--gray-200)',
                direction: 'rtl', textAlign: 'right',
                fontFamily: "'Amiri', 'Arabic Typesetting', serif",
                fontSize: 13, lineHeight: 1.9, color: 'var(--gray-700)',
              }}>
                {ayah.tafsir}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section renderer ──────────────────────────────────────────────────────────

function SectionView({ section, onStatusChange }) {
  const headingStyle = {
    0: { fontSize: 24, fontWeight: 800, lineHeight: 1.3 },
    1: { fontSize: 20, fontWeight: 700, lineHeight: 1.3 },
    2: { fontSize: 16, fontWeight: 700, lineHeight: 1.4 },
  }[Math.min(section.depth, 2)]

  return (
    <div style={{ marginBottom: 28 }}>
      {section.title && (
        <div style={{ ...headingStyle, color: 'var(--gray-900)', marginBottom: section.type === 'title' ? 4 : 12 }}>
          {section.title}
        </div>
      )}
      {section.type === 'content' && section.content_body?.html && (
        <div className="lesson-prose"
          style={{ fontSize: 16, lineHeight: 1.8, direction: section.content_body.direction || 'ltr' }}
          dangerouslySetInnerHTML={{ __html: section.content_body.html }} />
      )}
      {section.type === 'exercise' && section.content_body && (
        <ExerciseViewer key={section.id} section={section} onStatusChange={onStatusChange} />
      )}
      {section.type === 'quran_display' && section.content_body && (
        <QuranDisplaySection key={section.id} section={section} />
      )}
      {section.children?.map(child => (
        <SectionView key={child.id} section={child} onStatusChange={onStatusChange} />
      ))}
    </div>
  )
}

// ── Exercises overview panel ──────────────────────────────────────────────────

function ExercisesOverview({ flat, exerciseStatuses, onGoTo }) {
  const exercises = flat.filter(s => s.type === 'exercise')

  if (exercises.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--gray-400)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <p style={{ fontWeight: 600 }}>No exercises in this lesson.</p>
    </div>
  )

  const done    = exercises.filter(s => exerciseStatuses[s.id]?.attempted).length
  const passing = exercises.filter(s => (exerciseStatuses[s.id]?.percentage ?? 0) >= 70).length

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 28, padding: '16px 20px',
        borderRadius: 14, background: '#f9fafb', border: '2px solid var(--gray-100)',
      }}>
        {[
          { label: 'Total', value: exercises.length, color: 'var(--gray-700)' },
          { label: 'Completed', value: done, color: '#2563eb' },
          { label: 'Passed', value: passing, color: '#059669' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Exercise cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((s, i) => {
          const status    = exerciseStatuses[s.id]
          const attempted = status?.attempted
          const pct       = status?.percentage ?? null
          const passed    = pct !== null && pct >= 70

          const icon    = attempted ? (passed ? '✅' : '❌') : '🔲'
          const bgColor = attempted ? (passed ? '#f0fdf4' : '#fff5f5') : '#f9fafb'
          const border  = attempted ? (passed ? '#a7f3d0' : '#fecaca') : 'var(--gray-200)'

          return (
            <div key={s.id} onClick={() => onGoTo(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px', borderRadius: 14, background: bgColor,
              border: `2px solid ${border}`, cursor: 'pointer', transition: 'all .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>
                  {s.title || `Exercise ${i + 1}`}
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
                  {attempted
                    ? `Score: ${pct}%  ·  ${status.score} / ${status.total} correct`
                    : 'Not started yet'}
                </div>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: attempted ? 'var(--gray-500)' : 'var(--primary)',
                flexShrink: 0,
              }}>
                {attempted ? 'View →' : 'Start →'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Nav button ────────────────────────────────────────────────────────────────

function NavBtn({ onClick, disabled, children, primary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 14,
      fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none', transition: 'opacity .15s, transform .1s',
      background: disabled ? 'var(--gray-100)' : primary ? 'var(--primary)' : 'var(--gray-150, #e5e7eb)',
      color: disabled ? 'var(--gray-300)' : primary ? '#fff' : 'var(--gray-800)',
      boxShadow: disabled ? 'none' : primary ? '0 4px 14px rgba(0,0,0,.15)' : '0 2px 6px rgba(0,0,0,.08)',
      opacity: disabled ? .5 : 1,
    }}>
      {children}
    </button>
  )
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ flat, idx, goTo }) {
  if (flat.length <= 1) return null
  if (flat.length <= 12) {
    return (
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {flat.map((s, i) => (
          <div key={s.id} onClick={() => goTo(s.id)} title={s.title || `Part ${i + 1}`} style={{
            width: i === idx ? 16 : 10, height: i === idx ? 16 : 10, borderRadius: '50%',
            background: i === idx ? 'var(--primary)' : i < idx ? 'var(--primary-light, #bfdbfe)' : 'var(--gray-200)',
            cursor: 'pointer', transition: 'all .2s', flexShrink: 0,
          }} />
        ))}
      </div>
    )
  }
  return <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-500)' }}>{idx + 1} / {flat.length}</span>
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StudentPortalLesson() {
  const { t }        = useTranslation()
  const { state }    = useLocation()
  const lessonId     = state?.lessonId
  const navigate     = useNavigate()
  const panelRef     = useRef(null)

  const [lesson,           setLesson]           = useState(null)
  const [selected,         setSelected]         = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [tocOpen,          setTocOpen]          = useState(true)
  const [view,             setView]             = useState('lesson')   // 'lesson' | 'exercises'
  const [exerciseStatuses, setExerciseStatuses] = useState({})

  useEffect(() => {
    if (!localStorage.getItem('lms_student')) { navigate('/login', { replace: true }); return }
    if (!lessonId) { navigate('/student/content', { replace: true }); return }
    studentClient.get(`/content/published/lessons/${lessonId}/`)
      .then(res => {
        setLesson(res.data)
        const sections = res.data.sections || []
        if (sections.length > 0) setSelected(sections[0].id)
        // Fetch exercise statuses in parallel
        const exerciseSecs = flattenSections(sections).filter(s => s.type === 'exercise')
        Promise.all(
          exerciseSecs.map(s =>
            getMyResult(s.id)
              .then(r => [s.id, r.data.attempted ? r.data : { attempted: false }])
              .catch(() => [s.id, { attempted: false }])
          )
        ).then(entries => setExerciseStatuses(Object.fromEntries(entries)))
      })
      .catch(() => setError(t('student.portal.failedLoad')))
      .finally(() => setLoading(false))
  }, [lessonId, navigate, t])

  const handleStatusChange = (sectionId, resultData) => {
    setExerciseStatuses(prev => ({
      ...prev,
      [sectionId]: resultData
        ? { attempted: true, score: resultData.score, total: resultData.total, percentage: resultData.percentage }
        : { attempted: false },
    }))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span className="spinner spinner-dark" style={{ width: 40, height: 40 }} />
    </div>
  )

  if (error) return (
    <div style={{ padding: 40 }}>
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-outline" onClick={() => navigate('/student/content')}>← Back</button>
    </div>
  )

  const flat        = flattenSections(lesson?.sections || [])
  const idx         = flat.findIndex(s => s.id === selected)
  const current     = flat[idx] ?? null
  const hasPrev     = idx > 0
  const hasNext     = idx < flat.length - 1
  const exerciseCount = flat.filter(s => s.type === 'exercise').length
  const doneCount     = flat.filter(s => s.type === 'exercise' && exerciseStatuses[s.id]?.attempted).length

  const goTo = (id) => {
    setSelected(id)
    setView('lesson')
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // TOC status badge for a section
  const tocBadge = (s) => {
    if (s.type !== 'exercise') return null
    const st = exerciseStatuses[s.id]
    if (!st || !st.attempted) return <span title="Not started" style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>📝</span>
    return (
      <span title={`${st.percentage}%`} style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>
        {st.percentage >= 70 ? '✅' : '❌'}
      </span>
    )
  }

  return (
    <div className="editor-shell">
      <div className="editor-topbar">
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/student/content')}>
          ← Back
        </button>
        <button className="btn btn-outline btn-sm" style={{ marginLeft: 8, minWidth: 36 }}
          onClick={() => setTocOpen(o => !o)} title={tocOpen ? 'Hide contents' : 'Show contents'}>
          {tocOpen ? '◀' : '▶'}
        </button>
        <h2 style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', marginLeft: 14,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lesson?.title}
        </h2>

        {/* Exercises tab */}
        {exerciseCount > 0 && (
          <button
            onClick={() => setView(v => v === 'exercises' ? 'lesson' : 'exercises')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: view === 'exercises' ? 'var(--primary)' : 'var(--gray-100)',
              color: view === 'exercises' ? '#fff' : 'var(--gray-700)',
              fontSize: 13, fontWeight: 600, flexShrink: 0, transition: 'all .15s',
            }}>
            📝 Exercises
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%', fontSize: 11, fontWeight: 800,
              background: view === 'exercises' ? 'rgba(255,255,255,.3)' : 'var(--primary)',
              color: view === 'exercises' ? '#fff' : '#fff',
            }}>
              {doneCount}/{exerciseCount}
            </span>
          </button>
        )}

        {view === 'lesson' && flat.length > 0 && (
          <span style={{ fontSize: 13, color: 'var(--gray-400)', whiteSpace: 'nowrap', marginLeft: 8 }}>
            {idx + 1} / {flat.length}
          </span>
        )}
      </div>

      <div className="editor-body">
        {tocOpen && (
          <div className="editor-toc">
            <div className="toc-header">
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)' }}>Contents</span>
            </div>
            <div className="toc-scroll">
              {flat.map((s, i) => (
                <div key={s.id}
                  className={`toc-item${selected === s.id && view === 'lesson' ? ' active' : ''}`}
                  style={{ paddingLeft: 10 + s.depth * 16, cursor: 'pointer' }}
                  onClick={() => goTo(s.id)}
                >
                  <span style={{ fontSize: 11, color: 'var(--gray-400)', marginRight: 6, minWidth: 18,
                    display: 'inline-block', textAlign: 'right' }}>{i + 1}</span>
                  <span className="toc-item-title" style={{ fontSize: 13, flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || <em style={{ color: 'var(--gray-400)' }}>untitled</em>}
                  </span>
                  {tocBadge(s)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="editor-panel" ref={panelRef} style={{ overflowY: 'auto' }}>
          {view === 'exercises' ? (
            <ExercisesOverview
              flat={flat}
              exerciseStatuses={exerciseStatuses}
              onGoTo={goTo}
            />
          ) : current ? (
            <div key={current.id} style={{ maxWidth: 720, margin: '0 auto' }}>
              <SectionView section={current} onStatusChange={handleStatusChange} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 48, paddingTop: 24, borderTop: '2px solid var(--gray-100)', gap: 12 }}>
                <NavBtn onClick={() => hasPrev && goTo(flat[idx - 1].id)} disabled={!hasPrev}>◀ Previous</NavBtn>
                <ProgressDots flat={flat} idx={idx} goTo={goTo} />
                {hasNext
                  ? <NavBtn onClick={() => goTo(flat[idx + 1].id)} primary>Next ▶</NavBtn>
                  : <NavBtn onClick={() => navigate('/student/content')} primary>Finish! 🎉</NavBtn>
                }
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📖</div>
              <p className="empty-state-text">Select a section from the left.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function flattenSections(sections) {
  const result = []
  const visit = items => items.forEach(s => { result.push(s); if (s.children?.length) visit(s.children) })
  visit(sections)
  return result
}
