import localforage from 'localforage';
import { DataStorageOptions, IStorage } from './IStorage';
import { JsonConvert } from '../JsonConvert';

type CacheEntry = {
    /** Original string when caching (used for comparison to see if it has been modified) */
    origin: string
    /** Cached value */
    current: unknown
}

type CacheRef = {
    table: string
    key: string
}

export class WebStorage implements IStorage {
    private static readonly MIN_MEMORY_KEY_COUNT = 1000;
    private static readonly MAX_MEMORY_KEY_COUNT = 200000;
    private static readonly MAX_CACHE_VALUE_LENGTH = 1024 * 1024;
    private static readonly MAX_CACHE_ENTRIES = 2048;

    private tables: Map<string, LocalForage>;
    private inflightTables: Map<string, Promise<LocalForage | null>>;
    private defaultDbName: string;
    private tableDatas: Map<string, Map<string, unknown>>;
    private cached: Map<string, Map<string, CacheEntry>> = new Map<string, Map<string, CacheEntry>>();
    private cacheLru: Map<CacheEntry, CacheRef> = new Map<CacheEntry, CacheRef>();
    private options?: DataStorageOptions;
    private tableNames: string[] = [];
    private tableNamesLoaded = false;
    private tableNamesLoad: Promise<string[]> | null = null;
    private tableGenerations: Map<string, number> = new Map<string, number>();
    private keyOpTails: Map<string, Map<string, Promise<void>>> = new Map<string, Map<string, Promise<void>>>();

    private epoch = 0;
    private disposed = false;
    private activeOps = 0;
    private pauseGate: Promise<void> | null = null;
    private idleResolvers: Array<() => void> = [];

    constructor(options?: DataStorageOptions) {
        this.defaultDbName = options?.dbName ?? "linghuxiong_reader";
        this.tables = new Map<string, LocalForage>();
        this.inflightTables = new Map<string, Promise<LocalForage | null>>();
        this.tableDatas = new Map<string, Map<string, unknown>>();
        if (options?.useMemoryMinKeyCount) {
            const minCount = Math.max(options.useMemoryMinKeyCount, WebStorage.MIN_MEMORY_KEY_COUNT);
            const maxCount = Math.min(
                options.useMemoryMaxKeyCount ?? WebStorage.MAX_MEMORY_KEY_COUNT,
                WebStorage.MAX_MEMORY_KEY_COUNT,
            );
            this.options = {
                ...options,
                useMemoryMinKeyCount: minCount,
                useMemoryMaxKeyCount: maxCount,
            };
        } else {
            this.options = options ? { ...options } : options;
        }
    }

    get dbName(): string {
        return this.defaultDbName;
    }

    private cloneMap<T>(source: Map<string, T>): Map<string, T> {
        return new Map<string, T>(source.entries());
    }

    private canUseMemoryTable(): boolean {
        return Boolean(this.options?.useMemoryMinKeyCount && this.options?.useMemoryMaxKeyCount);
    }

    private shouldUseMemory(dataCount: number): boolean {
        const min = this.options?.useMemoryMinKeyCount;
        const max = this.options?.useMemoryMaxKeyCount;
        if (!min || !max) {
            return false;
        }
        return dataCount >= min && dataCount < max;
    }

    private formatTableName(tableName: string): string | undefined {
        if (tableName == null || tableName === '' || tableName === 'undefined') {
            return undefined;
        }
        return String(tableName).toLowerCase();
    }

    private getTableGeneration(table: string): number {
        return this.tableGenerations.get(table) ?? 0;
    }

    private bumpTableGeneration(table: string): void {
        this.tableGenerations.set(table, this.getTableGeneration(table) + 1);
    }

    private isCurrent(epoch: number): boolean {
        return !this.disposed && this.epoch === epoch;
    }

    private async beginWork(): Promise<number | null> {
        while (this.pauseGate) {
            await this.pauseGate;
        }
        if (this.disposed) {
            return null;
        }
        this.activeOps++;
        return this.epoch;
    }

    private endWork(): void {
        this.activeOps = Math.max(0, this.activeOps - 1);
        if (this.activeOps === 0 && this.idleResolvers.length > 0) {
            const resolvers = this.idleResolvers.splice(0);
            for (const resolve of resolvers) {
                resolve();
            }
        }
    }

