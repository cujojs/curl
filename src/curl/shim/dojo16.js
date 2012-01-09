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
 *  curl(['curl/shim/dojo16', 'curl/domReady'])
 *  	.next(['dojo/parser'])
 *  	.then(function (parser) {
 *  		parser.parse();
 *  	});
 *
 */
define(/*=='curl/shim/dojo16',==*/ ['curl/_privileged', 'curl/domReady'], function (priv, domReady) {
"use strict";

	var _curl = priv._curl,
		origBegetCtx = priv['core'].begetCtx;

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
	duckPunchRequire(_curl);

	// override begetCtx
	priv['core'].begetCtx = function (absId, cfg) {
		var ctx = origBegetCtx(absId, cfg);
		ctx.require = duckPunchRequire(ctx.require);
		return ctx;
	};

	return true;

});
