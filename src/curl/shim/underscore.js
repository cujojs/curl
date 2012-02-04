/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl underscore shim
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */
define(/*=='curl/shim/underscore',==*/ ['curl/_privileged'], function (priv) {
"use strict";

	var core, resolveResDef;

	core = priv['core'];
	resolveResDef = core['resolveResDef'];

	// underscore exports its exports before it defines its properties/methods.
	// override resolveResDef and defer the resolution of underscore a bit so it
	// can finish.
	core['resolveResDef'] = function (def, args) {
		if (def.id == 'underscore') {
			setTimeout(function () { resolveResDef(def, args); }, 0);
		}
		else {
			resolveResDef(def, args);
		}
	};

});
