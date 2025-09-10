import type { TSchema, Type as typebox } from '@sinclair/typebox';
import type { Column } from 'drizzle-orm';
import type { BufferSchema, JsonSchema } from "./utils.mjs";
export declare const literalSchema: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TString, import("@sinclair/typebox").TNumber, import("@sinclair/typebox").TBoolean, import("@sinclair/typebox").TNull]>;
export declare const jsonSchema: JsonSchema;
export declare const bufferSchema: BufferSchema;
export declare function mapEnumValues(values: string[]): {
    [k: string]: string;
};
export declare function columnToSchema(column: Column, t: typeof typebox): TSchema;
