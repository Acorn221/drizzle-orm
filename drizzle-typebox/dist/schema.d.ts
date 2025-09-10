import type { TSchema } from '@sinclair/typebox';
import type { Table, View } from 'drizzle-orm';
import type { PgEnum } from 'drizzle-orm/pg-core';
import type { Conditions } from './schema.types.internal.js';
import type { CreateInsertSchema, CreateSchemaFactoryOptions, CreateSelectSchema, CreateUpdateSchema } from './schema.types.js';
export declare function getColumns(tableLike: Table | View): import("drizzle-orm").ColumnsSelection;
export declare function handleColumns(columns: Record<string, any>, refinements: Record<string, any>, conditions: Conditions, factory?: CreateSchemaFactoryOptions): TSchema;
export declare function handleEnum(enum_: PgEnum<any>, factory?: CreateSchemaFactoryOptions): import("@sinclair/typebox").TEnum<{
    [k: string]: string;
}>;
export declare const createSelectSchema: CreateSelectSchema;
export declare const createInsertSchema: CreateInsertSchema;
export declare const createUpdateSchema: CreateUpdateSchema;
export declare function createSchemaFactory(options?: CreateSchemaFactoryOptions): {
    createSelectSchema: CreateSelectSchema;
    createInsertSchema: CreateInsertSchema;
    createUpdateSchema: CreateUpdateSchema;
};
