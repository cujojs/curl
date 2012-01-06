define(/*==='curl/underscoreCompat',===*/ ['curl/_privileged'], function (priv) {
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
