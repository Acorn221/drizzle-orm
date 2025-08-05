import { entityKind } from '~/entity.ts';
import { type SingleStoreTableFn, singlestoreTableWithSchema } from './table.ts';
/* import { type singlestoreView, singlestoreViewWithSchema } from './view.ts'; */

export class SingleStoreSchema<TName extends string = string> {
	static readonly [entityKind]: string = 'SingleStoreSchema';

	constructor(
		public readonly schemaName: TName,
	) {}

	table: SingleStoreTableFn<TName> = (name, columns, extraConfig) => {
		return singlestoreTableWithSchema(name, columns, extraConfig, this.schemaName);
	};

	/* view: SingleStoreViewFn<TName> = (name, columns, view) => {
		return singlestoreViewWithSchema(name, columns, view, this.schemaName);
	}; */
}

export function singlestoreDatabase<TName extends string>(name: TName): SingleStoreSchema<TName> {
	return new SingleStoreSchema(name);
}
