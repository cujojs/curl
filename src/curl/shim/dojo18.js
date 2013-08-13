/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl dojo 1.8 and 1.9 shim
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

/**
 * This shim overcomes some issues with dojo 1.8 and 1.9 local require().
 *
 * usage:
 * curl.config({
 *     // <packages, etc. go here>
 *
 *     // load this shim as a preload
 *     preloads: ['curl/shim/dojo18']
 * });
 */
var require;
(function (global, doc){
define(/*=='curl/shim/dojo18',==*/ ['curl/_privileged'], function (priv) {
"use strict";

	var _curl = priv['_curl'],
		moduleCache = priv['cache'],
		Promise = priv['Promise'],
		origCreateContext = priv['core'].createContext;

	var hasCache = {},
		element = doc && doc.createElement('div'),
		has = _has;

	has.add = _add;

	// ugh. dojo 1.9 still expects a global `require`!
	// so make sure it's got one.
	duckPunchRequire(_curl);
	if (typeof require == 'undefined') {
		require = _curl;
	}

	// override createContext to override "local require"
	priv['core'].createContext = function () {
		var def = origCreateContext.apply(this, arguments);
		duckPunchRequire(def.require);
		return def;
	};

	return true;

	function _has (name) {
		// dojo-ish has implementation
		typeof hasCache[name] == 'function'
			? (hasCache[name] = hasCache[name](global, doc, element))
			: hasCache[name];
	}

	function _add (name, test, now, force) {
		if (hasCache[name] === undefined || force) {
			hasCache[name] = test;
		}
		if (now) {
			return has(name);
		}
	}

	function duckPunchRequire (req) {
		// create a functioning has()
		if (!req['has']) {
			req['has'] = has;
		}
		// create a stub for on()
		if (!req['on']) {
			req['on'] = function () {};
		}
		// create an idle()
		if (!req['idle']) {
			req['idle'] = idle;
		}
		return req;
	}

	function idle () {
		// looks for unresolved defs in the cache
		for (var id in moduleCache) {
			if (moduleCache[id] instanceof Promise) return false;
		}
		return true;
	}

});
}(
	typeof global == 'object' ? global : this.window || this.global,
	typeof document == 'object' && document
));
