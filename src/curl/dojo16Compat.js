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
(function (global) {

	// satisfy loader:
	define(/*=='curl/dojo16Compat',==*/ function () {

		// TODO: figure out a better way to grab global curl
		// we should probably just add "curl" as a dependency (???)
		var curl = global['curl'] || global['require'],
			define = global['define'];

		function duckPunchRequire (req) {
			if (!req['ready']){
				req['ready'] = function (cb) {
					curl(['domReady!'], cb);
				};
			}
			if (!req['nameToUrl']) {
				req['nameToUrl'] = function (name, ext) {
					// map non-standard nameToUrl to toUrl
					return req['toUrl'](name) + (ext || '');
				};
			}
			return req;
		}

		// modify global curl
		duckPunchRequire(curl);

		global['define'] = function () {
			var args, len, names, reqPos = [], defFunc, i;
			// find dependency array
			args = [].slice.call(arguments);
			len = args.length;
			names = args[len - 2];
			defFunc = typeof args[len - 1] == 'function' ? args[len - 1] : null;
			// if we have dependencies and a definition function
			if (names && defFunc) {
				// find all "require" dependencies
				for (i = names.length - 1; i >= 0; i--) {
					if (names[i] == 'require') {
						reqPos.push(i);
					}
				}
				// if there are any
				if (reqPos.length > 0) {
					// replace the definition function with one that replaces
					// the "require" deps with duck-punched ones
					args[len - 1] = function () {
						var deps = [].slice.call(arguments);
						for (i = 0; i < reqPos.length; i++) {
							deps[reqPos[i]] = duckPunchRequire(deps[reqPos[i]]);
						}
						return defFunc.apply(this, deps);
					};
				}
			}
			return define.apply(null, args);
		};

		return true;

	});

}(this));
