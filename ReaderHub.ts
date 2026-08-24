import { EventNames } from "./kernal/EventNames";
import { Options } from "./kernal/Options";
import { Reader, type ReaderServices } from "./kernal/Reader";

type ReaderPointerPayload = {
    reader: Reader;
};

type ReaderEventHandlers = {
    onClick: (payload: ReaderPointerPayload) => void;
    onMouseEnter: (payload: ReaderPointerPayload) => void;
};

export class ReaderHub {

    private static allReaders: Reader[] = [];
    private static eventHandlers = new WeakMap<Reader, ReaderEventHandlers>();

    static get readers() {
        return this.allReaders;
    }

    /** current active reader id */
    private static currentReaderId: string;
    /** current active reader id */
    static get readerId() {
        return this.currentReaderId;
    }

    /** current focused reader id */
    private static currentFocusReaderId: string;
    /** current focused reader id */
    static get focusReaderId() {
        return this.currentFocusReaderId;
    }

    static createReader(options: Options, services: ReaderServices) {
        const reader = new Reader(options, services);
        this.bindEvents(reader);
        this.addReader(reader);
        return reader;
    }

    private static bindEvents(reader: Reader) {
        const onClick = (payload: ReaderPointerPayload) => {
            this.currentReaderId = payload.reader.id;
            this.currentFocusReaderId = payload.reader.id;
        };
        const onMouseEnter = (payload: ReaderPointerPayload) => {
            this.currentFocusReaderId = payload.reader.id;
        };
        reader.events.on(EventNames.ReaderClick, onClick);
        reader.events.on(EventNames.ReaderMouseEnter, onMouseEnter);
        this.eventHandlers.set(reader, { onClick, onMouseEnter });
    }

    private static unbindEvents(reader: Reader) {
        const handlers = this.eventHandlers.get(reader);
        if (!handlers) {
            return;
        }
        reader.events.off(EventNames.ReaderClick, handlers.onClick);
        reader.events.off(EventNames.ReaderMouseEnter, handlers.onMouseEnter);
        this.eventHandlers.delete(reader);
    }

    static getActiveReader() {
        const readerId = this.readerId;
        if (readerId) {
            return this.readers.find(x => x.id == readerId);
        }
        return null;
    }

    static getFocusReader() {
        const readerId = this.focusReaderId;
        if (readerId) {
            return this.readers.find(x => x.id == readerId);
        }
        return null;
    }

    static addReader(reader: Reader) {
        if (!this.allReaders.includes(reader)) {
            this.allReaders.push(reader)
        }
        if (!this.currentReaderId) {
            this.currentReaderId = reader.id;
        }
    }

    /**
     * Dispose a reader. This method will unbind all events and dispose the reader.
     * @param reader Reader to dispose
     */
    static async disposeReader(reader: Reader) {
        const readerIndex = this.allReaders.indexOf(reader);
        if (readerIndex >= 0) {
            this.allReaders.splice(readerIndex, 1);
        }
        if (this.allReaders.length > 0) {
            this.currentReaderId = this.allReaders[0].id;
        }
        else {
            this.currentReaderId = ""
        }
        this.unbindEvents(reader);
        await reader.dispose();
    }

    /**
     * get reader
     * @param id
     * @returns
     */
    static getReader(id: string) {
        return this.allReaders.find(x => x.id == id);
    }
}
