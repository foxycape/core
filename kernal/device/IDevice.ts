export interface IDevice {
    /** Gets the device model name. */
    getModel(): string;

    /** Gets the device type. */
    getDeviceType(): DeviceType;

    /** Gets aggregated device information. */
    getInfo(): DeviceInfo;

    /** Gets the persistent device id. */
    getId(): string;

    /**
     * Gets the operating system name.
     * @param removeWhiteSpace Whether to remove whitespace from the OS name.
     */
    getOS(removeWhiteSpace?: boolean): OSType;

    /** Gets the operating system version. */
    getOSVersion(): string;

    /** Gets the CPU architecture. */
    getArch(): ArchType;

    /**
     * Gets the host language.
     * @param defaultLanguage Fallback language when the browser language is unavailable.
     * @param excludeRegion Whether to exclude the region code.
     * @param supportedLanguages Supported language list (including region).
     */
    getLanguage(defaultLanguage?: string, excludeRegion?: boolean, supportedLanguages?: string[]): string;

    /** Gets the preferred OS color theme (`dark` or `light`). */
    getOSThemeName(): 'dark' | 'light';
}

export class DeviceInfo {
    deviceToken: string | undefined;
    browserName: string | undefined;
    browserVersion: string | undefined;
    osType: string | undefined;
    osVersion: string | undefined;
    language: string | undefined;
    availableResolution: string | undefined;
    availableResolutionX: number | undefined;
    availableResolutionY: number | undefined;
    deviceSize: string | undefined;
    cpuType: string | undefined;
}

export type DeviceType = 'pad' | 'desktop' | 'androidPad' | 'ipad' | 'mobile' | 'mobileAndroid' | 'mobileIOS' | (string & {});
export type OSType = 'windows' | 'macos' | 'linux'|'ios'|'android'|'openbsd'|'netbsd'|(string & {});
export type ArchType = 'x86' | 'x64' | 'arm' | 'arm64' | (string & {});
