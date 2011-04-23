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
	define(/*=='curl/dojo16Compat',==*/ {});

	var curl = global.curl || global.require;

	function duckPunchRequire (req) {
		if (!req['ready']){
			req['ready'] = function (cb) {
				// reference global require
				require(['curl/domReady'], cb);
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

	duckPunchRequire(curl['_require']);

}(this, document));
