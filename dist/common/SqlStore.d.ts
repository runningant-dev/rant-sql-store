import { AuthToken, Change, ContainerDef, ObjectDef, SearchOptions, TrackingOptions } from "rant-store";
import { SqlDB } from "./SqlDB";
export declare type EventType = "connect" | "close" | "getcontainer" | "delcontainer" | "setcontainer" | "get" | "set" | "del" | "search" | "createindex";
export interface Event {
    type: EventType;
    [k: string]: any;
}
export declare class SqlStore {
    db?: SqlDB;
    listeners: any[];
    constructor();
    connect(): Promise<void>;
    close(): Promise<void>;
    getContainer(options: {
        name: string;
    }): Promise<{
        name: string;
        indexes: any;
        sensitive: any;
    }>;
    deleteContainer(options: {
        name: string;
    }): Promise<void>;
    setContainer(options: ContainerDef & {
        recreate?: boolean;
        delete?: boolean;
        authToken?: AuthToken;
    }, changeTracking?: TrackingOptions): Promise<true | undefined>;
    private indexUpdater;
    validateIDs(ids?: string[]): string | undefined;
    get(options: {
        container: string;
        ids: string[];
        pruneSensitive?: boolean;
        roles?: string[];
    }): Promise<any>;
    set(options: {
        container: string;
        object: ObjectDef;
        authToken?: AuthToken;
        merge?: boolean;
        returnObject?: boolean;
    }, changeTracking?: TrackingOptions): Promise<any>;
    del(options: {
        container: string;
        id: string;
    }, changeTracking?: TrackingOptions): Promise<boolean>;
    getIndexes(container: string): Promise<any>;
    reset(options: {}): Promise<void>;
    searchAll(queries: SearchOptions[]): Promise<any[]>;
    search(options: SearchOptions): Promise<any>;
    getChanges(options: {
        from?: number;
        since?: string;
    }): Promise<any[]>;
    merge(options: {
        changes: Change[];
    }): Promise<void>;
    applyChangesToObject(container: string, id: string, changes: Change[]): Promise<void>;
    createIndex(searchTableName: string, propName: string): Promise<void>;
    notify(e: Event): Promise<void>;
    addEventListener(options: {
        handler: (e: any) => void;
    }): void;
    removeEventListener(options: {
        handler: (e: any) => void;
    }): void;
}
