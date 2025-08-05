import { entityKind } from '~/entity.ts';
import type { TypedQueryBuilder } from '~/query-builders/query-builder.ts';
import { SQL, sql } from '~/sql/sql.ts';
import type { SingleStoreDialect } from './dialect.ts';
import { SingleStoreTable } from './table.ts';
import { Table } from '~/table.ts';

/**
 * Temporary table builder for creating temporary tables from queries.
 */
export class SingleStoreTempTableBuilder {
	static readonly [entityKind]: string = 'SingleStoreTempTableBuilder';

	constructor(
		public readonly name: string,
		private readonly executeQuery: (sql: SQL) => Promise<any>,
		private readonly dialect: SingleStoreDialect,
	) {}

	/**
	 * Creates a temporary table from a SELECT query.
	 */
	async as<TSelectedFields extends Record<string, unknown>>(
		query: TypedQueryBuilder<TSelectedFields> | SQL,
	): Promise<SingleStoreTempTable<TSelectedFields> & TSelectedFields> {
		let querySQL: SQL;
		if ('getSQL' in query) {
			querySQL = query.getSQL();
		} else {
			querySQL = query;
		}

		const builtQuery = this.dialect.sqlToQuery(querySQL);

		// Remove parentheses from the beginning and end if they exist
		let cleanSQL = builtQuery.sql.trim();
		if (cleanSQL.startsWith('(') && cleanSQL.endsWith(')')) {
			cleanSQL = cleanSQL.slice(1, -1);
		}

		const finalSQL = `CREATE TEMPORARY TABLE \`${this.name}\` AS ${cleanSQL}`;
		const createSQL = sql.raw(finalSQL);

		if (builtQuery.params && builtQuery.params.length > 0) {
			let paramIndex = 0;
			const parameterizedSQL = finalSQL.replace(/\?/g, () => {
				const param = builtQuery.params[paramIndex++];
				return typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param);
			});
			await this.executeQuery(sql.raw(parameterizedSQL));
		} else {
			await this.executeQuery(createSQL);
		}

		const selectedFields = 'getSelectedFields' in query
			? query.getSelectedFields()
			: ({} as TSelectedFields);

		const tempTable = new SingleStoreTempTable(this.name, selectedFields, this.executeQuery);

		return tempTable as SingleStoreTempTable<TSelectedFields> & TSelectedFields;
	}
}

/**
 * Helper type to infer select model from selected fields
 */
export type InferTempTableSelectModel<T extends SingleStoreTempTable<any>> = T extends
	SingleStoreTempTable<infer TSelectedFields> ? TSelectedFields
	: never;

/**
 * Helper type to infer insert model from selected fields (same as select for temp tables)
 */
export type InferTempTableInsertModel<T extends SingleStoreTempTable<any>> = InferTempTableSelectModel<T>;

/**
 * A temporary table that extends SingleStoreTable to work naturally with all table operations.
 */
export class SingleStoreTempTable<TSelectedFields extends Record<string, unknown> = Record<string, unknown>>
	extends SingleStoreTable<any>
{
	static override readonly [entityKind]: string = 'SingleStoreTempTable';

	declare readonly $inferSelect: TSelectedFields;
	declare readonly $inferInsert: TSelectedFields;

	constructor(
		public readonly tableName: string,
		public readonly selectedFields: TSelectedFields,
		private readonly executeQuery: (sql: SQL) => Promise<any>,
	) {
		// Call SingleStoreTable constructor with our temp table name
		// Table constructor expects: name, schema, baseName
		super(tableName, undefined, tableName);

		// Create column proxies that reference THIS temp table instead of the original table
		const builtColumns: Record<string, any> = {};
		
		for (const [key, column] of Object.entries(selectedFields)) {
			// If this is a column object, create a proxy that references this temp table
			if (column && typeof column === 'object' && 'table' in column) {
				// Create a new column object that points to our temp table
				const tempColumnProxy = Object.create(Object.getPrototypeOf(column));
				// Copy all properties from the original column
				Object.assign(tempColumnProxy, column);
				// But change the table reference to point to this temp table
				Object.defineProperty(tempColumnProxy, 'table', {
					value: this,
					writable: false,
					enumerable: true,
					configurable: false
				});
				builtColumns[key] = tempColumnProxy;
			} else {
				// Not a column, keep as is
				builtColumns[key] = column;
			}
		}

		// Set up the table symbols like a real SingleStore table
		(this as any)[Table.Symbol.Columns] = builtColumns;
		(this as any)[Table.Symbol.ExtraConfigColumns] = builtColumns;

		// Assign columns as properties to the table (like Object.assign(rawTable, builtColumns))
		Object.assign(this, builtColumns);
	}

	/**
	 * Drop the temporary table.
	 */
	async drop(): Promise<void> {
		const dropSQL = sql`DROP TEMPORARY TABLE ${sql.identifier(this.tableName)}`;
		await this.executeQuery(dropSQL);
	}
}
