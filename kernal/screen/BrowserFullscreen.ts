import { IFullscreen } from "./IFullscreen";

export class BrowserFullscreen implements IFullscreen {    
    async enter(element?: HTMLElement): Promise<void> {
        if (!element) {
            return;
        }
        const ownerDocument = element.ownerDocument;
        const fullscreenEnabled = ownerDocument.fullscreenEnabled;
        if (fullscreenEnabled) {
            const enterFullScreenName = this.getSupportPropertyName([
                'requestFullscreen',
                'mozRequestFullScreen',
                'webkitRequestFullscreen',
                'msRequestFullscreen'
            ], element)
            if (enterFullScreenName) {
                await element[enterFullScreenName]();
            }
        }
    }
    async exit(ownerDocument?:Document): Promise<void> {
        if (!ownerDocument) {
            return;
        }
        const fullscreenEnabled = ownerDocument.fullscreenEnabled;
        if (fullscreenEnabled) {
            const exitFullScreenName = this.getSupportPropertyName([
                'exitFullScreen',
                'mozCancelFullScreen',
                'webkitExitFullscreen',
                'msExitFullscreen'
            ], ownerDocument)

            if (exitFullScreenName) {
                await ownerDocument[exitFullScreenName]();
            }
        }
    }
    async isFullscreen(ownerDocument?:Document): Promise<boolean> {
        if (!ownerDocument) {
            return;
        }
        const fullscreenEnabled = ownerDocument.fullscreenEnabled;
        if (fullscreenEnabled) {
            const fullscreenElementName = this.getSupportPropertyName([
                'fullscreenElement',
                'mozFullScreenElement',
                'msFullScreenElement',
                'wenkitFullscreenElement'
            ], ownerDocument)
            if (fullscreenElementName && ownerDocument[fullscreenElementName])
                return true;
        }
        return false;
    }
    async supportFullscreen(): Promise<boolean> {
        return document.fullscreenEnabled;
    }

    private getSupportPropertyName(names: string[], target: Element | Document) {
        return names.find(name => name in target)
    }
}