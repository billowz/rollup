import { basename } from './utils/path.js';
import { writeFile } from './utils/fs.js';
import { assign, keys } from './utils/object.js';
import validateKeys from './utils/validateKeys.js';
import SOURCEMAPPING_URL from './utils/sourceMappingURL.js';
import Bundle from './Bundle.js';

export const VERSION = '<@VERSION@>';

const ALLOWED_KEYS = [
	'acorn',
	'banner',
	'cache',
	'dest',
	'entry',
	'exports',
	'external',
	'footer',
	'format',
	'globals',
	'indent',
	'intro',
	'moduleId',
	'moduleName',
	'noConflict',
	'onwarn',
	'outro',
	'plugins',
	'preferConst',
	'sourceMap',
	'sourceMapFile',
	'targets',
	'treeshake',
	'useStrict'
];

export function rollup ( options ) {
	if ( !options || !options.entry ) {
		return Promise.reject( new Error( 'You must supply options.entry to rollup' ) );
	}

	if ( options.transform || options.load || options.resolveId || options.resolveExternal ) {
		return Promise.reject( new Error( 'The `transform`, `load`, `resolveId` and `resolveExternal` options are deprecated in favour of a unified plugin API. See https://github.com/rollup/rollup/wiki/Plugins for details' ) );
	}

	const error = validateKeys( options, ALLOWED_KEYS );

	if ( error ) {
		return Promise.reject( error );
	}

	const bundle = new Bundle( options );

	return bundle.build().then( () => {
		function generate ( options ) {
			const rendered = bundle.render( options );

			bundle.plugins.forEach( plugin => {
				if ( plugin.ongenerate ) {
					plugin.ongenerate( assign({
						bundle: result
					}, options ));
				}
			});

			return rendered;
		}

		var result = {
			imports: bundle.externalModules.map( module => module.id ),
			exports: keys( bundle.entryModule.exports ),
			modules: bundle.orderedModules.map( module => module.toJSON() ),

			generate,
			write: options => {
				if ( !options || !options.dest ) {
					throw new Error( 'You must supply options.dest to bundle.write' );
				}

				const dest = options.dest;
				let { code, map } = generate( options );

				let promises = [];

				if ( options.sourceMap ) {
					let url;

					if ( options.sourceMap === 'inline' ) {
						url = map.toUrl();
					} else {
						url = `${basename( dest )}.map`;
						promises.push( writeFile( dest + '.map', map.toString() ) );
					}

					code += `\n//# ${SOURCEMAPPING_URL}=${url}`;
				}

				promises.push( writeFile( dest, code ) );
				return Promise.all( promises );
			}
		};

		return result;
	});
}
