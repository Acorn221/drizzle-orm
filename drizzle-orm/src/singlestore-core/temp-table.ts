import { entityKind } from '~/entity.ts';
import { sql, SQL } from '~/sql/sql.ts';
import type { TypedQueryBuilder } from '~/query-builders/query-builder.ts';
import type { SingleStoreDialect } from './dialect.ts';
import { Subquery } from '~/subquery.ts';

/**
 * Temporary table builder - step 1 of the chainable API
 */
export class SingleStoreTempTableBuilder {
	static readonly [entityKind]: string = 'SingleStoreTempTableBuilder';

	constructor(
		public readonly name: string,
		private readonly executeQuery: (sql: SQL) => Promise<any>,
		private readonly dialect: SingleStoreDialect,
	) {}

	/**
	 * Pattern 1: .as(query) method to create temporary table from SELECT query
	 */
	async as<TSelectedFields extends Record<string, unknown>>(
		query: TypedQueryBuilder<TSelectedFields> | SQL,
	): Promise<SingleStoreTempTable<TSelectedFields> & TSelectedFields> {
		// Execute the CREATE TEMPORARY TABLE AS SELECT statement
		// We'll extract the raw SQL and parameters manually to completely avoid parentheses
		let querySQL: SQL;
		if ('getSQL' in query) {
			querySQL = query.getSQL();
		} else {
			querySQL = query;
		}
		
		// Convert to query but extract the SQL and parameters manually
		const builtQuery = this.dialect.sqlToQuery(querySQL);
		
		// Remove parentheses from the beginning and end if they exist
		let cleanSQL = builtQuery.sql.trim();
		if (cleanSQL.startsWith('(') && cleanSQL.endsWith(')')) {
			cleanSQL = cleanSQL.slice(1, -1);
		}
		
		// Create the final SQL manually with parameters
		const finalSQL = `CREATE TEMPORARY TABLE \`${this.name}\` AS ${cleanSQL}`;
		
		// Create a new SQL object with the clean query and original parameters
		const createSQL = sql.raw(finalSQL);
		
		// We need to manually handle the parameters too
		if (builtQuery.params && builtQuery.params.length > 0) {
			// Create a parameterized query
			let paramIndex = 0;
			const parameterizedSQL = finalSQL.replace(/\?/g, () => {
				const param = builtQuery.params[paramIndex++];
				return typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param);
			});
			await this.executeQuery(sql.raw(parameterizedSQL));
		} else {
			await this.executeQuery(createSQL);
		}
		
		// Get the selected fields to create a proper table structure
		const selectedFields = 'getSelectedFields' in query 
			? query.getSelectedFields() 
			: ({} as TSelectedFields);
		
		// Create a temp table using Subquery since it accepts Record<string, unknown>
		const tempTable = new SingleStoreTempTable(this.name, selectedFields, this.executeQuery);
		
		// Return with intersection type to include column properties
		return tempTable as SingleStoreTempTable<TSelectedFields> & TSelectedFields;
	}
}

/**
 * Helper type to infer select model from selected fields
 */
export type InferTempTableSelectModel<T extends SingleStoreTempTable<any>> = T extends SingleStoreTempTable<infer TSelectedFields> 
	? TSelectedFields 
	: never;

/**
 * Helper type to infer insert model from selected fields (same as select for temp tables)
 */
export type InferTempTableInsertModel<T extends SingleStoreTempTable<any>> = InferTempTableSelectModel<T>;

/**
 * A temporary table that extends Subquery to be compatible with .from() clauses
 * Uses Subquery since it accepts Record<string, unknown> which matches our TSelectedFields
 */
export class SingleStoreTempTable<TSelectedFields extends Record<string, unknown> = Record<string, unknown>> extends Subquery<string, TSelectedFields> {
	static override readonly [entityKind]: string = 'SingleStoreTempTable';

	// These properties enable InferSelectModel and InferInsertModel to work
	declare readonly $inferSelect: TSelectedFields;
	declare readonly $inferInsert: TSelectedFields;

	constructor(
		public readonly tableName: string,
		public readonly selectedFields: TSelectedFields,
		private readonly executeQuery: (sql: SQL) => Promise<any>,
	) {
		// Call Subquery constructor with proper arguments
		super(
			sql`${sql.identifier(tableName)}`, // The table identifier as SQL
			selectedFields,                     // The selected fields
			tableName,                         // alias (table name)
			false,                             // isWith (not a CTE)
			[]                                 // usedTables
		);
		
		// Add columns as properties, but filter out properties that already exist on this class
		// to avoid conflicts with our own methods like 'name', 'tableName', etc.
		const safeSelectedFields = Object.fromEntries(
			Object.entries(selectedFields).filter(([key]) => !(key in this))
		);
		Object.assign(this, safeSelectedFields);
	}

	/**
	 * Override getSQL to return just the table identifier without parentheses
	 * This makes it behave like a table, not a subquery
	 */
	override getSQL(): SQL {
		return sql`${sql.identifier(this.tableName)}`;
	}

	/**
	 * Drop the temporary table
	 */
	async drop(): Promise<void> {
		const dropSQL = sql`DROP TEMPORARY TABLE ${sql.identifier(this.tableName)}`;
		await this.executeQuery(dropSQL);
	}
} 