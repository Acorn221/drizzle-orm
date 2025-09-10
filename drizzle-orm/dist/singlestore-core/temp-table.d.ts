import { entityKind } from "../entity.js";
import type { TypedQueryBuilder } from "../query-builders/query-builder.js";
import { SQL } from "../sql/sql.js";
import { Subquery } from "../subquery.js";
import type { SingleStoreDialect } from "./dialect.js";
/**
 * Temporary table builder for creating temporary tables from queries.
 */
export declare class SingleStoreTempTableBuilder {
    readonly name: string;
    private readonly executeQuery;
    private readonly dialect;
    static readonly [entityKind]: string;
    constructor(name: string, executeQuery: (sql: SQL) => Promise<any>, dialect: SingleStoreDialect);
    /**
     * Creates a temporary table from a SELECT query.
     */
    as<TSelectedFields extends Record<string, unknown>>(query: TypedQueryBuilder<TSelectedFields> | SQL): Promise<SingleStoreTempTable<TSelectedFields> & TSelectedFields>;
}
/**
 * Helper type to infer select model from selected fields
 */
export type InferTempTableSelectModel<T extends SingleStoreTempTable<any>> = T extends SingleStoreTempTable<infer TSelectedFields> ? TSelectedFields : never;
/**
 * Helper type to infer insert model from selected fields (same as select for temp tables)
 */
export type InferTempTableInsertModel<T extends SingleStoreTempTable<any>> = InferTempTableSelectModel<T>;
/**
 * A temporary table that extends Subquery to be compatible with .from() clauses.
 */
export declare class SingleStoreTempTable<TSelectedFields extends Record<string, unknown> = Record<string, unknown>> extends Subquery<string, TSelectedFields> {
    readonly tableName: string;
    readonly selectedFields: TSelectedFields;
    private readonly executeQuery;
    static readonly [entityKind]: string;
    readonly $inferSelect: TSelectedFields;
    readonly $inferInsert: TSelectedFields;
    constructor(tableName: string, selectedFields: TSelectedFields, executeQuery: (sql: SQL) => Promise<any>);
    /**
     * Override getSQL to return just the table identifier without parentheses.
     */
    getSQL(): SQL;
    /**
     * Prevents the temp table from being wrapped in parentheses in SQL generation.
     */
    shouldOmitSQLParens(): boolean;
    /**
     * Drop the temporary table.
     */
    drop(): Promise<void>;
}
