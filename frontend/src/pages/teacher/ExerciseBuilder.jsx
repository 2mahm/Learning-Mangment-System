import { useRef, useState } from 'react'
import { uploadSectionMedia } from '../../api/content'

const TYPE_LABELS = {
  multiple_choice: 'Multiple Choice',
  true_false:      'True / False',
  text:            'Text Answer',
  matching:        'Match Columns',
  ordering:        'Drag to Order',
  fill_blank:      'Fill in the Blank',
  word_scramble:   'Word Scramble',
}

// ── Add Question dropdown ─────────────────────────────────────────────────────

function AddQuestionMenu({ onAdd }) {
  const [open, setOpen] = useState(false)
  const TYPES = [
    { id: 'multiple_choice', label: 'Multiple Choice',    icon: '⊙' },
    { id: 'true_false',      label: 'True / False',       icon: '✓' },
    { id: 'text',            label: 'Text Answer',        icon: 'T' },
    { id: 'matching',        label: 'Match Columns',      icon: '⇌' },
    { id: 'ordering',        label: 'Drag to Order',      icon: '↕' },
    { id: 'fill_blank',      label: 'Fill in the Blank',  icon: '_' },
    { id: 'word_scramble',   label: 'Word Scramble',      icon: '?' },
  ]
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(o => !o)}>
        + Add Question ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200,
          background: '#fff', border: '1px solid var(--gray-200)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.13)',
          minWidth: 200, marginTop: 4,
        }}>
          {TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              style={{
                display: 'block', width: '100%', padding: '10px 16px',
                textAlign: 'left', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 14, color: 'var(--gray-800)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              onClick={() => { onAdd(t.id); setOpen(false) }}
            >
              {t.icon}  {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Multiple Choice editor ────────────────────────────────────────────────────

function MultipleChoiceEditor({ choices, correct, onChange }) {
  const updateChoice = (idx, val) => {
    const updated = choices.map((c, i) => i === idx ? val : c)
    onChange(updated, correct === choices[idx] ? val : correct)
  }
  const removeChoice = (idx) => {
    const updated = choices.filter((_, i) => i !== idx)
    onChange(updated, updated.includes(correct) ? correct : '')
  }
  return (
    <div className="form-group">
      <label className="form-label">Answer Choices — click the circle to mark correct</label>
      {choices.map((choice, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="radio"
            checked={correct === choice && choice !== ''}
            onChange={() => choice.trim() && onChange(choices, choice)}
            title="Mark as correct answer"
            style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
          />
          <input
            className="form-control"
            value={choice}
            style={{ flex: 1 }}
            placeholder={`Choice ${idx + 1}`}
            onChange={e => updateChoice(idx, e.target.value)}
          />
          {choices.length > 2 && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--danger)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
              onClick={() => removeChoice(idx)}
              title="Remove choice"
            >×</button>
          )}
        </div>
      ))}
      {correct && (
        <div style={{ fontSize: 12, color: 'var(--success, #059669)', marginTop: 2 }}>
          ✓ Correct answer marked: <strong>{correct}</strong>
        </div>
      )}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{ marginTop: 8, fontSize: 13 }}
        onClick={() => onChange([...choices, ''], correct)}
      >
        + Add Choice
      </button>
    </div>
  )
}

// ── Matching editor ───────────────────────────────────────────────────────────

function MatchingEditor({ pairs, onChange }) {
  const makePair = () => ({
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 8),
    left: '',
    right: '',
  })

  const updatePair = (idx, field, val) => {
    const updated = pairs.map((p, i) => i === idx ? { ...p, [field]: val } : p)
    onChange(updated)
  }

  const removePair = (idx) => {
    onChange(pairs.filter((_, i) => i !== idx))
  }

  return (
    <div className="form-group">
      <label className="form-label">Matching Pairs — left column → right column</label>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr auto',
        gap: '6px 8px', alignItems: 'center', marginBottom: 4,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', paddingLeft: 2 }}>Left</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', paddingLeft: 2 }}>Right</span>
        <span />
        {pairs.map((pair, idx) => (
          <>
            <input
              key={`l-${idx}`}
              className="form-control"
              value={pair.left}
              placeholder={`Left ${idx + 1}`}
              onChange={e => updatePair(idx, 'left', e.target.value)}
            />
            <input
              key={`r-${idx}`}
              className="form-control"
              value={pair.right}
              placeholder={`Right ${idx + 1}`}
              onChange={e => updatePair(idx, 'right', e.target.value)}
            />
            <button
              key={`del-${idx}`}
              type="button"
              disabled={pairs.length <= 2}
              style={{
                background: 'none', border: 'none', cursor: pairs.length <= 2 ? 'not-allowed' : 'pointer',
                color: pairs.length <= 2 ? 'var(--gray-300)' : 'var(--danger)',
                fontSize: 18, lineHeight: 1, padding: '0 4px',
              }}
              onClick={() => removePair(idx)}
              title="Remove pair"
            >×</button>
          </>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{ marginTop: 4, fontSize: 13 }}
        onClick={() => onChange([...pairs, makePair()])}
      >
        + Add Pair
      </button>
    </div>
  )
}

