"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@typescript-eslint/utils");
const ast_1 = require("./utils/ast");
const options_1 = require("./utils/options");
const createRule = utils_1.ESLintUtils.RuleCreator(() => 'https://github.com/drizzle-team/eslint-plugin-drizzle');
let lastNodeName = '';
const deleteRule = createRule({
    defaultOptions: [{ drizzleObjectName: [] }],
    name: 'enforce-delete-with-where',
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce that `delete` method is used with `where` to avoid deleting all the rows in a table.',
        },
        fixable: 'code',
        messages: {
            enforceDeleteWithWhere: "Without `.where(...)` you will delete all the rows in a table. If you didn't want to do it, please use `{{ drizzleObjName }}.delete(...).where(...)` instead. Otherwise you can ignore this rule here",
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
                    if (node.property.name === 'delete' && lastNodeName !== 'where' && (0, options_1.isDrizzleObj)(node, options)) {
                        context.report({
                            node,
                            messageId: 'enforceDeleteWithWhere',
                            data: {
                                drizzleObjName: (0, ast_1.resolveMemberExpressionPath)(node),
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
exports.default = deleteRule;
