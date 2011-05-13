/**
 * curl domReady loader plugin
 *
 * (c) copyright 2011, unscriptable.com
 *
 * allows the curl/domReady module to be used like a plugin
 * this is for better compatibility with other loaders.
 *
 * Usage:
 *
 * curl(["domReady!"]).then(doSomething);
 *
 */

define(/*=='domReady',==*/ ['require'], function (require) {

	return {

		'load': function (name, req, cb, cfg) {
			require(['curl/domReady'], cb);
		}

	};

});
