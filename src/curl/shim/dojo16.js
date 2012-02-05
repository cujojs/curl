/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl dojo 1.6 shim
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

/**
 * Until AMD becomes well established, there will be issues with the various
 * libs.  This one overcomes some minor issues with dojo 1.6's initial
 * foray into AMD territory. :)
 *
 * usage:
 *  curl(['curl/shim/dojo16', 'curl/domReady'])
 *  	.next(['dojo/parser'])
 *  	.then(function (parser) {
 *  		parser.parse();
 *  	});
 *
 */
define(/*=='curl/shim/dojo16',==*/ ['curl/_privileged', 'curl/domReady'], function (priv, domReady) {
"use strict";

	var _curl = priv['_curl'],
		origExecuteDefFunc = priv['core'].executeDefFunc;

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

	// modify global curl cuz dojo doesn't always use local `require`
	// as a dependency
	duckPunchRequire(_curl);

	// override executeDefFunc to override "require" deps
	priv['core'].executeDefFunc = function (def) {
		duckPunchRequire(def.require);
		return origExecuteDefFunc(def);
	};

	return true;

});
