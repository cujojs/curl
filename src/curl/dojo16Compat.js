/**
 * curl/dojo16Compat
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * Do not use this file! curl.js will work with dojo 1.6 already. I mistakenly
 * committed this file as a potential external shim so curl.js stays lightweight.
 * 
 * usage:
 *  require(['curl/dojo16Compat', 'curl/domReady'])
 *  	.next(['dojo/parser'])
 *  	.then(function (parser) {
 *  		parser.parse();
 *  	});
 *
 */
(function (global, doc) {

	// satisfy loader:
	define({});

	var
		toString = {}.toString,
		slice = [].slice,
		origDefine = global.define;

	function isArray (o) {
		return toString.call(o) == '[object Array]';
	}

	function isFunction (o) {
		return toString.call(o) == '[object Function]';
	}

	function duckPunchRequire (req) {
		req['ready'] = function (cb) {
			// reference global require
			require(['curl/domReady'], cb);
		};
		req['nameToUrl'] = function (name, ext) {
			// map non-standard nameToUrl to toUrl
			return req['toUrl'](name) + (ext || '');
		};
		return req;
	}

	global.define = function () {
		var i, depsPos, deps, d, found, origDefFunc, exports, args,
			len = arguments.length;

		// grab original definition function (always last)
		origDefFunc = arguments[len - 1];

		if (isFunction(origDefFunc)) {

			// find which argument is the dependencies
			for (i = len - 1; i >= 0; i--) {
				if (isArray(arguments[i])) {
					depsPos = i;
					deps = slice.call(arguments[i]);
					// find any refs to 'require' and replace them
					// also, find the exports param, if any
					for (d = 0; d < deps.length; d++) {
						if (deps[d] == 'require') {
							deps[d] = duckPunchRequire(deps[d]);
							found = true;
						}
						else if (deps[d] == 'exports') {
							exports = deps[d]
						}
					}
					break;
				}
			}
		}

		// replace the definition function with one that replaces the 'require' refs
		// with a modified (non-standard) require (dumb dumb dumb, dojo!)
		if (found) {
			args = slice.call(arguments);
			args[depsPos] = deps;
		}
		origDefine.apply(exports, args || arguments);

	};

}(this, document));
