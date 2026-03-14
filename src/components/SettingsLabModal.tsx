import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  applyPerfSettingsSnapshot,
  getPerfSettingsSnapshot,
  resetPersistedPerfOverrides,
  saveCurrentPerfOverrides,
  type EditablePerfRecord,
  type EditablePerfValue,
} from '../modules/runtimeSettings'
import { translate, type AppLanguage } from '../modules/i18n'

interface SettingsLabModalProps {
  isOpen: boolean
  language: AppLanguage
  onClose: () => void
  onPerfChange: () => void
}

interface SettingsLabFieldProps {
  path: string[]
  label: string
  value: EditablePerfValue
  depth: number
  onChange: (path: string[], value: EditablePerfValue) => void
}

function isPlainObject(value: EditablePerfValue): value is EditablePerfRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase())
}

function updateSnapshotAtPath(
  source: EditablePerfRecord,
  path: string[],
  nextValue: EditablePerfValue,
): EditablePerfRecord {
  const [head, ...rest] = path

  if (!head) {
    return source
  }

  if (rest.length === 0) {
    return {
      ...source,
      [head]: nextValue,
    }
  }

  const currentChild = source[head]
  if (!isPlainObject(currentChild)) {
    return source
  }

  return {
    ...source,
    [head]: updateSnapshotAtPath(currentChild, rest, nextValue),
  }
}

function JsonArrayField({
  value,
  onChange,
}: {
  value: EditablePerfValue[]
  onChange: (value: EditablePerfValue[]) => void
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(JSON.stringify(value, null, 2))
    setError('')
  }, [value])

  return (
    <div className="settings-lab-json">
      <textarea
        className="settings-input settings-lab-textarea"
        rows={Math.min(Math.max(value.length + 2, 4), 12)}
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value
          setDraft(nextDraft)

          try {
            const parsed = JSON.parse(nextDraft)
            if (!Array.isArray(parsed)) {
              setError('Value must be a JSON array.')
              return
            }

            setError('')
            onChange(parsed as EditablePerfValue[])
          } catch {
            setError('JSON is not valid yet.')
          }
        }}
      />
      {error && <div className="settings-lab-error">{error}</div>}
    </div>
  )
}

function NumericField({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(() => String(value))
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(String(value))
    setError('')
  }, [value])

  return (
    <div className="settings-lab-json">
      <input
        className="settings-input"
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value
          setDraft(nextDraft)

          if (!nextDraft.trim()) {
            setError('Enter a number.')
            return
          }

          const parsed = Number(nextDraft)
          if (Number.isNaN(parsed)) {
            setError('Number is not valid yet.')
            return
          }

          setError('')
          onChange(parsed)
        }}
      />
      {error && <div className="settings-lab-error">{error}</div>}
    </div>
  )
}

function SettingsLabField({ path, label, value, depth, onChange }: SettingsLabFieldProps) {
  if (isPlainObject(value)) {
    const entries = Object.entries(value)

    return (
      <details className="settings-lab-group" open={depth <= 1}>
        <summary>
          <span>{label}</span>
          <code>{path.join('.')}</code>
        </summary>
        <div className="settings-lab-group-body">
          {entries.map(([key, childValue]) => (
            <SettingsLabField
              key={path.concat(key).join('.')}
              path={path.concat(key)}
              label={formatLabel(key)}
              value={childValue}
              depth={depth + 1}
              onChange={onChange}
            />
          ))}
        </div>
      </details>
    )
  }

  if (Array.isArray(value)) {
    return (
      <div className="settings-lab-field">
        <div className="settings-lab-field-header">
          <label className="settings-label">
            <span>{label}</span>
            <span className="settings-hint">{path.join('.')}</span>
          </label>
          <span className="settings-lab-type">array</span>
        </div>
        <JsonArrayField value={value} onChange={(nextValue) => onChange(path, nextValue)} />
      </div>
    )
  }

  if (typeof value === 'boolean') {
    return (
      <div className="settings-lab-field">
        <div className="settings-lab-field-header">
          <label className="settings-label" htmlFor={path.join('-')}>
            <span>{label}</span>
            <span className="settings-hint">{path.join('.')}</span>
          </label>
          <span className="settings-lab-type">boolean</span>
        </div>
        <label className="settings-lab-toggle" htmlFor={path.join('-')}>
          <input
            id={path.join('-')}
            type="checkbox"
            checked={value}
            onChange={(event) => onChange(path, event.target.checked)}
          />
          <span>{value ? 'True' : 'False'}</span>
        </label>
      </div>
    )
  }

  return (
    <div className="settings-lab-field">
      <div className="settings-lab-field-header">
        <label className="settings-label" htmlFor={path.join('-')}>
          <span>{label}</span>
          <span className="settings-hint">{path.join('.')}</span>
        </label>
        <span className="settings-lab-type">{typeof value}</span>
      </div>
      {typeof value === 'number' ? (
        <NumericField value={value} onChange={(nextValue) => onChange(path, nextValue)} />
      ) : (
        <input
          id={path.join('-')}
          className="settings-input"
          type="text"
          value={value === null ? '' : String(value)}
          onChange={(event) => {
            onChange(path, event.target.value)
          }}
        />
      )}
    </div>
  )
}

export default function SettingsLabModal({
  isOpen,
  language,
  onClose,
  onPerfChange,
}: SettingsLabModalProps) {
  const [snapshot, setSnapshot] = useState<EditablePerfRecord>(() => getPerfSettingsSnapshot())

  useEffect(() => {
    if (isOpen) {
      setSnapshot(getPerfSettingsSnapshot())
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (!isOpen) {
      return
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const commitSnapshot = (nextSnapshot: EditablePerfRecord) => {
    setSnapshot(nextSnapshot)
    applyPerfSettingsSnapshot(nextSnapshot)
    saveCurrentPerfOverrides()
    onPerfChange()
  }

  const topLevelEntries = Object.entries(snapshot)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal settings-modal settings-lab-modal"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Settings Lab</h2>
                <p className="settings-lab-subtitle">
                  Live runtime editor for `perf` values in `settings.js`.
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    resetPersistedPerfOverrides()
                    const resetSnapshot = getPerfSettingsSnapshot()
                    setSnapshot(resetSnapshot)
                    onPerfChange()
                  }}
                >
                  Reset Defaults
                </button>
                <button
                  className="modal-close"
                  onClick={onClose}
                  aria-label={translate('common.close', undefined, language)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="modal-body settings-lab-body">
              {topLevelEntries.map(([key, value]) => (
                <SettingsLabField
                  key={key}
                  path={[key]}
                  label={formatLabel(key)}
                  value={value}
                  depth={0}
                  onChange={(path, nextValue) => {
                    const nextSnapshot = updateSnapshotAtPath(snapshot, path, nextValue)
                    commitSnapshot(nextSnapshot)
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
