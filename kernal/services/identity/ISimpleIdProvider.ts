export interface ISimpleIdProvider {
    getSimpleId(url: any): Promise<string>;
}