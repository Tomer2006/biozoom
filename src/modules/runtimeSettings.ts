import { perf } from './settings'

const PERF_LAB_SECRET_CODE = '::settings-lab::'
const PERF_OVERRIDES_STORAGE_KEY = 'infinitespecies_perf_overrides'

export type EditablePerfValue =
  | string
  | number
  | boolean
  | null
  | EditablePerfValue[]
  | { [key: string]: EditablePerfValue }

export type EditablePerfRecord = { [key: string]: EditablePerfValue }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneEditableValue(value: unknown): EditablePerfValue | undefined {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => cloneEditableValue(item))
      .filter((item): item is EditablePerfValue => typeof item !== 'undefined')
  }

  if (isPlainObject(value)) {
    return snapshotEditableObject(value)
  }

  return undefined
}

function snapshotEditableObject(source: Record<string, unknown>): EditablePerfRecord {
  const result: EditablePerfRecord = {}
  const descriptors = Object.getOwnPropertyDescriptors(source)

  for (const [key, descriptor] of Object.entries(descriptors)) {
    if ('get' in descriptor && typeof descriptor.get === 'function' && !('value' in descriptor)) {
      continue
    }

    if (!('value' in descriptor)) {
      continue
    }

    if (typeof descriptor.value === 'function') {
      continue
    }

    const clonedValue = cloneEditableValue(descriptor.value)
    if (typeof clonedValue !== 'undefined') {
      result[key] = clonedValue
    }
  }

  return result
}

function applyObjectValues(target: Record<string, unknown>, values: EditablePerfRecord) {
  for (const [key, nextValue] of Object.entries(values)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key)
    if (!descriptor || ('get' in descriptor && typeof descriptor.get === 'function' && !('value' in descriptor))) {
      continue
    }

    const currentValue = target[key]

    if (isPlainObject(currentValue) && isPlainObject(nextValue)) {
      applyObjectValues(currentValue, nextValue as EditablePerfRecord)
      continue
    }

    const clonedValue = cloneEditableValue(nextValue)
    if (typeof clonedValue !== 'undefined') {
      target[key] = clonedValue
    }
  }
}

const defaultPerfSnapshot = snapshotEditableObject(perf as Record<string, unknown>)

export function getPerfSettingsSnapshot() {
  return snapshotEditableObject(perf as Record<string, unknown>)
}

function getDefaultPerfSettingsSnapshot() {
  return cloneEditableValue(defaultPerfSnapshot) as EditablePerfRecord
}

export function saveCurrentPerfOverrides() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PERF_OVERRIDES_STORAGE_KEY, JSON.stringify(getPerfSettingsSnapshot()))
}

export function applyPerfSettingsSnapshot(snapshot: EditablePerfRecord) {
  applyObjectValues(perf as Record<string, unknown>, snapshot)
}

export function applyPersistedPerfOverrides() {
  if (typeof window === 'undefined') return false

  const raw = window.localStorage.getItem(PERF_OVERRIDES_STORAGE_KEY)
  if (!raw) {
    return false
  }

  try {
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed)) {
      window.localStorage.removeItem(PERF_OVERRIDES_STORAGE_KEY)
      return false
    }

    applyPerfSettingsSnapshot(parsed as EditablePerfRecord)
    return true
  } catch {
    window.localStorage.removeItem(PERF_OVERRIDES_STORAGE_KEY)
    return false
  }
}

export function resetPersistedPerfOverrides() {
  applyPerfSettingsSnapshot(getDefaultPerfSettingsSnapshot())

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PERF_OVERRIDES_STORAGE_KEY)
  }
}

export function isPerfLabSecretCode(value: string) {
  return value.trim().toLowerCase() === PERF_LAB_SECRET_CODE
}

