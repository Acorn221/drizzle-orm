"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDrizzleObj = void 0;
const isDrizzleObjName = (name, drizzleObjectName) => {
    if (typeof drizzleObjectName === 'string') {
        return name === drizzleObjectName;
    }
    if (Array.isArray(drizzleObjectName)) {
        if (drizzleObjectName.length === 0) {
            return true;
        }
        return drizzleObjectName.includes(name);
    }
    return false;
};
const isDrizzleObj = (node, options) => {
    const drizzleObjectName = options[0].drizzleObjectName;
    if (node.object.type === 'Identifier') {
        return isDrizzleObjName(node.object.name, drizzleObjectName);
    }
    else if (node.object.type === 'MemberExpression' && node.object.property.type === 'Identifier') {
        return isDrizzleObjName(node.object.property.name, drizzleObjectName);
    }
    else if (node.object.type === 'CallExpression') {
        if (node.object.callee.type === 'Identifier') {
            return isDrizzleObjName(node.object.callee.name, drizzleObjectName);
        }
        else if (node.object.callee.type === 'MemberExpression' && node.object.callee.property.type === 'Identifier') {
            return isDrizzleObjName(node.object.callee.property.name, drizzleObjectName);
        }
    }
    return false;
};
exports.isDrizzleObj = isDrizzleObj;
