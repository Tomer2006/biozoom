import { translate } from './i18n.ts';

let loadingState = false;

export function showLoading(title = translate('loading.defaultTitle')) {
  loadingState = true;

  if (typeof window.__reactShowLoading === 'function') {
    window.__reactShowLoading(title);
  }
}

export function hideLoading() {
  loadingState = false;

  if (typeof window.__reactHideLoading === 'function') {
    window.__reactHideLoading();
  }
}

export function isCurrentlyLoading() {
  return loadingState;
}

export function setProgress(progress, label, currentStage = 1, totalStages = 1) {
  const percentage = Math.round(progress * 100);

  if (typeof window.__reactUpdateProgress === 'function') {
    window.__reactUpdateProgress(percentage, label, currentStage, totalStages);
  }
}

export function updateProgress(progress, label, currentStage = 1, totalStages = 1) {
  setProgress(progress / 100, label, currentStage, totalStages);
}
