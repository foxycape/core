import { ILocale, Language, LocaleChangeListener } from "./ILocale";

export const applyNamed = (text: string, named?: object): string => {
    if (!named) {
        return text;
    }
    let result = text;
    for (const [name, value] of Object.entries(named)) {
        result = result.split(`{${name}}`).join(String(value ?? ""));
    }
    return result;
}

export class DefaultLocale implements ILocale {
    resource: any = {};
    private readonly listeners = new Set<LocaleChangeListener>();
    constructor() {

    }

    onLanguageChange(listener: LocaleChangeListener): () => void {
        this.listeners.add(listener);
        // The off returned remembers the listener registered this time
        return () => {
            this.listeners.delete(listener);
        };
    }

    getText(key: string, defaultText: string, named?: Object) {
        if (!key) {
            return applyNamed(defaultText, named);
        }
        const text = this.resource[key] || defaultText;
        return applyNamed(text, named);
    }

    private currentLanguage: string;
    async changeLanguage(language: string): Promise<void> {
        this.currentLanguage = language;
        this.listeners.forEach(listener => listener(language));
    }


    getCurrentLanguage(excludeRegion?: boolean) {
        const defaultLanguage: string = "en-us";
        let language = this.currentLanguage;
        if (!language) {
            language = defaultLanguage;
        }
        if (language) {
            language = language.replace("_", "-").toLowerCase();
        }
        if (excludeRegion) {
            language = language.split('-')[0];
        }
        return language;
    }

    private supportedLanguages: Language[];
    getSupportedLanguages(): Language[] {
        if (!this.supportedLanguages) {
            this.supportedLanguages = [];
        }
        return this.supportedLanguages;
    }

    async dispose(): Promise<void> {
        this.resource = {};
    }
}