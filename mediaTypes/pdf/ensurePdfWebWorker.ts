import * as pdfjsLib from '../../pdfjs/legacy/build/pdf.mjs'

/** Script text or a Blob of `pdf.worker.min.mjs`. URLs are not accepted. */
export type PdfWorkerSource = string | Blob

let cachedSource: PdfWorkerSource | undefined

const rawWorkers = new WeakMap<pdfjsLib.PDFWorker, { worker: Worker; url: string }>()

const workerFromSource = (source: PdfWorkerSource) => {
  const blob = source instanceof Blob ? source : new Blob([source], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  return { worker: new Worker(url, { type: 'module' }), url }
}

const loadBundledWorkerSource = async () => {
  const workerModule = await import('../../pdfjs/legacy/build/pdf.worker.min.mjs?raw')
  return workerModule.default as PdfWorkerSource
}

const rememberSource = async (workerSource?: PdfWorkerSource) => {
  if (workerSource) {
    cachedSource = workerSource
    return workerSource
  }
  if (!cachedSource) {
    cachedSource = await loadBundledWorkerSource()
  }
  return cachedSource
}

/**
 * Remember the worker script. Does not install `GlobalWorkerOptions.workerPort`.
 * Each document gets its own worker from {@link createPdfDocumentWorker}.
 *
 * Hosts that cannot import `?raw` (for example some Obsidian bundlers) may pass
 * the script text or a Blob before the first document opens.
 */
export const ensurePdfWebWorker = async (workerSource?: PdfWorkerSource): Promise<void> => {
  await rememberSource(workerSource)
}

/** A new Blob worker for one PDF document. `loadingTask.destroy()` does not terminate it. */
export const createPdfDocumentWorker = async (workerSource?: PdfWorkerSource) => {
  const source = await rememberSource(workerSource)
  const created = workerFromSource(source)
  const pdfWorker = pdfjsLib.PDFWorker.create({ port: created.worker })
  rawWorkers.set(pdfWorker, created)
  return pdfWorker
}

/** Terminate the Blob worker owned by this document, after pdf.js has destroyed the task. */
export const terminatePdfDocumentWorker = (pdfWorker: pdfjsLib.PDFWorker | null | undefined) => {
  if (!pdfWorker) {
    return
  }
  const created = rawWorkers.get(pdfWorker)
  rawWorkers.delete(pdfWorker)
  created?.worker.terminate()
  if (created) {
    URL.revokeObjectURL(created.url)
  }
}

type PdfLoadingTask = {
  destroy: () => Promise<void> | void
}

/**
 * Destroy one loading task, then terminate the Blob worker it owns.
 * `PDFWorker.destroy()` does not terminate a worker created from a port.
 */
export const destroyPdfLoadingTask = async (task: PdfLoadingTask | null | undefined) => {
  if (!task) {
    return
  }
  const pdfWorker = (task as unknown as { _worker?: pdfjsLib.PDFWorker | null })._worker
  try {
    await task.destroy()
  } catch {
    // Already destroyed, or the worker closed while the range read failed.
  }
  terminatePdfDocumentWorker(pdfWorker)
}
