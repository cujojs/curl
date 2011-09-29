/**
 * curl/jQuery17Compat
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * Until AMD becomes well established, there will be issues with the various
 * libs.  This one overcomes some minor issues with jQuery 1.7's initial
 * foray into AMD territory. :)
 *
 * usage:
 *  curl(['curl/jQuery17Compat', 'curl/domReady'], function (domReady) {
 *  	domReady();
 *  });
 *
 */
define(/*=='curl/jQuery17Compat',==*/ ['curl/_privileged'], function (priv) {
	var _define = priv.core._define,
		// TODO: cache all jQuery versions and allow packages to specify which one they want
		jqs = {};

	// duck-punch _define
	priv.core._define = function (id, deps, func) {
		if ("jquery" == id && arguments.length > 1) {
			// TODO: cache this version of jQuery
			// var jq = func();
			// jqs[jq.fn.jquery] = jq;
		}
		// don't return id so that module can be moved!
		return _define(deps, func);
	};

	return true;
});

// add flag to let jQuery know we care
define.amd.jQuery = {};
