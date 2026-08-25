import { Context, EventNames, IEventEmitter, ILocale } from "../../../kernal";
import * as pdfjsLib from '../../../pdfjs/legacy/build/pdf.mjs';
import { PdfPasswordPromptCallback } from "./IPdfFileParser";

export class PdfPasswordProvider {
    private static readonly PASSWORD_KEY_PREFIX = 'pdf-passwords:';

    private pdfjsPasswordCallback?: (password: string | Error) => void;
    private sessionPassword?: string;

    constructor(
        public readonly events: IEventEmitter,
        public readonly locale: ILocale,
        public readonly context: Context,
    ) {
    }

    getPassword = async (): Promise<string | undefined> => {
        const fromOpenOptions = this.context.openOptions.password;
        if (fromOpenOptions) {
            return fromOpenOptions;
        }
        if (this.sessionPassword) {
            return this.sessionPassword;
        }
        return this.getStoredPassword();
    };

    onPasswordPrompt = (callback: (password: string) => void, reason: number) => {
        const locale = this.locale;
        switch (reason) {
            case pdfjsLib.PasswordResponses.NEED_PASSWORD: {
                this.pdfjsPasswordCallback = callback;
                this.events.emit(
                    EventNames.RequirePdfPassword,
                    this.onPdfPasswordCallback,
                    this.locale?.getText('share_require_pdf_password', 'Enter password to open PDF')
                    ?? 'Enter password to open PDF',
                    1,
                );
                break;
            }
            case pdfjsLib.PasswordResponses.INCORRECT_PASSWORD: {
                this.pdfjsPasswordCallback = callback;
                this.events.emit(
                    EventNames.RequirePdfPassword,
                    this.onPdfPasswordCallback,
                    locale?.getText('share_invalid_pdf_password_try_again', 'Incorrect password, please try again')
                    ?? 'Incorrect password, please try again',
                    2,
                );
                break;
            }
            default:
                break;
        }
    };

    private onPdfPasswordCallback: PdfPasswordPromptCallback = (password) => {
        if (typeof password === 'string') {
            this.setPassword(password);
        } else {
            this.clearPassword();
        }
        this.pdfjsPasswordCallback?.(password);
    };

    private getSimpleId(): string | undefined {
        const simpleId = this.context.simpleId;
        return simpleId || undefined;
    }

    private getStorageKey(simpleId: string): string {
        return `${PdfPasswordProvider.PASSWORD_KEY_PREFIX}${simpleId}`;
    }

    private getStoredPassword(): string | undefined {
        const simpleId = this.getSimpleId();
        if (!simpleId) {
            return undefined;
        }
        try {
            const password = localStorage.getItem(this.getStorageKey(simpleId));
            if (password) {
                this.sessionPassword = password;
            }
            return password || undefined;
        } catch {
            return undefined;
        }
    }

    private setPassword(password: string) {
        this.sessionPassword = password;
        const openOptions = this.context.openOptions;
        if (openOptions) {
            openOptions.password = password;
        }
        const simpleId = this.getSimpleId();
        if (!simpleId) {
            return;
        }
        try {
            localStorage.setItem(this.getStorageKey(simpleId), password);
        } catch {
            // ignore quota / private mode
        }
    }

    private clearPassword() {
        this.sessionPassword = undefined;
        const openOptions = this.context.openOptions;
        if (openOptions) {
            openOptions.password = '';
        }
        const simpleId = this.getSimpleId();
        if (!simpleId) {
            return;
        }
        try {
            localStorage.removeItem(this.getStorageKey(simpleId));
        } catch {
            // ignore
        }
    }
}
