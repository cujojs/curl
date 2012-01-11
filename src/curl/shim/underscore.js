/**
 * curl underscore shim
 *
 * (c) copyright 2010-2012 Brian Cavalier and John Hann
 *
 * curl is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */
define(/*==='curl/shim/underscore',===*/ ['curl/_privileged'], function (priv) {
"use strict";

	var core, _define;

	core = priv['core'];
	_define = core['_define'];

	// underscore exports its exports before it defines its properties/methods.
	// override _define and defer the resolution of underscore a bit so it
	// can finish.
	core['_define'] = function (args) {
		if (args.id == 'underscore') {
			soon(function () {
				_define(args);
			});
		}
		else {
			_define(args);
		}
	};

	function soon (callback) {
		// TODO: setImmediate and postMessage/MessageChannel
		setTimeout(callback, 0);
	}

});
