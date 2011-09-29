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
(function (global) {

define(['require', 'curl/_privileged'], function (require, priv) {

	var cache, totalWaiting, prevTotal, resolveResDef;

	if (typeof console == 'undefined') {
		throw new Error('`console` object must be defined to use debug module.');
	}

	priv._curl.['undefine'] = function (moduleId) { delete cache[moduleId]; };

	cache = priv.cache;

	// add logging to core functions
	// TODO: add more core functions
	resolveResDef = priv.core.resolveResDef;
	priv.core.resolveResDef = function () {
		console.log('curl: resolving', def.name);
		resolveResDef.apply(this, arguments);
	};

	// log cache stats periodically
	totalWaiting = 0;

	function count () {
		totalWaiting = 0;
		for (var p in cache) {
			if ('resolved' in cache[p]) totalWaiting++;
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



});

}(this));
