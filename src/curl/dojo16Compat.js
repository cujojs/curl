/**
 * curl/dojo16Compat
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * Until AMD becomes well established, there will be issues with the various
 * libs.  This one overcomes some minor issues with dojo 1.6's initial
 * foray into AMD territory. :)
 *
 * usage:
 *  curl(['curl/dojo16Compat', 'curl/domReady'])
 *  	.next(['dojo/parser'])
 *  	.then(function (parser) {
 *  		parser.parse();
 *  	});
 *
 */
(function (global) {

	// satisfy loader:
	define(/*=='curl/dojo16Compat',==*/ ['curl', './domReady'], function (curl, domReady) {

		// TODO: capture define.amd
		var _define = global['define'],
			amd = _define.amd
			define;

		function duckPunchRequire (req) {
			if (!req['ready']){
				req['ready'] = function (cb) {
					domReady(cb);
				};
			}
			if (!req['nameToUrl']) {
				req['nameToUrl'] = function (name, ext) {
					// map non-standard nameToUrl to toUrl
					return req['toUrl'](name + (ext || ''));
				};
			}
			return req;
		}

		// modify global curl cuz dojo doesn't always use standard `require`
		// as a dependency
		duckPunchRequire(curl);

		define = global['define'] = function () {
			var args, len, names, reqPos = [], defFunc, i, needsDomReady;
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
//					needsDomReady = needsDomReady || names[i] == 'dojo/_base/html';
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
				// if we need to fix dojo's domReady bugs
//				if (needsDomReady) {
//					names.push('domReady!');
//				}
			}
			return _define.apply(null, args);
		};
		define.amd = amd;

		return true;

	});

}(this));
