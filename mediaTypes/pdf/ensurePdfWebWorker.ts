import * as pdfjsLib from '../../pdfjs/legacy/build/pdf.mjs'

/** Script text or a Blob of `pdf.worker.min.mjs`. URLs are not accepted. */
export type PdfWorkerSource = string | Blob

let installPromise: Promise<Worker> | undefined

const workerFromSource = (source: PdfWorkerSource) => {
  const blob = source instanceof Blob ? source : new Blob([source], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  return new Worker(url, { type: 'module' })
}

const loadBundledWorkerSource = async () => {
  const workerModule = await import('../../pdfjs/legacy/build/pdf.worker.min.mjs?raw')
  return workerModule.default
}

/**
 * Install a module Worker that does not depend on the page protocol.
 * The bundled worker script is turned into a Blob and assigned to
 * `GlobalWorkerOptions.workerPort`, so pdf.js never calls `new Worker(pageUrl)`.
 *
 * Hosts that cannot import `?raw` (for example some Obsidian bundlers) may pass
 * the script text or a Blob. An existing port is reused.
 */
export const ensurePdfWebWorker = async (workerSource?: PdfWorkerSource): Promise<Worker> => {
  const { GlobalWorkerOptions } = pdfjsLib
  if (GlobalWorkerOptions.workerPort) {
    return GlobalWorkerOptions.workerPort
  }
  if (!installPromise) {
    installPromise = (async () => {
      const source = workerSource ?? await loadBundledWorkerSource()
      const worker = workerFromSource(source)
      GlobalWorkerOptions.workerPort = worker
      return worker
    })().catch((error) => {
      installPromise = undefined
      throw error
    })
  }
  return installPromise
}
