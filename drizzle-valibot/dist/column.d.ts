import type { Column } from 'drizzle-orm';
import * as v from 'valibot';
import type { Json } from './utils.js';
export declare const literalSchema: v.UnionSchema<[v.StringSchema<undefined>, v.NumberSchema<undefined>, v.BooleanSchema<undefined>, v.NullSchema<undefined>], undefined>;
export declare const jsonSchema: v.GenericSchema<Json>;
export declare const bufferSchema: v.GenericSchema<Buffer>;
export declare function mapEnumValues(values: string[]): {
    [k: string]: string;
};
export declare function columnToSchema(column: Column): v.GenericSchema;
