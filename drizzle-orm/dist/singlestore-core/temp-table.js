import { entityKind } from "../entity.js";
import { sql } from "../sql/sql.js";
import { Subquery } from "../subquery.js";
import { Table } from "../table.js";
class SingleStoreTempTableBuilder {
  constructor(name, executeQuery, dialect) {
    this.name = name;
    this.executeQuery = executeQuery;
    this.dialect = dialect;
  }
  static [entityKind] = "SingleStoreTempTableBuilder";
  /**
   * Creates a temporary table from a SELECT query.
   */
  async as(query) {
    let querySQL;
    if ("getSQL" in query) {
      querySQL = query.getSQL();
    } else {
      querySQL = query;
    }
    const createTempTableSQL = sql`CREATE TEMPORARY TABLE ${sql.identifier(this.name)} AS ${querySQL}`;
    await this.executeQuery(createTempTableSQL);
    const selectedFields = "getSelectedFields" in query ? query.getSelectedFields() : {};
    const tempTable = new SingleStoreTempTable(this.name, selectedFields, this.executeQuery);
    return tempTable;
  }
}
class SingleStoreTempTable extends Subquery {
  constructor(tableName, selectedFields, executeQuery) {
    super(
      sql`${sql.identifier(tableName)}`,
      selectedFields,
      tableName,
      false,
      []
    );
    this.tableName = tableName;
    this.selectedFields = selectedFields;
    this.executeQuery = executeQuery;
    this[Table.Symbol.Name] = tableName;
    this[Table.Symbol.OriginalName] = tableName;
    this[Table.Symbol.BaseName] = tableName;
    this[Table.Symbol.Schema] = void 0;
    this[Table.Symbol.IsAlias] = false;
    const builtColumns = {};
    for (const [key, column] of Object.entries(selectedFields)) {
      if (column && typeof column === "object" && "table" in column) {
        const tempColumnProxy = Object.create(Object.getPrototypeOf(column));
        Object.assign(tempColumnProxy, column);
        Object.defineProperty(tempColumnProxy, "table", {
          value: this,
          writable: false,
          enumerable: true,
          configurable: false
        });
        builtColumns[key] = tempColumnProxy;
      } else {
        builtColumns[key] = column;
      }
    }
    this[Table.Symbol.Columns] = builtColumns;
    this[Table.Symbol.ExtraConfigColumns] = builtColumns;
    const safeSelectedFields = Object.fromEntries(
      Object.entries(builtColumns).filter(([key]) => !(key in this))
    );
    Object.assign(this, safeSelectedFields);
  }
  static [entityKind] = "SingleStoreTempTable";
  /**
   * Override getSQL to return just the table identifier without parentheses.
   */
  getSQL() {
    return sql`${sql.identifier(this.tableName)}`;
  }
  /**
   * Prevents the temp table from being wrapped in parentheses in SQL generation.
   */
  shouldOmitSQLParens() {
    return true;
  }
  /**
   * Drop the temporary table.
   */
  async drop() {
    const dropSQL = sql`DROP TEMPORARY TABLE ${sql.identifier(this.tableName)}`;
    await this.executeQuery(dropSQL);
  }
}
export {
  SingleStoreTempTable,
  SingleStoreTempTableBuilder
};
//# sourceMappingURL=temp-table.js.map