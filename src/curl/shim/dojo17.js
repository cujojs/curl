/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl dojo 1.7 shim
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

/**
 * dojo 1.7 does some unique things with its loader.  This shim helps handle
 * those things.
 *
 * usage:
 *  curl({
 *  	preload: ['curl/shim/dojo17'],
 * 		package: { ... }
 *  }, ['dojo/parser'], function (parser) {
 *  	parser.parse();
 *  });
 *
 */
define(/*=='curl/shim/dojo17',==*/ ['curl/_privileged', './dojo16'], function (priv) {
"use strict";

	// TODO: copy subset of dojo 1.6 overrides?
	// just use dojo 1.6 overrides for now

	return true;

});
