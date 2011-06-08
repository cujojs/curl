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

define(function (require) {

	var curl = require['_curl'],
		cache = require['_cache'],
		listen = curl['_listen'],
		apiName = curl['_cfg']['apiName'] || 'curl',
		totalWaiting = 0,
		prevTotal;

	if (!curl || !listen) {
		throw new Error('You must also enable debugging via the debug:true config param.');
	}
	else if (typeof console == 'undefined') {
		throw new Error('No console to output debug info.');
	}
	else {

		function count () {
			totalWaiting = 0;
			for (var p in cache) {
				if (cache[p].resolved) totalWaiting++;
			}
		}
		count();

		listen('_define', function () {
			var args = [].slice.apply(arguments).join(', ');
			console.log('curl: define(' + args + ');');
		});

		listen('_require', function () {
			var args = [].slice.apply(arguments).join(', ');
			console.log('curl: require(' + args + ');');
		});

		listen('_curl', function () {
			var args = [].slice.apply(arguments).join(', ');
			console.log('curl: ' + apiName + '(' + args + ');');
		});

		function periodicLogger () {
			count();
			if (prevTotal != totalWaiting) {
				console.log('curl: modules waiting: ' + totalWaiting);
			}
			prevTotal = totalWaiting;
			setTimeout(periodicLogger, 500);
		}
		periodicLogger();

	}

});

}(this));
