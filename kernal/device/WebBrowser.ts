import { BrowserCapabilities } from '../web/BrowserCapabilities';
import { ArchType, DeviceInfo, DeviceType, IDevice, OSType } from './IDevice';
import { uaParser } from '../web/ua';

export class WebBrowser implements IDevice {
    private readonly uuidKey = "deviceToken_key";
    private readonly uaDevice = uaParser.getDevice();

    private deviceId: string | null = null;
    private currentModel: string;
    private currentIsMobile: boolean;
    private info: DeviceInfo;
    private osName: string;
    private osVersion: string;
    private arch: ArchType;

    getModel() {
        if (this.currentModel == undefined) {
            this.currentModel = this.uaDevice.model;
        }
        return this.currentModel;
    }

    getDeviceType(): DeviceType {
        if (this.isMobile()) {
            const os = this.getOS(true);
            if (os == 'android') {
                return 'mobileAndroid';
            }
            if (os == 'ios') {
                return 'mobileIOS';
            }
            return 'mobile';
        }
        if (this.isIPad()) {
            return 'ipad';
        }
        if (this.isAndroidPad()) {
            return 'androidPad';
        }
        return 'desktop';
    }

    getInfo(): DeviceInfo {
        if (!this.info) {
            const deviceType = this.getDeviceType();
            const deviceInfo = new DeviceInfo();
            deviceInfo.deviceToken = this.getId();
            deviceInfo.osType = this.getOS(true);
            deviceInfo.osVersion = this.getOSVersion();
            deviceInfo.browserName = BrowserCapabilities.getBrowserName();
            deviceInfo.browserVersion = BrowserCapabilities.getBrowserVersion();
            deviceInfo.language = this.getLanguage();
            deviceInfo.cpuType = this.getArch();
            deviceInfo.availableResolutionX = screen.width;
            deviceInfo.availableResolutionY = screen.height;
            deviceInfo.deviceSize = deviceType.startsWith('mobile')
                ? 'mobile'
                : (deviceType === 'desktop' ? 'desktop' : 'pad');
            this.info = deviceInfo;
        }
        this.info.deviceToken = this.getId();
        return this.info;
    }

    getId(): string {
        if (this.deviceId != null && this.deviceId.length > 0) {
            return this.deviceId;
        }
        this.deviceId = localStorage.getItem(this.uuidKey);
        if (this.deviceId != null && this.deviceId.length > 0) {
            return this.deviceId;
        }
        this.deviceId = this.getRandomId();

        localStorage.setItem(this.uuidKey, this.deviceId);
        return this.deviceId;
    }

    getOS(removeWhiteSpace?: boolean): OSType {
        if (!this.osName) {
            this.osName = uaParser.getOS().name ?? '';
        }
        return this.normalizeOS(this.osName, removeWhiteSpace);
    }

    getOSVersion(): string {
        if (!this.osVersion) {
            this.osVersion = uaParser.getOS().version ?? '';
        }
        return this.osVersion;
    }

    getArch(): ArchType {
        if (!this.arch) {
            this.arch = this.normalizeArch(uaParser.getCPU().architecture);
        }
        return this.arch;
    }

    getLanguage(defaultLanguage?: string, excludeRegion?: boolean, supportedLanguages?: string[]): string {
        let language = navigator.language || (navigator as any).browserLanguage;
        if (!language && defaultLanguage) {
            language = defaultLanguage;
        }
        if (language) {
            language = language.replace("_", "-").toLowerCase();
            if (supportedLanguages && !supportedLanguages.find(x => x == language)) {
                const shortLanguage = language.split('-')[0];
                const similarLanguage = supportedLanguages.find(x => x.startsWith(shortLanguage));
                if (similarLanguage) {
                    language = similarLanguage;
                }
                else if (defaultLanguage) {
                    language = defaultLanguage;
                }
            }
            if (excludeRegion) {
                language = language.split('-')[0];
            }
        }
        return language;
    }

    getOSThemeName(): 'dark' | 'light' {
        if (globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches) {
            return "dark";
        }
        return "light";
    }

    private isMobile(): boolean {
        if (this.currentIsMobile == undefined) {
            this.currentIsMobile = this.uaDevice.type == "mobile";
        }
        return this.currentIsMobile;
    }

    private isIPad(): boolean {
        return this.getModel()?.toLowerCase()?.indexOf('ipad') >= 0;
    }

    private isAndroidPad(): boolean {
        const os = this.getOS(true);
        if (!os || (os != "android" && os != "linux") || this.isMobile()) {
            return false;
        }
        if (this.uaDevice.type == "tablet") {
            return true;
        }
        return this.getDeviceOrientationAngle() != null;
    }

    /**
     * Phone/tablet orientation signal. `screen.orientation` also exists on desktop,
     * so only use it together with touch + coarse pointer.
     */
    private getDeviceOrientationAngle(): number | undefined {
        const legacy = (window as Window & { orientation?: number }).orientation;
        if (typeof legacy === "number") {
            return legacy;
        }
        if (!(navigator.maxTouchPoints > 0)) {
            return undefined;
        }
        if (!window.matchMedia?.("(pointer: coarse)")?.matches) {
            return undefined;
        }
        const angle = screen.orientation?.angle;
        return typeof angle === "number" ? angle : undefined;
    }

    private normalizeOS(name: string, removeWhiteSpace?: boolean): OSType {
        if (!name) {
            return '';
        }
        let normalized = name.toLowerCase();
        if (removeWhiteSpace) {
            normalized = normalized.replace(/[\s]+/gi, '');
        }
        switch (normalized.replace(/[\s]+/gi, '')) {
            case 'windows':
                return 'windows';
            case 'macos':
            case 'osx':
                return 'macos';
            case 'linux':
                return 'linux';
            case 'ios':
                return 'ios';
            case 'android':
                return 'android';
            case 'openbsd':
                return 'openbsd';
            case 'netbsd':
                return 'netbsd';
            default:
                return normalized as OSType;
        }
    }

    private normalizeArch(architecture?: string): ArchType {
        if (!architecture) {
            return '';
        }
        const normalized = architecture.toLowerCase();
        switch (normalized) {
            case 'amd64':
            case 'x86_64':
            case 'x64':
                return 'x64';
            case 'ia32':
            case 'i386':
            case 'i686':
            case 'x86':
                return 'x86';
            case 'aarch64':
            case 'arm64':
                return 'arm64';
            case 'arm':
            case 'armhf':
            case 'armel':
                return 'arm';
            default:
                return normalized;
        }
    }

    private getRandomId() {
        if (globalThis.crypto) {
            const array = new Uint8Array(16);
            globalThis.crypto.getRandomValues(array);
            let uuid = '';
            array.forEach((byte) => {
                uuid += byte.toString(16).padStart(2, '0');
            });
            this.deviceId = uuid;
            localStorage.setItem(this.uuidKey, uuid);
            return uuid;
        }

        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
