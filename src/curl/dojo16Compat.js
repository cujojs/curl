/**
 * curl domReady
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * usage:
 *  curl(['dojo16Compat'], function () {
 * 	});
 *
 */
(function (global, doc) {

	var
		toString = {}.toString,
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
			return toUrl(name) + (ext || '');
		};
		return req;
	}

	global.define = function () {
		var i, depsPos, deps, d, requires, origDefFunc,
			len = arguments.length;

		// grab original definition function
		origDefFunc = arguments[len - 1];

		if (isFunction(origDefFunc)) {

			// find dependencies in arguments
			for (i = len - 1; i >= 0; i--) {
				if (isArray(arguments[i])) {
					depsPos = i;
					deps = arguments[i];
					// find any refs to 'require'
					for (d = 0; d < deps.length; d++) {
						if (deps[d] == 'require') {
							requires.push(d);
						}
					}
					break;
				}
			}
		}

		if (requires.length > 0) {
			// replace the definition function with one that replaces the 'require' refs
			// with a modified (non-standard) require (dumb dumb dumb)

		}

	};

	// satisfy loader:
	define({});

}(this, document));