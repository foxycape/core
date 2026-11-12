import { EventNames, IDisposable, IDocument, IDocumentsProvider, IEventEmitter, IProgressTracker } from "../../../../kernal";

const FULLSCREEN_RESTORE_DELAY_MS = 100;

/**
 * Remembers the reading location when content inside an HTML iframe goes fullscreen,
 * then reloads that location after the element returns to normal flow.
 * Video fullscreen moves the element out of layout; without this, exiting fullscreen
 * leaves the page at the wrong scroll or column.
 */
export class HtmlFullscreenRestorer implements IDisposable {
    private readonly events: IEventEmitter;
    private readonly boundDocuments = new Set<Document>();
    private restoreTimer: ReturnType<typeof setTimeout> | undefined;
    private disposed = false;

    constructor(
        private readonly documentsProvider: IDocumentsProvider,
        private readonly progressTracker: IProgressTracker,
    ) {
        this.events = this.documentsProvider.owner.events;
        this.events.on(EventNames.DocumentLoad, this.onDocumentLoad);
        this.events.on(EventNames.DocumentDisposing, this.onDocumentDisposing);
    }

    async dispose(): Promise<void> {
        this.disposed = true;
        this.clearRestoreTimer();
        this.events.off(EventNames.DocumentLoad, this.onDocumentLoad);
        this.events.off(EventNames.DocumentDisposing, this.onDocumentDisposing);
        for (const iframeDocument of this.boundDocuments) {
            iframeDocument.removeEventListener("fullscreenchange", this.handleFullscreenChange);
        }
        this.boundDocuments.clear();
    }

    private onDocumentLoad = (doc: IDocument) => {
        const iframeDocument = doc.getContentContainer()?.ownerDocument;
        if (!iframeDocument || this.boundDocuments.has(iframeDocument)) {
            return;
        }
        iframeDocument.addEventListener("fullscreenchange", this.handleFullscreenChange);
        this.boundDocuments.add(iframeDocument);
    }

    private onDocumentDisposing = (doc: IDocument) => {
        const iframeDocument = doc.getContentContainer()?.ownerDocument;
        if (!iframeDocument) {
            return;
        }
        iframeDocument.removeEventListener("fullscreenchange", this.handleFullscreenChange);
        this.boundDocuments.delete(iframeDocument);
    }

    private handleFullscreenChange = async () => {
        if (this.disposed) {
            return;
        }
        const hasFullscreen = this.documentsProvider.getLoadedDocuments().some((doc) =>
            !!doc.getContentContainer()?.ownerDocument?.fullscreenElement
        );
        if (hasFullscreen) {
            this.clearRestoreTimer();
            try {
                const progress = await this.progressTracker.getProgress(true);
                if (progress?.location) {
                    this.documentsProvider.owner.context.currentLocation = progress.location;
                }
            }
            catch {
                // Keep the last location when precise progress cannot be read during fullscreen.
            }
            return;
        }
        this.clearRestoreTimer();
        this.restoreTimer = setTimeout(() => {
            this.restoreTimer = undefined;
            if (this.disposed) {
                return;
            }
            void this.documentsProvider.reload();
        }, FULLSCREEN_RESTORE_DELAY_MS);
    }

    private clearRestoreTimer = () => {
        if (this.restoreTimer != null) {
            clearTimeout(this.restoreTimer);
            this.restoreTimer = undefined;
        }
    }
}
