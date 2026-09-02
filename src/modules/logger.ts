/**
 * Logging utilities module
 *
 * Provides structured logging functions with different severity levels
 * (info, warn, error, debug, trace) and consistent formatting.
 * Includes performance timing utilities and conditional debug output.
 */

const LOG_PREFIX = '[TaxonomyExplorer]';
const ENABLE_DEBUG = true;

function formatMessage(level: string, message: string, data: unknown = null) {
  const timestamp = new Date().toISOString().substr(11, 8); // HH:MM:SS
  let formatted = `${LOG_PREFIX} ${timestamp} ${level.toUpperCase()}: ${message}`;

  if (data && typeof data === 'object') {
    formatted += ` | Data: ${JSON.stringify(data, null, 2)}`;
  }

  return formatted;
}

export function logInfo(message: string, data: unknown = null) {
  console.info(formatMessage('info', message, data));
}

export function logWarn(message: string, data: unknown = null) {
  console.warn(formatMessage('warn', message, data));
}

export function logError(message: string, error: unknown = null, data: unknown = null) {
  const detail = error instanceof Error ? error.message : String(error ?? '')
  const errorMsg = error ? `${message} :: ${detail}` : message;
  console.error(formatMessage('error', errorMsg, data), error);
}

export function logDebug(message: string, data: unknown = null) {
  if (!ENABLE_DEBUG) return;
  console.debug(formatMessage('debug', message, data));
}
