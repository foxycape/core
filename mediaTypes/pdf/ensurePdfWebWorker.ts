import * as pdfjsLib from '../../pdfjs/legacy/build/pdf.mjs'

/**
 * True when `src` can be passed to `new Worker(src, { type: 'module' })`.
 * Placeholders / `app://` plugin paths are treated as unusable (Obsidian).
 */
export const isUsablePdfWorkerSrc = (src: string | undefined | null): src is string => {
  if (!src) {
    return false
  }
  if (src === 'pdfjs:fake-worker' || src === 'foxycape-pdf:fake-worker') {
    return false
  }
  // Obsidian plugin resource URLs usually cannot be loaded as module workers.
  if (src.startsWith('app:')) {
    return false
  }
  if (/^(blob:|https?:|file:|data:)/i.test(src)) {
    return true
  }
  // Vite dev / relative asset paths
  return src.startsWith('/') || src.startsWith('./') || src.startsWith('../')
}

/**
 * Ensure `GlobalWorkerOptions.workerSrc` points at a real module Worker script.
 *
 * Preference order:
 * 1. Already-configured usable workerSrc
 * 2. Host-provided preferred URL (Vite `?url`, copied `pdf.worker.min.mjs`, or Obsidian Blob URL)
 *
 * Worker source is not inlined (`?raw`) so hosts must pass a usable URL.
 * This is NOT pdf.js "fake worker" (main-thread simulation).
 */
export const ensurePdfWebWorker = (preferredWorkerSrc?: string): string => {
  const { GlobalWorkerOptions } = pdfjsLib

  if (isUsablePdfWorkerSrc(GlobalWorkerOptions.workerSrc)) {
    return GlobalWorkerOptions.workerSrc
  }

  if (isUsablePdfWorkerSrc(preferredWorkerSrc)) {
    GlobalWorkerOptions.workerSrc = preferredWorkerSrc
    return preferredWorkerSrc
  }

  throw new Error(
    'PDF worker source is not configured. Pass a usable preferredWorkerSrc (Vite ?url, copied pdf.worker.min.mjs, or Blob URL).',
  )
}
