import { Options } from "./Options";
import { IEventEmitter } from "./IEventEmitter";
import { EventNames } from "./EventNames";

export class OptionsProvider {
    constructor(
        private readonly events: IEventEmitter,
        private readonly options: Options,
    ) {
    }

    applyCssVariables(rootElement: HTMLElement) {
        rootElement.style.setProperty(Options.ScrollbarSize, this.options.scrollbarSize);
        rootElement.style.setProperty(Options.ScrollbarRadius, this.options.scrollbarRadius);
        rootElement.style.setProperty(Options.ScrollbarBorder, this.options.scrollbarBorder);
    }

    setOptionValue<K extends keyof Options>(key: K, value: Options[K]) {
        if (key in this.options) {
            Object.assign(this.options, { [key]: value });
            this.events.emit(EventNames.OptionsChange, key, value);
        }
    }
}
