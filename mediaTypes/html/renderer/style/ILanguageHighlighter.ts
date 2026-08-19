import { IDocument, IDisposable, Theme } from "../../../../kernal";

export interface ILanguageHighlighter extends IDisposable {
    /**
     * Highlight fenced code blocks in a document (hook into documentPreprocesses).
     */
    highlight(doc: IDocument): Promise<void>;

    /**
     * Swap highlight.js theme CSS on already-loaded documents.
     */
    applyTheme(theme: Theme): Promise<void>;
}
