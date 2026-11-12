import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { allExercises } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const DAY_KEYS = [
  ['1', 'Seg'],
  ['2', 'Ter'],
  ['3', 'Qua'],
  ['4', 'Qui'],
  ['5', 'Sex'],
  ['6', 'Sáb'],
  ['0', 'Dom'],
]

function TemplateEditor({ initial, onSaved, close }) {
  const toast = useUI(s => s.toast)
  const [name, setName] = useState(initial?.name || '')
  const [emoji, setEmoji] = useState(initial?.emoji || '🏋️')
  const [ex, setEx] = useState(() => (initial?.ex || []).map(x => ({ ...x })))
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)

  const catalogue = useMemo(() => allExercises({}), [])
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return catalogue
      .filter(item => item.name.toLowerCase().includes(term) || (item.en && item.en.toLowerCase().includes(term)))
      .slice(0, 12)
  }, [q, catalogue])

  const addExercise = item => {
    setEx(prev => [...prev, { id: item.id, name: item.name, sets: 3, reps: '10', weight: 0, rest: 90, note: '' }])
    setQ('')
  }
  const updateEx = (idx, patch) => setEx(prev => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  const removeEx = idx => setEx(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!name.trim()) return toast(t('Enter a workout name'))
    if (!ex.length) return toast(t('Add at least one exercise'))
    setSaving(true)
    try {
      await api('/api/admin/templates', {
        method: 'POST',
        body: JSON.stringify({ id: initial?.id || '', name: name.trim(), emoji: emoji.trim() || '🏋️', ex }),
      })
      toast(t('Workout template saved'))
      onSaved()
      close()
    } catch (e) {
      toast(e.message)
    } finally {
      setSaving(false)
    }
  }

  return <>
    <h3 style={{ marginTop: 0 }}>{initial?.id ? t('Edit workout template') : t('New workout template')}</h3>
    <div className="row" style={{ gap: 8, marginBottom: 10 }}>
      <input
        className="inp"
        style={{ width: 58, textAlign: 'center', fontSize: '1.2rem' }}
        value={emoji}
        onChange={e => setEmoji(e.target.value)}
        aria-label={t('Icon')}
      />
      <input
        className="inp grow"
        placeholder={t('Workout name (e.g. Treino A - Peito e Tríceps)')}
        value={name}
        onChange={e => setName(e.target.value)}
      />
    </div>

    <div style={{ position: 'relative', marginBottom: 10 }}>
      <input
        className="inp"
        placeholder={t('Search exercise to add…')}
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {matches.length > 0 && (
        <div className="card" style={{ marginTop: 4, maxHeight: 200, overflowY: 'auto', padding: 4 }}>
          {matches.map(item => (
            <button
              key={item.id}
              type="button"
              className="item"
              style={{ width: '100%', textAlign: 'start', background: 'none', border: 0, padding: '8px 10px' }}
              onClick={() => addExercise(item)}
            >
              <div className="grow">
                <div className="small" style={{ fontWeight: 600 }}>{item.name}</div>
                <div className="dim" style={{ fontSize: '.72rem' }}>{t(item.bp)} · {t(item.eq)}</div>
              </div>
              <Icon name="plus" />
            </button>
          ))}
        </div>
      )}
    </div>

    {ex.length === 0 ? (
      <div className="adm-empty" style={{ marginBottom: 12 }}>{t('No exercises added yet. Search above to add.')}</div>
    ) : (
      <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
        {ex.map((row, idx) => (
          <div key={idx} style={{ padding: '8px 0', borderBottom: 'var(--hair) solid var(--sep)' }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <div className="small" style={{ fontWeight: 600 }}>{idx + 1}. {row.name}</div>
              <button type="button" className="iconbtn adm-iconbtn" style={{ color: 'var(--red)' }} onClick={() => removeEx(idx)} aria-label={t('Remove')}>
                <Icon name="trash" />
              </button>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <label className="dim" style={{ fontSize: '.72rem', flex: 1 }}>
                {t('Sets')}
                <input className="inp" type="number" min="1" max="20" value={row.sets} onChange={e => updateEx(idx, { sets: Number(e.target.value) || 1 })} />
              </label>
              <label className="dim" style={{ fontSize: '.72rem', flex: 1 }}>
                {t('Reps')}
                <input className="inp" value={row.reps} onChange={e => updateEx(idx, { reps: e.target.value })} />
              </label>
              <label className="dim" style={{ fontSize: '.72rem', flex: 1 }}>
                {t('Weight (kg)')}
                <input className="inp" type="number" min="0" step="0.5" value={row.weight} onChange={e => updateEx(idx, { weight: Number(e.target.value) || 0 })} />
              </label>
              <label className="dim" style={{ fontSize: '.72rem', flex: 1 }}>
                {t('Rest (s)')}
                <input className="inp" type="number" min="0" max="600" step="15" value={row.rest} onChange={e => updateEx(idx, { rest: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <input
              className="inp"
              style={{ marginTop: 6, fontSize: '.8rem' }}
              placeholder={t('Coach note for this exercise (optional)')}
              value={row.note || ''}
              onChange={e => updateEx(idx, { note: e.target.value })}
            />
          </div>
        ))}
      </div>
    )}

    <div className="row" style={{ gap: 8 }}>
      <Button className="grow" onClick={close}>{t('Cancel')}</Button>
      <Button variant="primary" className="grow" disabled={saving} onClick={save}>
        {saving ? t('Saving…') : t('Save template')}
      </Button>
    </div>
  </>
}

export function AssignWorkoutSheet({ template, users, preselectedUserId = null, onAssigned, close }) {
  const toast = useUI(s => s.toast)
  const [selectedIds, setSelectedIds] = useState(() => (preselectedUserId ? [preselectedUserId] : []))
  const [mode, setMode] = useState('add')
  const [weekdays, setWeekdays] = useState([])
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)

  const eligible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users || [])
      .filter(u => !u.disabled)
      .filter(u => !q || u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)))
  }, [users, search])

  const toggleUser = id => setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  const toggleDay = d => setWeekdays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))

  const send = async () => {
    if (!selectedIds.length) return toast(t('Select at least one student'))
    setSending(true)
    try {
      const r = await api('/api/admin/user/routines', {
        method: 'POST',
        body: JSON.stringify({ templateId: template.id, userIds: selectedIds, mode, weekdays }),
      })
      toast(t('Workout assigned to {0} student(s)', r.assigned?.length || selectedIds.length))
      onAssigned?.()
      close()
    } catch (e) {
      toast(e.message)
    } finally {
      setSending(false)
    }
  }

  return <>
    <h3 style={{ marginTop: 0 }}>{t('Assign workout')}: {template.emoji} {template.name}</h3>
    <div className="adm-lead">{t('Choose which registered students will receive this workout. It syncs automatically to their app.')}</div>

    <div className="chips" style={{ marginBottom: 10 }}>
      <button type="button" className={'chip' + (mode === 'add' ? ' on' : '')} onClick={() => setMode('add')}>
        {t('Add to current routines')}
      </button>
      <button type="button" className={'chip' + (mode === 'replace' ? ' on' : '')} onClick={() => setMode('replace')}>
        {t('Replace current routines')}
      </button>
    </div>

    <div className="adm-group-t">{t('Schedule on days (optional)')}</div>
    <div className="chips" style={{ marginBottom: 10 }}>
      {DAY_KEYS.map(([d, label]) => (
        <button key={d} type="button" className={'chip' + (weekdays.includes(d) ? ' on' : '')} onClick={() => toggleDay(d)}>
          {t(label)}
        </button>
      ))}
    </div>

    {!preselectedUserId && (
      <input
        className="inp"
        style={{ marginBottom: 8 }}
        placeholder={t('Filter students by name or e-mail…')}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
    )}

    <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
      {eligible.map(u => {
        const checked = selectedIds.includes(u.id)
        return (
          <div
            key={u.id}
            className="row between"
            style={{ padding: '8px 4px', borderBottom: 'var(--hair) solid var(--sep)', cursor: 'pointer' }}
            onClick={() => toggleUser(u.id)}
          >
            <div>
              <div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
              {u.email && <div className="dim" style={{ fontSize: '.72rem' }}>{u.email}</div>}
            </div>
            <input type="checkbox" checked={checked} readOnly />
          </div>
        )
      })}
      {!eligible.length && <div className="adm-empty">{t('No students found.')}</div>}
    </div>

    <div className="row" style={{ gap: 8 }}>
      <Button className="grow" onClick={close}>{t('Cancel')}</Button>
      <Button variant="primary" className="grow" disabled={sending} onClick={send}>
        {sending ? t('Sending…') : t('Assign workout')}
      </Button>
    </div>
  </>
}

