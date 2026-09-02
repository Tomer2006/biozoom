import { useEffect, useState } from 'react'
import type { PreviewData } from '../modules/preview'
import { translate, type AppLanguage } from '../modules/i18n'

interface BigPreviewProps {
  language: AppLanguage
  preview: PreviewData | null
  onWebSearch: () => void
}

export default function BigPreview({ language, preview, onWebSearch }: BigPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [preview?.thumbnail])

  const showImage = !!preview?.thumbnail && !imageFailed
  return (
    <aside className={`big-preview ${preview ? 'visible' : ''}`} aria-hidden={!preview} aria-live="polite">
      <div className="big-preview-header">
        <div className="big-preview-caption">{preview?.caption}</div>
      </div>
      {showImage && (
        <img
          src={preview.thumbnail!}
          alt={preview.caption}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className={`big-preview-empty ${preview && !showImage ? 'visible' : ''}`} aria-hidden={showImage}>
        {translate('stage.noImage', undefined, language)}
      </div>
      <div className="big-preview-footer">
        <button
          type="button"
          className="btn btn-small"
          onClick={(event) => {
            event.stopPropagation()
            onWebSearch()
          }}
          title={translate('stage.webSearchTitle', undefined, language)}
        >
          {translate('stage.webSearch', undefined, language)}
        </button>
        <div className="big-preview-path">{preview?.path}</div>
      </div>
    </aside>
  )
}
