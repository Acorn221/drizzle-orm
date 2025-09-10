import * as v from 'valibot';
import { isTable, getTableColumns, getViewSelectedFields, is, Column, SQL, isView } from 'drizzle-orm';

const CONSTANTS = {
    INT8_MIN: -128,
    INT8_MAX: 127,
    INT8_UNSIGNED_MAX: 255,
    INT16_MIN: -32768,
    INT16_MAX: 32767,
    INT16_UNSIGNED_MAX: 65535,
    INT24_MIN: -8388608,
    INT24_MAX: 8388607,
    INT24_UNSIGNED_MAX: 16777215,
    INT32_MIN: -2147483648,
    INT32_MAX: 2147483647,
    INT32_UNSIGNED_MAX: 4294967295,
    INT48_MIN: -140737488355328,
    INT48_MAX: 140737488355327,
    INT48_UNSIGNED_MAX: 281474976710655,
    INT64_MIN: -9223372036854775808n,
    INT64_MAX: 9223372036854775807n,
    INT64_UNSIGNED_MAX: 18446744073709551615n,
};

function isColumnType(column, columnTypes) {
    return columnTypes.includes(column.columnType);
}
function isWithEnum(column) {
    return 'enumValues' in column && Array.isArray(column.enumValues) && column.enumValues.length > 0;
}
const isPgEnum = isWithEnum;