export default function AdminWorkouts({ users, onAssigned, templatesOverride = null }) {
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [templates, setTemplates] = useState(templatesOverride)

  const load = () => {
    if (templatesOverride) return
    api('/api/admin/templates')
      .then(d => setTemplates(Array.isArray(d?.templates) ? d.templates : []))
      .catch(() => setTemplates([]))
  }

  useEffect(() => { load() }, [])

  const openEditor = tpl => openSheet(close => <TemplateEditor initial={tpl} onSaved={load} close={close} />, { locked: true })
  const openAssign = tpl => openSheet(close => <AssignWorkoutSheet template={tpl} users={users} onAssigned={onAssigned} close={close} />)
  const del = tpl => confirmSheet({
    title: t('Delete template "{0}"?', tpl.name),
    message: t('Students who already received this workout keep their copy.'),
    confirmText: t('Delete'),
    danger: true,
    onConfirm: () => api('/api/admin/templates/delete', { method: 'POST', body: JSON.stringify({ id: tpl.id }) })
      .then(() => { toast(t('Template deleted')); load() })
      .catch(e => toast(e.message)),
  })

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{t('Workout management')}</h2>
        <Button variant="primary" size="sm" icon="plus" onClick={() => openEditor(null)}>
          {t('New workout')}
        </Button>
      </div>
      <div className="adm-lead">
        {t('Create workout templates and assign them directly to registered students.')}
      </div>

      {templates && templates.length > 0 ? (
        <div className="list">
          {templates.map(tpl => (
            <div key={tpl.id} className="item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="tt">{tpl.emoji || '🏋️'} {tpl.name}</div>
                <div className="ss">{t('{0} exercises', (tpl.ex || []).length)}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button size="sm" variant="primary" onClick={() => openAssign(tpl)}>{t('Assign')}</Button>
                <button className="iconbtn adm-iconbtn" onClick={() => openEditor(tpl)} aria-label={t('Edit')}>
                  <Icon name="edit" />
                </button>
                <button className="iconbtn adm-iconbtn" style={{ color: 'var(--red)' }} onClick={() => del(tpl)} aria-label={t('Delete')}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="adm-empty">
          {templates ? t('No workout templates yet. Tap "New workout" to create one.') : t('Loading…')}
        </div>
      )}
    </div>
  )
}

