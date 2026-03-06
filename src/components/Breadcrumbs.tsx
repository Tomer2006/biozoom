/**
 * Breadcrumbs — Renders the current taxonomy path as clickable breadcrumb segments; clicking
 * a segment navigates to that node.
 */
import { motion } from 'framer-motion'

interface Crumb {
  id: number
  name: string
  node: any
}

interface BreadcrumbsProps {
  crumbs: Crumb[]
  onCrumbClick: (node: any) => void
  onRandomClick: (node: any) => void
}

export default function Breadcrumbs({ crumbs, onCrumbClick, onRandomClick }: BreadcrumbsProps) {
  const lastCrumb = crumbs[crumbs.length - 1]

  return (
    <nav className="breadcrumbs" aria-label="Taxonomy path">
      {crumbs.map((crumb, index) => (
        <motion.div
          key={crumb.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03, duration: 0.2 }}
          style={{ display: 'contents' }}
        >
          {index > 0 && <span className="crumb-separator">›</span>}
          <button
            className="crumb"
            onClick={() => onCrumbClick(crumb.node)}
            title={`Navigate to ${crumb.name}`}
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
          <span className="crumb-separator">›</span>
          <button
            className="crumb crumb-random"
            onClick={() => onRandomClick(lastCrumb.node)}
            title={`Jump to a random organism under ${lastCrumb.name}`}
            aria-label={`Jump to a random organism under ${lastCrumb.name}`}
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
