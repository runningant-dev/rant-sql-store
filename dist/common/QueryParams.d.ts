import { SqlDB } from "./SqlDB";
export interface QueryParam {
    index: number;
    name: string;
    value: any;
}
export declare class QueryParams {
    db: SqlDB;
    items: QueryParam[];
    indexes: any;
    constructor(db: SqlDB);
    add(name: string, value?: any): {
        index: number;
        name: string;
        value: any;
    };
    get(name: string): QueryParam | undefined;
    setValue(name: string, value: any): void;
    setValues(values: any): void;
    name(name: string): string;
    prepare(): any;
}
export declare class UnknownParamException {
}
