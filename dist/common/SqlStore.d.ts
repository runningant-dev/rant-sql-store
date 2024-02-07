import { Change, ContainerDef, ObjectDef, SearchOptions, TrackingOptions, UserContext } from "rant-store";
import { SqlDB } from "./SqlDB";
export declare class SqlStore {
    db?: SqlDB;
    constructor();
    connect(): Promise<void>;
    close(): Promise<void>;
    getContainer(options: {
        name: string;
    }): Promise<{
        name: string;
        container: any;
        indexes: any;
        sensitive: any;
    }>;
    deleteContainer(options: {
        name: string;
    }): Promise<void>;
    setContainer(options: ContainerDef & {
        recreate?: boolean;
        delete?: boolean;
        user?: UserContext;
    }, changeTracking: TrackingOptions): Promise<true | undefined>;
    private indexUpdater;
    get(options: {
        container: string;
        id: string;
    }): Promise<any>;
    getExisting(container: string, id: string): Promise<any>;
    set(options: {
        container: string;
        object: ObjectDef;
        user?: UserContext;
    }, changeTracking: TrackingOptions): Promise<void>;
    del(options: {
        container: string;
        id: string;
    }, changeTracking: TrackingOptions): Promise<boolean>;
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
}