const literalSchema = v.union([v.string(), v.number(), v.boolean(), v.null()]);
const jsonSchema = v.union([
    literalSchema,
    v.array(v.any()),
    v.record(v.string(), v.any()),
]);
const bufferSchema = v.custom((v) => v instanceof Buffer); // eslint-disable-line no-instanceof/no-instanceof
function mapEnumValues(values) {
    return Object.fromEntries(values.map((value) => [value, value]));
}
function columnToSchema(column) {
    let schema;
    if (isWithEnum(column)) {
        schema = column.enumValues.length ? v.enum(mapEnumValues(column.enumValues)) : v.string();
    }
    if (!schema) {
        // Handle specific types
        if (isColumnType(column, ['PgGeometry', 'PgPointTuple'])) {
            schema = v.tuple([v.number(), v.number()]);
        }
        else if (isColumnType(column, ['PgGeometryObject', 'PgPointObject'])) {
            schema = v.object({ x: v.number(), y: v.number() });
        }
        else if (isColumnType(column, ['PgHalfVector', 'PgVector'])) {
            schema = v.array(v.number());
            schema = column.dimensions ? v.pipe(schema, v.length(column.dimensions)) : schema;
        }
        else if (isColumnType(column, ['PgLine'])) {
            schema = v.tuple([v.number(), v.number(), v.number()]);
            v.array(v.array(v.number()));
        }
        else if (isColumnType(column, ['PgLineABC'])) {
            schema = v.object({ a: v.number(), b: v.number(), c: v.number() });
        } // Handle other types
        else if (isColumnType(column, ['PgArray'])) {
            schema = v.array(columnToSchema(column.baseColumn));
            schema = column.size ? v.pipe(schema, v.length(column.size)) : schema;
        }
        else if (column.dataType === 'array') {
            schema = v.array(v.any());
        }
        else if (column.dataType === 'number') {
            schema = numberColumnToSchema(column);
        }
        else if (column.dataType === 'bigint') {
            schema = bigintColumnToSchema(column);
        }
        else if (column.dataType === 'boolean') {
            schema = v.boolean();
        }
        else if (column.dataType === 'date') {
            schema = v.date();
        }
        else if (column.dataType === 'string') {
            schema = stringColumnToSchema(column);
        }
        else if (column.dataType === 'json') {
            schema = jsonSchema;
        }
        else if (column.dataType === 'custom') {
            schema = v.any();
        }
        else if (column.dataType === 'buffer') {
            schema = bufferSchema;
        }
    }
    if (!schema) {
        schema = v.any();
    }
    return schema;
}
function numberColumnToSchema(column) {
    let unsigned = column.getSQLType().includes('unsigned');
    let min;
    let max;
    let integer = false;
    if (isColumnType(column, ['MySqlTinyInt', 'SingleStoreTinyInt'])) {
        min = unsigned ? 0 : CONSTANTS.INT8_MIN;
        max = unsigned ? CONSTANTS.INT8_UNSIGNED_MAX : CONSTANTS.INT8_MAX;
        integer = true;
    }
    else if (isColumnType(column, [
        'PgSmallInt',
        'PgSmallSerial',
        'MySqlSmallInt',
        'SingleStoreSmallInt',
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT16_MIN;
        max = unsigned ? CONSTANTS.INT16_UNSIGNED_MAX : CONSTANTS.INT16_MAX;
        integer = true;
    }
    else if (isColumnType(column, [
        'PgReal',
        'MySqlFloat',
        'MySqlMediumInt',
        'SingleStoreFloat',
        'SingleStoreMediumInt',
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT24_MIN;
        max = unsigned ? CONSTANTS.INT24_UNSIGNED_MAX : CONSTANTS.INT24_MAX;
        integer = isColumnType(column, ['MySqlMediumInt', 'SingleStoreMediumInt']);
    }
    else if (isColumnType(column, [
        'PgInteger',
        'PgSerial',
        'MySqlInt',
        'SingleStoreInt',
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT32_MIN;
        max = unsigned ? CONSTANTS.INT32_UNSIGNED_MAX : CONSTANTS.INT32_MAX;
        integer = true;
    }
    else if (isColumnType(column, [
        'PgDoublePrecision',
        'MySqlReal',
        'MySqlDouble',
        'SingleStoreReal',
        'SingleStoreDouble',
        'SQLiteReal',
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT48_MIN;
        max = unsigned ? CONSTANTS.INT48_UNSIGNED_MAX : CONSTANTS.INT48_MAX;
    }
    else if (isColumnType(column, [
        'PgBigInt53',
        'PgBigSerial53',
        'MySqlBigInt53',
        'MySqlSerial',
        'SingleStoreBigInt53',
        'SingleStoreSerial',
        'SQLiteInteger',
    ])) {
        unsigned = unsigned || isColumnType(column, ['MySqlSerial', 'SingleStoreSerial']);
        min = unsigned ? 0 : Number.MIN_SAFE_INTEGER;
        max = Number.MAX_SAFE_INTEGER;
        integer = true;
    }
    else if (isColumnType(column, ['MySqlYear', 'SingleStoreYear'])) {
        min = 1901;
        max = 2155;
        integer = true;
    }
    else {
        min = Number.MIN_SAFE_INTEGER;
        max = Number.MAX_SAFE_INTEGER;
    }
    const actions = [v.minValue(min), v.maxValue(max)];
    if (integer) {
        actions.push(v.integer());
    }
    return v.pipe(v.number(), ...actions);
}
function bigintColumnToSchema(column) {
    const unsigned = column.getSQLType().includes('unsigned');
    const min = unsigned ? 0n : CONSTANTS.INT64_MIN;
    const max = unsigned ? CONSTANTS.INT64_UNSIGNED_MAX : CONSTANTS.INT64_MAX;
    return v.pipe(v.bigint(), v.minValue(min), v.maxValue(max));
}
function stringColumnToSchema(column) {
    if (isColumnType(column, ['PgUUID'])) {
        return v.pipe(v.string(), v.uuid());
    }
    let max;
    let regex;
    let fixed = false;
    if (isColumnType(column, ['PgVarchar', 'SQLiteText'])) {
        max = column.length;
    }
    else if (isColumnType(column, ['MySqlVarChar', 'SingleStoreVarChar'])) {
        max = column.length ?? CONSTANTS.INT16_UNSIGNED_MAX;
    }
    else if (isColumnType(column, ['MySqlText', 'SingleStoreText'])) {
        if (column.textType === 'longtext') {
            max = CONSTANTS.INT32_UNSIGNED_MAX;
        }
        else if (column.textType === 'mediumtext') {
            max = CONSTANTS.INT24_UNSIGNED_MAX;
        }
        else if (column.textType === 'text') {
            max = CONSTANTS.INT16_UNSIGNED_MAX;
        }
        else {
            max = CONSTANTS.INT8_UNSIGNED_MAX;
        }
    }
    if (isColumnType(column, [
        'PgChar',
        'MySqlChar',
        'SingleStoreChar',
    ])) {
        max = column.length;
        fixed = true;
    }
    if (isColumnType(column, ['PgBinaryVector'])) {
        regex = /^[01]+$/;
        max = column.dimensions;
    }
    const actions = [];
    if (regex) {
        actions.push(v.regex(regex));
    }
    if (max && fixed) {
        actions.push(v.length(max));
    }
    else if (max) {
        actions.push(v.maxLength(max));
    }
    return actions.length > 0 ? v.pipe(v.string(), ...actions) : v.string();
}

function getColumns(tableLike) {
    return isTable(tableLike) ? getTableColumns(tableLike) : getViewSelectedFields(tableLike);
}
function handleColumns(columns, refinements, conditions) {
    const columnSchemas = {};
    for (const [key, selected] of Object.entries(columns)) {
        if (!is(selected, Column) && !is(selected, SQL) && !is(selected, SQL.Aliased) && typeof selected === 'object') {
            const columns = isTable(selected) || isView(selected) ? getColumns(selected) : selected;
            columnSchemas[key] = handleColumns(columns, refinements[key] ?? {}, conditions);
            continue;
        }
        const refinement = refinements[key];
        if (refinement !== undefined && typeof refinement !== 'function') {
            columnSchemas[key] = refinement;
            continue;
        }
        const column = is(selected, Column) ? selected : undefined;
        const schema = column ? columnToSchema(column) : v.any();
        const refined = typeof refinement === 'function' ? refinement(schema) : schema;
        if (conditions.never(column)) {
            continue;
        }
        else {
            columnSchemas[key] = refined;
        }
        if (column) {
            if (conditions.nullable(column)) {
                columnSchemas[key] = v.nullable(columnSchemas[key]);
            }
            if (conditions.optional(column)) {
                columnSchemas[key] = v.optional(columnSchemas[key]);
            }
        }
    }
    return v.object(columnSchemas);
}
const createSelectSchema = (entity, refine) => {
    if (isPgEnum(entity)) {
        return v.enum(mapEnumValues(entity.enumValues));
    }
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, {
        never: () => false,
        optional: () => false,
        nullable: (column) => !column.notNull,
    });
};
const createInsertSchema = (entity, refine) => {
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, {
        never: (column) => column?.generated?.type === 'always' || column?.generatedIdentity?.type === 'always',
        optional: (column) => !column.notNull || (column.notNull && column.hasDefault),
        nullable: (column) => !column.notNull,
    });
};
const createUpdateSchema = (entity, refine) => {
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, {
        never: (column) => column?.generated?.type === 'always' || column?.generatedIdentity?.type === 'always',
        optional: () => true,
        nullable: (column) => !column.notNull,
    });
};

export { bufferSchema, createInsertSchema, createSelectSchema, createUpdateSchema, isColumnType, isPgEnum, isWithEnum, jsonSchema, literalSchema };
//# sourceMappingURL=index.mjs.map
