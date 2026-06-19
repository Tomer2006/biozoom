export function setProgress(progress, label, currentStage = 1, totalStages = 1) {
  const percentage = Math.round(progress * 100);

  if (typeof window.__reactUpdateProgress === 'function') {
    window.__reactUpdateProgress(percentage, label, currentStage, totalStages);
  }
}