// ── Ordering editor ───────────────────────────────────────────────────────────

function OrderingEditor({ items, onChange }) {
  const makeItem = () => ({
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 8),
    text: '',
  })

  const updateItem = (idx, text) =>
    onChange(items.map((it, i) => i === idx ? { ...it, text } : it))

  const removeItem = (idx) =>
    onChange(items.filter((_, i) => i !== idx))

  return (
    <div className="form-group">
      <label className="form-label">Items — enter them in the correct order</label>
      {items.map((item, idx) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--gray-400)', minWidth: 20, textAlign: 'right' }}>
            {idx + 1}.
          </span>
          <input
            className="form-control"
            value={item.text}
            placeholder={`Item ${idx + 1}`}
            style={{ flex: 1 }}
            onChange={e => updateItem(idx, e.target.value)}
          />
          {items.length > 2 && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--danger)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
              onClick={() => removeItem(idx)}
              title="Remove item"
            >×</button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{ marginTop: 4, fontSize: 13 }}
        onClick={() => onChange([...items, makeItem()])}
      >
        + Add Item
      </button>
    </div>
  )
}

// ── Fill in the Blank editor ──────────────────────────────────────────────────

function FillBlankEditor({ correct, wordBank, onChange }) {
  const updateWord = (idx, val) =>
    onChange({ correct, word_bank: wordBank.map((w, i) => i === idx ? val : w) })

  const removeWord = (idx) =>
    onChange({ correct, word_bank: wordBank.filter((_, i) => i !== idx) })

  return (
    <div className="form-group">
      <label className="form-label">Correct Answer (the missing word)</label>
      <input
        className="form-control"
        value={correct}
        placeholder="e.g. mitochondria"
        onChange={e => onChange({ correct: e.target.value, word_bank: wordBank })}
      />
      <p className="form-hint">Use ___ in the question text above to mark where the blank goes.</p>
      <label className="form-label" style={{ marginTop: 10 }}>Word Bank — include the correct answer plus distractors</label>
      {wordBank.map((w, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            className="form-control"
            value={w}
            placeholder={`Word ${idx + 1}`}
            style={{ flex: 1 }}
            onChange={e => updateWord(idx, e.target.value)}
          />
          {wordBank.length > 2 && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--danger)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
              onClick={() => removeWord(idx)}
              title="Remove word"
            >×</button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{ marginTop: 4, fontSize: 13 }}
        onClick={() => onChange({ correct, word_bank: [...wordBank, ''] })}
      >
        + Add Word
      </button>
    </div>
  )
}

// ── Word Scramble editor ──────────────────────────────────────────────────────

function WordScrambleEditor({ correct, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">Answer Word (students will unscramble its letters)</label>
      <input
        className="form-control"
        value={correct}
        placeholder="e.g. photosynthesis"
        onChange={e => onChange({ correct: e.target.value })}
      />
      <p className="form-hint">Students see the letters shuffled and click them in order to spell the word.</p>
    </div>
  )
}

// ── Single question card ──────────────────────────────────────────────────────

function QuestionCard({ question: q, index, onChange, onDelete, onImageUpload, uploading }) {
  const imgRef = useRef(null)
  return (
    <div className="card" style={{ marginBottom: 16, border: '1px solid var(--gray-200)' }}>
      <div className="card-header"
           style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          Q{index + 1} — {TYPE_LABELS[q.type]}
        </span>
        <button
          type="button"
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}
        >
          Delete
        </button>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Question text *</label>
          <input
            className="form-control"
            value={q.text}
            onChange={e => onChange({ text: e.target.value })}
            placeholder="Type your question here…"
          />
        </div>

        {/* Image — not shown for matching (doesn't make sense per-question) */}
        {q.type !== 'matching' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Image (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {q.image && (
                <img src={q.image} alt="question"
                     style={{ height: 72, borderRadius: 8, objectFit: 'cover',
                              border: '1px solid var(--gray-200)' }} />
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={uploading}
                onClick={() => imgRef.current?.click()}
              >
                {uploading
                  ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Uploading…</>
                  : q.image ? '🖼 Replace' : '🖼 Upload Image'}
              </button>
              {q.image && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ color: 'var(--danger)', fontSize: 12 }}
                  onClick={() => onChange({ image: null })}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={imgRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onImageUpload(f)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {q.type === 'multiple_choice' && (
          <MultipleChoiceEditor
            choices={q.choices}
            correct={q.correct}
            onChange={(choices, correct) => onChange({ choices, correct })}
          />
        )}

        {q.type === 'true_false' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Correct Answer</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {['true', 'false'].map(val => (
                <label
                  key={val}
                  style={{ display: 'flex', alignItems: 'center', gap: 8,
                           cursor: 'pointer', userSelect: 'none' }}
                >
                  <input
                    type="radio"
                    checked={q.correct === val}
                    onChange={() => onChange({ correct: val })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{
                    padding: '5px 18px', borderRadius: 20, fontWeight: 600, fontSize: 14,
                    background: q.correct === val ? 'var(--primary-light, #ede9fe)' : 'var(--gray-100)',
                    color: q.correct === val ? 'var(--primary, #7c3aed)' : 'var(--gray-600)',
                    transition: 'all .15s',
                  }}>
                    {val === 'true' ? 'True' : 'False'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {q.type === 'text' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Correct Answer</label>
            <input
              className="form-control"
              value={q.correct}
              onChange={e => onChange({ correct: e.target.value })}
              placeholder="The expected answer (case-insensitive by default)"
            />
            <p className="form-hint">Comparison trims whitespace and ignores case.</p>
          </div>
        )}

        {q.type === 'matching' && (
          <MatchingEditor
            pairs={q.pairs || []}
            onChange={pairs => onChange({ pairs })}
          />
        )}

        {q.type === 'ordering' && (
          <OrderingEditor
            items={q.items || []}
            onChange={items => onChange({ items })}
          />
        )}

        {q.type === 'fill_blank' && (
          <FillBlankEditor
            correct={q.correct}
            wordBank={q.word_bank || []}
            onChange={({ correct, word_bank }) => onChange({ correct, word_bank })}
          />
        )}

        {q.type === 'word_scramble' && (
          <WordScrambleEditor
            correct={q.correct}
            onChange={({ correct }) => onChange({ correct })}
          />
        )}

        {/* Hint — available for all types */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Hint (optional — student can reveal on demand)</label>
          <input
            className="form-control"
            value={q.hint || ''}
            onChange={e => onChange({ hint: e.target.value })}
            placeholder="e.g. Think about the root word…"
          />
        </div>

      </div>
    </div>
  )
}

// ── Main ExerciseBuilder ──────────────────────────────────────────────────────

export default function ExerciseBuilder({ section, onSave }) {
  const initial = section.content_body || {}

  const [sectionTitle, setSectionTitle] = useState(section.title || '')
  const [exTitle,      setExTitle]      = useState(initial.title       || '')
  const [exDesc,       setExDesc]       = useState(initial.description || '')
  const [questions,    setQuestions]    = useState(initial.questions   || [])
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [uploading,    setUploading]    = useState({})
  const [error,        setError]        = useState('')

  const makePairId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8)

  const newQuestion = (type) => ({
    id:            crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    type,
    text:          '',
    image:         null,
    hint:          '',
    choices:       type === 'multiple_choice' ? ['', ''] : [],
    correct:       type === 'true_false' ? 'true' : '',
    caseSensitive: false,
    pairs: type === 'matching'
      ? [
          { id: makePairId(), left: '', right: '' },
          { id: makePairId(), left: '', right: '' },
        ]
      : undefined,
    items: type === 'ordering'
      ? [
          { id: makePairId(), text: '' },
          { id: makePairId(), text: '' },
        ]
      : undefined,
    word_bank: type === 'fill_blank' ? ['', ''] : undefined,
  })

  const addQuestion    = (type) => setQuestions(qs => [...qs, newQuestion(type)])
  const removeQuestion = (id)   => setQuestions(qs => qs.filter(q => q.id !== id))
  const updateQuestion = (id, changes) =>
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...changes } : q))

  const handleImageUpload = async (qId, file) => {
    setUploading(u => ({ ...u, [qId]: true }))
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await uploadSectionMedia(form)
      updateQuestion(qId, { image: res.data.url })
    } catch {
      setError('Image upload failed. Please try again.')
    } finally {
      setUploading(u => ({ ...u, [qId]: false }))
    }
  }

  const validate = () => {
    if (!exTitle.trim()) return 'Exercise title is required.'
    if (questions.length === 0) return 'Add at least one question.'
    for (const q of questions) {
      if (!q.text.trim()) return 'Every question needs text.'
      if (q.type === 'multiple_choice') {
        if (q.choices.filter(c => c.trim()).length < 2)
          return 'Multiple choice questions need at least 2 choices.'
        if (!q.correct)
          return 'Mark the correct answer for every multiple choice question.'
      }
      if (q.type === 'text' && !q.correct.trim())
        return 'Text answer questions need a correct answer.'
      if (q.type === 'matching') {
        const pairs = q.pairs || []
        if (pairs.length < 2) return 'Matching questions need at least 2 pairs.'
        if (pairs.some(p => !p.left.trim() || !p.right.trim()))
          return 'Fill in both sides of every matching pair.'
      }
      if (q.type === 'ordering') {
        const items = q.items || []
        if (items.length < 2) return 'Ordering questions need at least 2 items.'
        if (items.some(it => !it.text.trim())) return 'Fill in the text for every ordering item.'
      }
      if (q.type === 'fill_blank') {
        if (!q.text.includes('___')) return 'Fill-in-the-blank question text must contain ___ to mark the blank.'
        if (!q.correct.trim()) return 'Fill-in-the-blank questions need a correct answer.'
        if ((q.word_bank || []).filter(w => w.trim()).length < 2)
          return 'Fill-in-the-blank questions need at least 2 words in the word bank.'
      }
      if (q.type === 'word_scramble') {
        if (!q.correct.trim()) return 'Word scramble questions need an answer word.'
        if (q.correct.trim().length < 2) return 'Word scramble answer must be at least 2 characters.'
      }
    }
    return null
  }

  const handleSave = async () => {
    setError('')
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    try {
      await onSave(section.id, {
        title:        sectionTitle,
        content_body: { title: exTitle, description: exDesc, questions },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Section title (shown in lesson outline)</label>
        <input
          className="form-control"
          value={sectionTitle}
          onChange={e => setSectionTitle(e.target.value)}
          placeholder="e.g. Exercise 1: Animals"
        />
      </div>

      <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--gray-100)' }} />

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Exercise title *</label>
        <input
          className="form-control"
          value={exTitle}
          onChange={e => setExTitle(e.target.value)}
          placeholder="e.g. Animals Quiz"
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Instructions (optional)</label>
        <input
          className="form-control"
          value={exDesc}
          onChange={e => setExDesc(e.target.value)}
          placeholder="e.g. Look at each picture and choose the correct answer."
        />
      </div>

      {questions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 10 }}>
            Questions ({questions.length})
          </div>
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              onChange={changes => updateQuestion(q.id, changes)}
              onDelete={() => removeQuestion(q.id)}
              onImageUpload={file => handleImageUpload(q.id, file)}
              uploading={!!uploading[q.id]}
            />
          ))}
        </div>
      )}

      <AddQuestionMenu onAdd={addQuestion} />

      {error && (
        <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b',
                      borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="flex-between" style={{ marginTop: 8 }}>
        <span style={{ fontSize: 12, color: saved ? 'var(--success)' : 'transparent' }}>
          ✓ Saved
        </span>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : 'Save Exercise'}
        </button>
      </div>

    </div>
  )
}