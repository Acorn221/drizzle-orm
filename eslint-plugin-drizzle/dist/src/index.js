"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.meta = exports.configs = exports.rules = void 0;
const package_json_1 = require("../package.json");
const all_1 = __importDefault(require("./configs/all"));
const recommended_1 = __importDefault(require("./configs/recommended"));
const enforce_delete_with_where_1 = __importDefault(require("./enforce-delete-with-where"));
const enforce_update_with_where_1 = __importDefault(require("./enforce-update-with-where"));
exports.rules = {
    'enforce-delete-with-where': enforce_delete_with_where_1.default,
    'enforce-update-with-where': enforce_update_with_where_1.default,
};
exports.configs = { all: all_1.default, recommended: recommended_1.default };
exports.meta = { name: package_json_1.name, version: package_json_1.version };