    private waitUntilIdle(): Promise<void> {
        if (this.activeOps === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.idleResolvers.push(resolve);
        });
    }

    private async runWork<T>(fallback: T, action: (epoch: number) => Promise<T>): Promise<T> {
        const epoch = await this.beginWork();
        if (epoch === null) {
            return fallback;
        }
        try {
            return await action(epoch);
        } finally {
            this.endWork();
        }
    }

    private async runExclusive(action: () => Promise<void>): Promise<void> {
        while (this.pauseGate) {
            await this.pauseGate;
        }
        let releasePause = () => { };
        this.pauseGate = new Promise((resolve) => {
            releasePause = resolve;
        });
        try {
            await this.waitUntilIdle();
            if (this.disposed) {
                return;
            }
            await action();
        } finally {
            this.pauseGate = null;
            releasePause();
        }
    }

    private enqueueKey<T>(table: string, key: string, task: () => Promise<T>): Promise<T> {
        let keyTails = this.keyOpTails.get(table);
        if (!keyTails) {
            keyTails = new Map<string, Promise<void>>();
            this.keyOpTails.set(table, keyTails);
        }
        const previous = keyTails.get(key) ?? Promise.resolve();
        const current = previous.catch(() => { }).then(task);
        keyTails.set(key, current.then(() => { }, () => { }));
        return current;
    }

    private runKeyWork<T>(
        tableName: string,
        key: string,
        fallback: T,
        action: (epoch: number, table: string, key: string) => Promise<T>,
    ): Promise<T> {
        const table = this.formatTableName(tableName);
        const normalizedKey = this.formatKey(key);
        if (!table || !normalizedKey) {
            return Promise.resolve(fallback);
        }
        return this.runWork(fallback, (epoch) => this.enqueueKey(table, normalizedKey, () => action(epoch, table, normalizedKey)));
    }

    private getTableCache(table: string): Map<string, CacheEntry> | undefined {
        return this.cached.get(table);
    }

    private deleteCacheEntry(table: string, key: string): void {
        const tableCache = this.getTableCache(table);
        if (!tableCache) {
            return;
        }
        const entry = tableCache.get(key);
        if (!entry) {
            return;
        }
        this.cacheLru.delete(entry);
        tableCache.delete(key);
        if (tableCache.size === 0) {
            this.cached.delete(table);
        }
    }

    private clearCacheByTable(table: string): void {
        const tableCache = this.getTableCache(table);
        if (!tableCache) {
            return;
        }
        for (const entry of tableCache.values()) {
            this.cacheLru.delete(entry);
        }
        this.cached.delete(table);
    }

    private evictCacheIfNeeded(): void {
        while (this.cacheLru.size > WebStorage.MAX_CACHE_ENTRIES) {
            const oldest = this.cacheLru.keys().next().value;
            if (!oldest) {
                break;
            }
            const ref = this.cacheLru.get(oldest);
            this.cacheLru.delete(oldest);
            if (ref) {
                this.deleteCacheEntry(ref.table, ref.key);
            }
        }
    }

    private saveCache(table: string, key: string, value: unknown): void {
        try {
            const json = JsonConvert.stringify(value);
            if (!json || json.length > WebStorage.MAX_CACHE_VALUE_LENGTH) {
                this.deleteCacheEntry(table, key);
                return;
            }
            this.deleteCacheEntry(table, key);
            const entry: CacheEntry = { origin: json, current: value };
            let tableCache = this.getTableCache(table);
            if (!tableCache) {
                tableCache = new Map<string, CacheEntry>();
                this.cached.set(table, tableCache);
            }
            tableCache.set(key, entry);
            this.cacheLru.set(entry, { table, key });
            this.evictCacheIfNeeded();
        } catch {
            this.deleteCacheEntry(table, key);
        }
    }

    private getCache(table: string, key: string): { exist: boolean, content: unknown } {
        const tableCache = this.getTableCache(table);
        const result = tableCache?.get(key);
        if (!result) {
            return { exist: false, content: null };
        }
        try {
            const currentJson = JsonConvert.stringify(result.current);
            if (result.origin != currentJson) {
                this.deleteCacheEntry(table, key);
                return { exist: false, content: null };
            }
        } catch {
            this.deleteCacheEntry(table, key);
            return { exist: false, content: null };
        }
        this.cacheLru.delete(result);
        this.cacheLru.set(result, { table, key });
        return { exist: true, content: result.current };
    }

    private getCacheOrigin(table: string, key: string): string | undefined {
        return this.getTableCache(table)?.get(key)?.origin;
    }

    private syncTableDataAfterWrite(table: string, mutate: (dataMap: Map<string, unknown>) => void): void {
        const dataMap = this.tableDatas.get(table);
        if (!dataMap) {
            return;
        }
        mutate(dataMap);
        if (!this.shouldUseMemory(dataMap.size)) {
            this.tableDatas.delete(table);
        }
    }

    private resetMemory(): void {
        this.tables.clear();
        this.inflightTables.clear();
        this.tableDatas.clear();
        this.cached.clear();
        this.cacheLru.clear();
        this.tableNames = [];
        this.tableNamesLoaded = false;
        this.tableNamesLoad = null;
        this.tableGenerations.clear();
        this.keyOpTails.clear();
    }

    async get<T>(tableName: string, key: string): Promise<T | null> {
        return this.runKeyWork<T | null>(tableName, key, null, async (epoch, table, normalizedKey) => {
            const forage = await this.fetchTable(table, false, epoch);
            if (!forage || !this.isCurrent(epoch)) {
                return null;
            }
            const { exist, content } = this.getCache(table, normalizedKey);
            if (exist) {
                return content as T;
            }
            const generation = this.getTableGeneration(table);
            const value = await forage.getItem(normalizedKey);
            if (!this.isCurrent(epoch)) {
                return null;
            }
            if (this.getTableGeneration(table) !== generation) {
                const latest = this.getCache(table, normalizedKey);
                if (latest.exist) {
                    return latest.content as T;
                }
                return null;
            }
            this.saveCache(table, normalizedKey, value);
            return value as T;
        });
    }

    async find<T>(tableName: string, predicate: (value: T, key: string, index: number) => boolean): Promise<T> {
        const table = this.formatTableName(tableName);
        if (!table) {
            return null;
        }
        return this.runWork<T>(null, async (epoch) => {
            const forage = await this.fetchTable(table, false, epoch);
            if (!forage || !this.isCurrent(epoch)) {
                return null;
            }
            const dataMap = this.tryGetMemoryTable(table);
            if (dataMap) {
                let index = 0;
                for (const [itemKey, value] of dataMap.entries()) {
                    if (predicate(value as T, itemKey, index)) {
                        return value as T;
                    }
                    index++;
                }
                return null;
            }

            const item = await forage.iterate<T, T>((value, itemKey, index) => {
                if (predicate(value, itemKey, index)) {
                    return value;
                }
            });
            return item ?? null;
        });
    }

    async filter<T>(tableName: string, predicate: (value: T, key: string, index: number) => boolean): Promise<T[]> {
        const table = this.formatTableName(tableName);
        if (!table) {
            return [];
        }
        return this.runWork<T[]>([], async (epoch) => {
            const forage = await this.fetchTable(table, false, epoch);
            if (!forage || !this.isCurrent(epoch)) {
                return [];
            }
            const items: T[] = [];
            const dataMap = await this.tryLoadMemoryTable(table, epoch);
            if (dataMap) {
                let index = 0;
                for (const [itemKey, value] of dataMap.entries()) {
                    if (predicate(value as T, itemKey, index)) {
                        items.push(value as T);
                    }
                    index++;
                }
                return items;
            }

            await forage.iterate<T, void>((value, itemKey, index) => {
                if (predicate(value, itemKey, index)) {
                    items.push(value);
                }
            });
            return items;
        });
    }

    async getAll<T>(tableName: string): Promise<Map<string, T>> {
        const table = this.formatTableName(tableName);
        if (!table) {
            return new Map<string, T>();
        }
        return this.runWork(new Map<string, T>(), async (epoch) => {
            return this.readAll<T>(table, epoch);
        });
    }

    private async readAll<T>(table: string, epoch: number): Promise<Map<string, T>> {
        const forage = await this.fetchTable(table, false, epoch);
        if (!forage || !this.isCurrent(epoch)) {
            return new Map<string, T>();
        }
        const dataMap = this.tableDatas.get(table);
        if (dataMap) {
            return this.cloneMap(dataMap) as Map<string, T>;
        }
        const generation = this.getTableGeneration(table);
        const keyValues = new Map<string, T>();
        await forage.iterate<T, void>((value, key) => {
            keyValues.set(key, value);
        });
        if (!this.isCurrent(epoch) || this.getTableGeneration(table) !== generation) {
            return keyValues;
        }
        if (this.shouldUseMemory(keyValues.size)) {
            this.tableDatas.set(table, this.cloneMap(keyValues));
        }
        return keyValues;
    }

    async set<T>(tableName: string, key: string, content: T, _from?: 'local' | 'server'): Promise<void> {
        await this.runKeyWork(tableName, key, undefined, async (epoch, table, normalizedKey) => {
            if (normalizedKey == 'undefined') {
                return;
            }
            const forage = await this.fetchTable(table, true, epoch);
            if (!forage || !this.isCurrent(epoch)) {
                return;
            }
            try {
                const origin = this.getCacheOrigin(table, normalizedKey);
                if (origin !== undefined && JsonConvert.stringify(content) === origin) {
                    this.syncTableDataAfterWrite(table, (dataMap) => {
                        dataMap.set(normalizedKey, content);
                    });
                    return;
                }
            } catch {
                // continue to persist when cache comparison fails
            }

            const generation = this.getTableGeneration(table);
            await forage.setItem(normalizedKey, content);
            if (!this.isCurrent(epoch) || this.getTableGeneration(table) !== generation) {
                return;
            }
            this.bumpTableGeneration(table);
            this.syncTableDataAfterWrite(table, (dataMap) => {
                dataMap.set(normalizedKey, content);
            });
            this.saveCache(table, normalizedKey, content);
        });
    }

    async delete(tableName: string, key: string, _from?: 'local' | 'server'): Promise<void> {
        await this.runKeyWork(tableName, key, undefined, async (epoch, table, normalizedKey) => {
            const forage = await this.fetchTable(table, false, epoch);
            if (!forage || !this.isCurrent(epoch)) {
                return;
            }
            const generation = this.getTableGeneration(table);
            await forage.removeItem(normalizedKey);
            if (!this.isCurrent(epoch) || this.getTableGeneration(table) !== generation) {
                return;
            }
            this.bumpTableGeneration(table);
            this.syncTableDataAfterWrite(table, (dataMap) => {
                dataMap.delete(normalizedKey);
            });
            this.deleteCacheEntry(table, normalizedKey);
        });
    }

    async count(tableName: string): Promise<number> {
        const table = this.formatTableName(tableName);
        if (!table) {
            return 0;
        }
        return this.runWork(0, async (epoch) => {
            const forage = await this.fetchTable(table, false, epoch);
            if (!forage || !this.isCurrent(epoch)) {
                return 0;
            }
            return await forage.length();
        });
    }

    async dropDb(): Promise<void> {
        await this.runExclusive(async () => {
            this.epoch++;
            this.resetMemory();
            await localforage.dropInstance({ name: this.dbName });
        });
    }

    async dropTable(tableName: string): Promise<void> {
        const table = this.formatTableName(tableName);
        if (!table) {
            return;
        }
        await this.runExclusive(async () => {
            const epoch = this.epoch;
            // Do not delete the instance directly, otherwise an error will occur when loading the db
            const forage = await this.fetchTable(table, false, epoch);
            if (forage) {
                await forage.clear();
            }
            if (!this.isCurrent(epoch)) {
                return;
            }
            this.bumpTableGeneration(table);
            this.tableDatas.delete(table);
            this.clearCacheByTable(table);
        });
    }

    async getTableNames() {
        return this.runWork<string[]>([], async (epoch) => {
            const currentTableNames = await this.internalGetTableNames(epoch);
            return currentTableNames.slice();
        });
    }

    private tryGetMemoryTable(table: string): Map<string, unknown> | undefined {
        return this.tableDatas.get(table);
    }

    private async tryLoadMemoryTable(table: string, epoch: number): Promise<Map<string, unknown> | undefined> {
        const existing = this.tryGetMemoryTable(table);
        if (existing) {
            return existing;
        }
        if (!this.canUseMemoryTable()) {
            return undefined;
        }
        const forage = await this.fetchTable(table, false, epoch);
        if (!forage || !this.isCurrent(epoch)) {
            return undefined;
        }
        const dataCount = await forage.length();
        if (!this.isCurrent(epoch) || !this.shouldUseMemory(dataCount)) {
            return undefined;
        }
        await this.readAll(table, epoch);
        return this.tableDatas.get(table);
    }

    private async internalGetTableNames(epoch: number) {
        if (!this.isCurrent(epoch)) {
            return [];
        }
        if (this.tableNamesLoaded) {
            return this.tableNames;
        }
        if (!this.tableNamesLoad) {
            this.tableNamesLoad = this.loadTableNamesFromIndexedDb()
                .then((names) => {
                    if (!this.isCurrent(epoch)) {
                        return [];
                    }
                    for (const name of names) {
                        if (!this.tableNames.includes(name)) {
                            this.tableNames.push(name);
                        }
                    }
                    this.tableNamesLoaded = true;
                    return this.tableNames;
                })
                .finally(() => {
                    if (this.epoch === epoch) {
                        this.tableNamesLoad = null;
                    }
                });
        }
        return this.tableNamesLoad;
    }

    private async loadTableNamesFromIndexedDb(): Promise<string[]> {
        if (typeof indexedDB === 'undefined') {
            return [];
        }
        if (typeof indexedDB.databases === 'function') {
            const databases = await indexedDB.databases();
            const exists = databases.some((db) => db.name === this.dbName);
            if (!exists) {
                return [];
            }
        }
        return await new Promise<string[]>((resolve, reject) => {
            const dbRequest = indexedDB.open(this.dbName);
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const names = Array.from(db.objectStoreNames);
                db.close();
                resolve(names);
            };
            dbRequest.onerror = () => {
                reject(dbRequest.error ?? new Error('Unable open database'));
            };
        });
    }

    /**
     * Get table
     * @param tableName Normalized table name
     * @param createIfNotExist Create if it does not exist (each LocalForage instance represents a table)
     */
    private async fetchTable(tableName: string, createIfNotExist: boolean, epoch: number): Promise<LocalForage | null> {
        if (!this.isCurrent(epoch)) {
            return null;
        }

        const existing = this.tables.get(tableName);
        if (existing) {
            return existing;
        }

        const inflight = this.inflightTables.get(tableName);
        if (inflight) {
            const table = await inflight;
            if (!this.isCurrent(epoch)) {
                return null;
            }
            if (table || !createIfNotExist) {
                return table;
            }
        }

        const task = this.openTable(tableName, createIfNotExist, epoch);
        this.inflightTables.set(tableName, task);
        try {
            return await task;
        } finally {
            if (this.inflightTables.get(tableName) === task) {
                this.inflightTables.delete(tableName);
            }
        }
    }

    private async openTable(tableName: string, createIfNotExist: boolean, epoch: number): Promise<LocalForage | null> {
        const existing = this.tables.get(tableName);
        if (existing) {
            return existing;
        }
        const tableNames = await this.internalGetTableNames(epoch);
        if (!this.isCurrent(epoch)) {
            return null;
        }
        if (!tableNames.includes(tableName) && !createIfNotExist) {
            return null;
        }
        const table = localforage.createInstance({
            driver: localforage.INDEXEDDB,
            name: this.dbName,
            storeName: tableName,
        });
        if (!this.isCurrent(epoch)) {
            return null;
        }
        if (!this.tableNames.includes(tableName)) {
            this.tableNames.push(tableName);
        }
        this.tables.set(tableName, table);
        return table;
    }

    private formatKey(key: string) {
        if (typeof key === 'number') {
            return (key as any).toString();
        }
        if (key == null || key == 'undefined') {
            return undefined;
        }
        return key;
    }

    async dispose(): Promise<void> {
        await this.runExclusive(async () => {
            this.disposed = true;
            this.epoch++;
            this.resetMemory();
        });
    }
}
