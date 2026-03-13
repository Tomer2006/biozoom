export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? ''

export function hasClerkPublishableKey() {
  return clerkPublishableKey.length > 0
}

export function getClerkConfigError() {
  if (hasClerkPublishableKey()) {
    return null
  }

  return 'Clerk auth is not configured yet. Add VITE_CLERK_PUBLISHABLE_KEY first.'
}
