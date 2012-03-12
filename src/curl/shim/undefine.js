/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl undefine module
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

/**
 * Adds `undefine` functionality to curl.  This is useful in testing
 * environments in which mocks and stubs can have different functionality,
 * but the same name.
 *
 * usage:
 *  curl({ preload: ['curl/shim/undefine'] }, function () {
 * 		// define a mock here
 * 		define('mock1', function (mock1) { blah });
 * 		// use mock1 here...
 *
 * 		// undefine mock1
 * 		curl.undefine('mock1');
 * 		// redefine mock1
 * 		define('module1', function (module1) { blah });
 * 		// use mock1 here...
 *
 * 		// undefine mock1
 * 		curl.undefine('mock1');
 * 		// etc.
 * 	});
 *
 * The undefine call takes one parameter which could be
 * 	true: remove all modules
 * 	string: remove the module of the given id
 * 	array: remove all of the modules of the given ids
 *
 */
define(['require', 'curl/_privileged'], function (require, priv) {
"use strict";

	var cache;

	cache = priv['cache'];

	priv._curl['undefine'] = function (which) {
		var modules, i;
		if (which === true) {
			// list everything except curl essentials
			modules = [];
			for (i in cache) {
				if (i != 'curl' && i != 'curl/_privileged') {
					modules.push(i);
				}
			}
		}
		else {
			// remove the modules requested
			modules = [].concat(which); // force string to array
		}
		for (i = 0; i < modules.length; i++) {
			delete cache[modules[i]];
		}
	};

});
