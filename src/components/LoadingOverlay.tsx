import { translate, type AppLanguage } from '../modules/i18n'

interface LoadingOverlayProps {
  language: AppLanguage
  title: string
  stage: string
  progress: number
  pct: string
  timer: string
}

export default function LoadingOverlay({ language, title, stage, progress, pct, timer }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-brand">
          <div className="loading-brand-text">
            <div className="loading-brand-title">InfiniteSpecies</div>
          </div>
        </div>

        <h3 className="loading-title">{title}</h3>
        <div className="loading-stage">{stage}</div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="loading-meta">
          <span>{translate('loading.loadingLabel', undefined, language)}</span>
          <span>{pct}</span>
        </div>

        <div className="loading-timer">{timer}</div>
      </div>
    </div>
  )
}
