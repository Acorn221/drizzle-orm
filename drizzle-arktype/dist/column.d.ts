import { type Type } from 'arktype';
import type { Column } from 'drizzle-orm';
export declare const literalSchema: import("arktype").BaseType<string | number | boolean | null, {}>;
export declare const jsonSchema: import("arktype").BaseType<string | number | boolean | any[] | Record<string, any> | null, {}>;
export declare const bufferSchema: import("arktype/internal/methods/object.ts").ObjectType<Buffer, {}>;
export declare function columnToSchema(column: Column): Type;
