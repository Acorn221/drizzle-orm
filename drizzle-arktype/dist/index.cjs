'use strict';

var arktype = require('arktype');
var drizzleOrm = require('drizzle-orm');

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

const literalSchema = arktype.type.string.or(arktype.type.number).or(arktype.type.boolean).or(arktype.type.null);
const jsonSchema = literalSchema.or(arktype.type.unknown.as().array()).or(arktype.type.object.as());
const bufferSchema = arktype.type.unknown.narrow((value) => value instanceof Buffer).as().describe(// eslint-disable-line no-instanceof/no-instanceof
'a Buffer instance');
function columnToSchema(column) {
    let schema;
    if (isWithEnum(column)) {
        schema = column.enumValues.length ? arktype.type.enumerated(...column.enumValues) : arktype.type.string;
    }
    if (!schema) {
        // Handle specific types
        if (isColumnType(column, ['PgGeometry', 'PgPointTuple'])) {
            schema = arktype.type([arktype.type.number, arktype.type.number]);
        }
        else if (isColumnType(column, ['PgGeometryObject', 'PgPointObject'])) {
            schema = arktype.type({
                x: arktype.type.number,
                y: arktype.type.number,
            });
        }
        else if (isColumnType(column, ['PgHalfVector', 'PgVector'])) {
            schema = column.dimensions
                ? arktype.type.number.array().exactlyLength(column.dimensions)
                : arktype.type.number.array();
        }
        else if (isColumnType(column, ['PgLine'])) {
            schema = arktype.type([arktype.type.number, arktype.type.number, arktype.type.number]);
        }
        else if (isColumnType(column, ['PgLineABC'])) {
            schema = arktype.type({
                a: arktype.type.number,
                b: arktype.type.number,
                c: arktype.type.number,
            });
        } // Handle other types
        else if (isColumnType(column, ['PgArray'])) {
            const arraySchema = columnToSchema(column.baseColumn).array();
            schema = column.size ? arraySchema.exactlyLength(column.size) : arraySchema;
        }
        else if (column.dataType === 'array') {
            schema = arktype.type.unknown.array();
        }
        else if (column.dataType === 'number') {
            schema = numberColumnToSchema(column);
        }
        else if (column.dataType === 'bigint') {
            schema = bigintColumnToSchema(column);
        }
        else if (column.dataType === 'boolean') {
            schema = arktype.type.boolean;
        }
        else if (column.dataType === 'date') {
            schema = arktype.type.Date;
        }
        else if (column.dataType === 'string') {
            schema = stringColumnToSchema(column);
        }
        else if (column.dataType === 'json') {
            schema = jsonSchema;
        }
        else if (column.dataType === 'custom') {
            schema = arktype.type.unknown;
        }
        else if (column.dataType === 'buffer') {
            schema = bufferSchema;
        }
    }
    if (!schema) {
        schema = arktype.type.unknown;
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
    return (integer ? arktype.type.keywords.number.integer : arktype.type.number).atLeast(min).atMost(max);
}
/** @internal */
const unsignedBigintNarrow = (v, ctx) => v < 0n ? ctx.mustBe('greater than') : v > CONSTANTS.INT64_UNSIGNED_MAX ? ctx.mustBe('less than') : true;
/** @internal */
const bigintNarrow = (v, ctx) => v < CONSTANTS.INT64_MIN ? ctx.mustBe('greater than') : v > CONSTANTS.INT64_MAX ? ctx.mustBe('less than') : true;
function bigintColumnToSchema(column) {
    const unsigned = column.getSQLType().includes('unsigned');
    return arktype.type.bigint.narrow(unsigned ? unsignedBigintNarrow : bigintNarrow);
}
function stringColumnToSchema(column) {
    if (isColumnType(column, ['PgUUID'])) {
        return arktype.type(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu).describe('a RFC-4122-compliant UUID');
    }
    if (isColumnType(column, ['PgBinaryVector'])) {
        return arktype.type(`/^[01]{${column.dimensions}}$/`)
            .describe(`a string containing ones or zeros while being ${column.dimensions} characters long`);
    }
    let max;
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
    return max && fixed ? arktype.type.string.exactlyLength(max) : max ? arktype.type.string.atMostLength(max) : arktype.type.string;
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
        if (refinement !== undefined
            && (typeof refinement !== 'function' || (typeof refinement === 'function' && refinement.expression !== undefined))) {
            columnSchemas[key] = refinement;
            continue;
        }
        const column = drizzleOrm.is(selected, drizzleOrm.Column) ? selected : undefined;
        const schema = column ? columnToSchema(column) : arktype.type.unknown;
        const refined = typeof refinement === 'function' ? refinement(schema) : schema;
        if (conditions.never(column)) {
            continue;
        }
        else {
            columnSchemas[key] = refined;
        }
        if (column) {
            if (conditions.nullable(column)) {
                columnSchemas[key] = columnSchemas[key].or(arktype.type.null);
            }
            if (conditions.optional(column)) {
                columnSchemas[key] = columnSchemas[key].optional();
            }
        }
    }
    return arktype.type(columnSchemas);
}
const createSelectSchema = ((entity, refine) => {
    if (isPgEnum(entity)) {
        return arktype.type.enumerated(...entity.enumValues);
    }
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, {
        never: () => false,
        optional: () => false,
        nullable: (column) => !column.notNull,
    });
});
const createInsertSchema = ((entity, refine) => {
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, {
        never: (column) => column?.generated?.type === 'always' || column?.generatedIdentity?.type === 'always',
        optional: (column) => !column.notNull || (column.notNull && column.hasDefault),
        nullable: (column) => !column.notNull,
    });
});
const createUpdateSchema = ((entity, refine) => {
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, {
        never: (column) => column?.generated?.type === 'always' || column?.generatedIdentity?.type === 'always',
        optional: () => true,
        nullable: (column) => !column.notNull,
    });
});

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
