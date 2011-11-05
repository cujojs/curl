/**
 * curl debug plugin
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * usage:
 *  curl({ debug: true }, ['curl/debug']).next(['other/modules'], function (otherModules) {
 * 		// do stuff while logging debug messages
 * 	});
 *
 * The debug module must be used in conjunction with the debug: true config param!
 *
 */
(function (global, origDefine) {

define(['require', 'curl/_privileged'], function (require, priv) {
"use strict";

	var cache, totalWaiting, prevTotal;

	if (typeof console == 'undefined') {
		throw new Error('`console` object must be defined to use debug module.');
	}

	priv._curl['undefine'] = function (moduleId) { delete cache[moduleId]; };

	cache = priv['cache'];

	// add logging to core functions
	for (var p in priv['core']) (function (name, orig) {
		priv['core'][name] = function () {
			var result;
			console.log('curl ' + name + ' arguments:', arguments);
			result = orig.apply(this, arguments);
			console.log('curl ' + name + ' return:', result);
			return result;
		};
	}(p, priv['core'][p]));

	// add logging to define
	global.define = function () {
		console.log('curl define:', arguments);
		return origDefine.apply(this, arguments);
	};

	// log cache stats periodically
	totalWaiting = 0;

	function count () {
		totalWaiting = 0;
		for (var p in cache) {
			if (cache[p] instanceof priv['ResourceDef']) totalWaiting++;
		}
	}
	count();

	function periodicLogger () {
		count();
		if (prevTotal != totalWaiting) {
			console.log('curl: ********** modules waiting: ' + totalWaiting);
		}
		prevTotal = totalWaiting;
		setTimeout(periodicLogger, 500);
	}
	periodicLogger();

	return true;

});

}(this, this.define));
