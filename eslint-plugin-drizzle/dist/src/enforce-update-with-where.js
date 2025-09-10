"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@typescript-eslint/utils");
const ast_1 = require("./utils/ast");
const options_1 = require("./utils/options");
const createRule = utils_1.ESLintUtils.RuleCreator(() => 'https://github.com/drizzle-team/eslint-plugin-drizzle');
let lastNodeName = '';
const updateRule = createRule({
    defaultOptions: [{ drizzleObjectName: [] }],
    name: 'enforce-update-with-where',
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce that `update` method is used with `where` to avoid deleting all the rows in a table.',
        },
        fixable: 'code',
        messages: {
            enforceUpdateWithWhere: "Without `.where(...)` you will update all the rows in a table. If you didn't want to do it, please use `{{ drizzleObjName }}.update(...).set(...).where(...)` instead. Otherwise you can ignore this rule here",
        },
        schema: [{
                type: 'object',
                properties: {
                    drizzleObjectName: {
                        type: ['string', 'array'],
                    },
                },
                additionalProperties: false,
            }],
    },
    create(context, options) {
        return {
            MemberExpression: (node) => {
                if (node.property.type === 'Identifier') {
                    if (lastNodeName !== 'where'
                        && node.property.name === 'set'
                        && node.object.type === 'CallExpression'
                        && node.object.callee.type === 'MemberExpression'
                        && node.object.callee.property.type === 'Identifier'
                        && node.object.callee.property.name === 'update'
                        && (0, options_1.isDrizzleObj)(node.object.callee, options)) {
                        context.report({
                            node,
                            messageId: 'enforceUpdateWithWhere',
                            data: {
                                drizzleObjName: (0, ast_1.resolveMemberExpressionPath)(node.object.callee),
                            },
                        });
                    }
                    lastNodeName = node.property.name;
                }
                return;
            },
        };
    },
});
exports.default = updateRule;
