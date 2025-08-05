import { entityKind } from '~/entity.ts';
import type { TypedQueryBuilder } from '~/query-builders/query-builder.ts';
import { SQL, sql } from '~/sql/sql.ts';
import { Subquery } from '~/subquery.ts';
import type { SingleStoreDialect } from './dialect.ts';

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
 * A temporary table that extends Subquery to be compatible with .from() clauses.
 */
export class SingleStoreTempTable<TSelectedFields extends Record<string, unknown> = Record<string, unknown>>
	extends Subquery<string, TSelectedFields>
{
	static override readonly [entityKind]: string = 'SingleStoreTempTable';

	declare readonly $inferSelect: TSelectedFields;
	declare readonly $inferInsert: TSelectedFields;

	constructor(
		public readonly tableName: string,
		public readonly selectedFields: TSelectedFields,
		private readonly executeQuery: (sql: SQL) => Promise<any>,
	) {
		super(
			sql`${sql.identifier(tableName)}`,
			selectedFields,
			tableName,
			false,
			[],
		);

		// Add columns as properties, avoiding conflicts with existing methods
		const safeSelectedFields = Object.fromEntries(
			Object.entries(selectedFields).filter(([key]) => !(key in this)),
		);
		Object.assign(this, safeSelectedFields);
	}

	/**
	 * Override getSQL to return just the table identifier without parentheses.
	 */
	override getSQL(): SQL {
		return sql`${sql.identifier(this.tableName)}`;
	}

	/**
	 * Drop the temporary table.
	 */
	async drop(): Promise<void> {
		const dropSQL = sql`DROP TEMPORARY TABLE ${sql.identifier(this.tableName)}`;
		await this.executeQuery(dropSQL);
	}
}
