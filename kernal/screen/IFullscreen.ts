export interface IFullscreen {
    enter(element?: HTMLElement): Promise<void>;
    exit(ownerDocument?:Document): Promise<void>;
    isFullscreen(ownerDocument?:Document): Promise<boolean>;
    supportFullscreen(): Promise<boolean>;
}