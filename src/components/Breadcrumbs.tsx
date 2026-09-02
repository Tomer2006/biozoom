import { motion } from 'framer-motion'
import { translate, type AppLanguage } from '../modules/i18n'
import type { TaxonomyNode } from '../modules/types'

interface Crumb {
  id: number
  name: string
  node: TaxonomyNode
}

interface BreadcrumbsProps {
  language: AppLanguage
  crumbs: Crumb[]
  onCrumbClick: (node: TaxonomyNode) => void
  onRandomClick: (node: TaxonomyNode) => void
}

export default function Breadcrumbs({ language, crumbs, onCrumbClick, onRandomClick }: BreadcrumbsProps) {
  const lastCrumb = crumbs[crumbs.length - 1]
  const separator = language === 'he' ? '‹' : '›'

  return (
    <nav className="breadcrumbs" aria-label={translate('breadcrumbs.ariaLabel', undefined, language)}>
      {crumbs.map((crumb, index) => (
        <motion.div
          key={crumb.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03, duration: 0.2 }}
          style={{ display: 'contents' }}
        >
          {index > 0 && <span className="crumb-separator">{separator}</span>}
          <button
            className="crumb"
            type="button"
            onClick={() => onCrumbClick(crumb.node)}
            title={translate('breadcrumbs.navigateTo', { name: crumb.name }, language)}
          >
            {crumb.name}
          </button>
        </motion.div>
      ))}

      {lastCrumb && (
        <motion.div
          key={`random-${lastCrumb.id}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: crumbs.length * 0.03, duration: 0.2 }}
          style={{ display: 'contents' }}
        >
          <span className="crumb-separator">{separator}</span>
          <button
            className="crumb crumb-random"
            type="button"
            onClick={() => onRandomClick(lastCrumb.node)}
            title={translate('breadcrumbs.randomJump', { name: lastCrumb.name }, language)}
            aria-label={translate('breadcrumbs.randomJump', { name: lastCrumb.name }, language)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
              <circle cx="8.5" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="8.5" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </motion.div>
      )}
    </nav>
  )
}
