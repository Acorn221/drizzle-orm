'use strict';

var v = require('valibot');
var drizzleOrm = require('drizzle-orm');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var v__namespace = /*#__PURE__*/_interopNamespaceDefault(v);

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

const literalSchema = v__namespace.union([v__namespace.string(), v__namespace.number(), v__namespace.boolean(), v__namespace.null()]);
const jsonSchema = v__namespace.union([
    literalSchema,
    v__namespace.array(v__namespace.any()),
    v__namespace.record(v__namespace.string(), v__namespace.any()),
]);
const bufferSchema = v__namespace.custom((v) => v instanceof Buffer); // eslint-disable-line no-instanceof/no-instanceof
function mapEnumValues(values) {
    return Object.fromEntries(values.map((value) => [value, value]));
}
function columnToSchema(column) {
    let schema;
    if (isWithEnum(column)) {
        schema = column.enumValues.length ? v__namespace.enum(mapEnumValues(column.enumValues)) : v__namespace.string();
    }
    if (!schema) {
        // Handle specific types
        if (isColumnType(column, ['PgGeometry', 'PgPointTuple'])) {
            schema = v__namespace.tuple([v__namespace.number(), v__namespace.number()]);
        }
        else if (isColumnType(column, ['PgGeometryObject', 'PgPointObject'])) {
            schema = v__namespace.object({ x: v__namespace.number(), y: v__namespace.number() });
        }
        else if (isColumnType(column, ['PgHalfVector', 'PgVector'])) {
            schema = v__namespace.array(v__namespace.number());
            schema = column.dimensions ? v__namespace.pipe(schema, v__namespace.length(column.dimensions)) : schema;
        }
        else if (isColumnType(column, ['PgLine'])) {
            schema = v__namespace.tuple([v__namespace.number(), v__namespace.number(), v__namespace.number()]);
            v__namespace.array(v__namespace.array(v__namespace.number()));
        }
        else if (isColumnType(column, ['PgLineABC'])) {
            schema = v__namespace.object({ a: v__namespace.number(), b: v__namespace.number(), c: v__namespace.number() });
        } // Handle other types
        else if (isColumnType(column, ['PgArray'])) {
            schema = v__namespace.array(columnToSchema(column.baseColumn));
            schema = column.size ? v__namespace.pipe(schema, v__namespace.length(column.size)) : schema;
        }
        else if (column.dataType === 'array') {
            schema = v__namespace.array(v__namespace.any());
        }
        else if (column.dataType === 'number') {
            schema = numberColumnToSchema(column);
        }
        else if (column.dataType === 'bigint') {
            schema = bigintColumnToSchema(column);
        }
        else if (column.dataType === 'boolean') {
            schema = v__namespace.boolean();
        }
        else if (column.dataType === 'date') {
            schema = v__namespace.date();
        }
        else if (column.dataType === 'string') {
            schema = stringColumnToSchema(column);
        }
        else if (column.dataType === 'json') {
            schema = jsonSchema;
        }
        else if (column.dataType === 'custom') {
            schema = v__namespace.any();
        }
        else if (column.dataType === 'buffer') {
            schema = bufferSchema;
        }
    }
    if (!schema) {
        schema = v__namespace.any();
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
    const actions = [v__namespace.minValue(min), v__namespace.maxValue(max)];
    if (integer) {
        actions.push(v__namespace.integer());
    }
    return v__namespace.pipe(v__namespace.number(), ...actions);
}
function bigintColumnToSchema(column) {
    const unsigned = column.getSQLType().includes('unsigned');
    const min = unsigned ? 0n : CONSTANTS.INT64_MIN;
    const max = unsigned ? CONSTANTS.INT64_UNSIGNED_MAX : CONSTANTS.INT64_MAX;
    return v__namespace.pipe(v__namespace.bigint(), v__namespace.minValue(min), v__namespace.maxValue(max));
}
function stringColumnToSchema(column) {
    if (isColumnType(column, ['PgUUID'])) {
        return v__namespace.pipe(v__namespace.string(), v__namespace.uuid());
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
        actions.push(v__namespace.regex(regex));
    }
    if (max && fixed) {
        actions.push(v__namespace.length(max));
    }
    else if (max) {
        actions.push(v__namespace.maxLength(max));
    }
    return actions.length > 0 ? v__namespace.pipe(v__namespace.string(), ...actions) : v__namespace.string();
}

function getColumns(tableLike) {
    return drizzleOrm.isTable(tableLike) ? drizzleOrm.getTableColumns(tableLike) : drizzleOrm.getViewSelectedFields(tableLike);
}
function handleColumns(columns, refinements, conditions) {
    const columnSchemas = {};
    for (const [key, selected] of Object.entries(columns)) {
        if (!drizzleOrm.is(selected, drizzleOrm.Column) && !drizzleOrm.is(selected, drizzleOrm.SQL) && !drizzleOrm.is(selected, drizzleOrm.SQL.Aliased) && typeof selected === 'object') {
            const columns = drizzleOrm.isTable(selected) || drizzleOrm.isView(selected) ? getColumns(selected) : selected;
            columnSchemas[key] = handleColumns(columns, refinements[key] ?? {}, conditions);
            continue;
        }
        const refinement = refinements[key];
        if (refinement !== undefined && typeof refinement !== 'function') {
            columnSchemas[key] = refinement;
            continue;
        }
        const column = drizzleOrm.is(selected, drizzleOrm.Column) ? selected : undefined;
        const schema = column ? columnToSchema(column) : v__namespace.any();
        const refined = typeof refinement === 'function' ? refinement(schema) : schema;
        if (conditions.never(column)) {
            continue;
        }
        else {
            columnSchemas[key] = refined;
        }
        if (column) {
            if (conditions.nullable(column)) {
                columnSchemas[key] = v__namespace.nullable(columnSchemas[key]);
            }
            if (conditions.optional(column)) {
                columnSchemas[key] = v__namespace.optional(columnSchemas[key]);
            }
        }
    }
    return v__namespace.object(columnSchemas);
}
const createSelectSchema = (entity, refine) => {
    if (isPgEnum(entity)) {
        return v__namespace.enum(mapEnumValues(entity.enumValues));
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

exports.bufferSchema = bufferSchema;
exports.createInsertSchema = createInsertSchema;
exports.createSelectSchema = createSelectSchema;
exports.createUpdateSchema = createUpdateSchema;
exports.isColumnType = isColumnType;
exports.isPgEnum = isPgEnum;
exports.isWithEnum = isWithEnum;
exports.jsonSchema = jsonSchema;
exports.literalSchema = literalSchema;
//# sourceMappingURL=index.cjs.map
