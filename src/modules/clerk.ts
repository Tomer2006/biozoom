const productionPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? ''
const developmentPublishableKey = import.meta.env.VITE_CLERK_DEV_PUBLISHABLE_KEY?.trim() ?? ''

function getHostname() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.location.hostname.toLowerCase()
}

function isProductionDomain(hostname: string) {
  return hostname === 'infinitespecies.com' || hostname.endsWith('.infinitespecies.com')
}

export function getClerkPublishableKey() {
  const hostname = getHostname()

  if (isProductionDomain(hostname)) {
    return productionPublishableKey
  }

  return developmentPublishableKey
}

export function hasClerkPublishableKey() {
  return getClerkPublishableKey().length > 0
}

export function getClerkConfigError() {
  const hostname = getHostname()

  if (isProductionDomain(hostname) && productionPublishableKey.length === 0) {
    return 'Clerk auth is not configured yet. Add VITE_CLERK_PUBLISHABLE_KEY first.'
  }

  if (!isProductionDomain(hostname) && productionPublishableKey.length > 0 && developmentPublishableKey.length === 0) {
    return 'This is a non-production origin. Add VITE_CLERK_DEV_PUBLISHABLE_KEY for localhost/dev, or test on infinitespecies.com.'
  }

  if (hasClerkPublishableKey()) {
    return null
  }

  return 'Clerk auth is not configured yet. Add a Clerk publishable key first.'
}
