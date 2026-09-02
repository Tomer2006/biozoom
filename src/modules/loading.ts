export interface ProgressUpdate {
  percentage: number
  label?: string
  currentStage: number
  totalStages: number
}

type ProgressListener = (update: ProgressUpdate) => void
const listeners = new Set<ProgressListener>()

export function subscribeProgress(listener: ProgressListener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setProgress(progress: number, label?: string, currentStage = 1, totalStages = 1) {
  const update: ProgressUpdate = {
    percentage: Math.round(progress * 100),
    label,
    currentStage,
    totalStages,
  }
  listeners.forEach((listener) => listener(update))
}
