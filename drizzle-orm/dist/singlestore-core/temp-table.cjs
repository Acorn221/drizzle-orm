"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var temp_table_exports = {};
__export(temp_table_exports, {
  SingleStoreTempTable: () => SingleStoreTempTable,
  SingleStoreTempTableBuilder: () => SingleStoreTempTableBuilder
});
module.exports = __toCommonJS(temp_table_exports);
var import_entity = require("../entity.cjs");
var import_sql = require("../sql/sql.cjs");
var import_subquery = require("../subquery.cjs");
var import_table = require("../table.cjs");
class SingleStoreTempTableBuilder {
  constructor(name, executeQuery, dialect) {
    this.name = name;
    this.executeQuery = executeQuery;
    this.dialect = dialect;
  }
  static [import_entity.entityKind] = "SingleStoreTempTableBuilder";
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
    const createTempTableSQL = import_sql.sql`CREATE TEMPORARY TABLE ${import_sql.sql.identifier(this.name)} AS ${querySQL}`;
    await this.executeQuery(createTempTableSQL);
    const selectedFields = "getSelectedFields" in query ? query.getSelectedFields() : {};
    const tempTable = new SingleStoreTempTable(this.name, selectedFields, this.executeQuery);
    return tempTable;
  }
}
class SingleStoreTempTable extends import_subquery.Subquery {
  constructor(tableName, selectedFields, executeQuery) {
    super(
      import_sql.sql`${import_sql.sql.identifier(tableName)}`,
      selectedFields,
      tableName,
      false,
      []
    );
    this.tableName = tableName;
    this.selectedFields = selectedFields;
    this.executeQuery = executeQuery;
    this[import_table.Table.Symbol.Name] = tableName;
    this[import_table.Table.Symbol.OriginalName] = tableName;
    this[import_table.Table.Symbol.BaseName] = tableName;
    this[import_table.Table.Symbol.Schema] = void 0;
    this[import_table.Table.Symbol.IsAlias] = false;
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
    this[import_table.Table.Symbol.Columns] = builtColumns;
    this[import_table.Table.Symbol.ExtraConfigColumns] = builtColumns;
    const safeSelectedFields = Object.fromEntries(
      Object.entries(builtColumns).filter(([key]) => !(key in this))
    );
    Object.assign(this, safeSelectedFields);
  }
  static [import_entity.entityKind] = "SingleStoreTempTable";
  /**
   * Override getSQL to return just the table identifier without parentheses.
   */
  getSQL() {
    return import_sql.sql`${import_sql.sql.identifier(this.tableName)}`;
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
    const dropSQL = import_sql.sql`DROP TEMPORARY TABLE ${import_sql.sql.identifier(this.tableName)}`;
    await this.executeQuery(dropSQL);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SingleStoreTempTable,
  SingleStoreTempTableBuilder
});
//# sourceMappingURL=temp-table.cjs.map