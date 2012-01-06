define(/*==='curl/deferDefine',===*/ ['curl/_privileged'], function (priv) {
"use strict";

	var core, orig, undef;

	core = priv['core'];
	orig = core.resolveResDef;

	// override resolveResDef and defer the resolution of the module
	core.resolveResDef = function (def, args) {
		var origResolve;

		origResolve = def.resolve;

		def.resolve = function (val) {
			soon(function () {
				origResolve.call(undef, val);
			});
		};

		return orig(def, args);
	};

	function soon (callback) {
		// TODO: setImmediate and postMessage/MessageChannel
		setTimeout(callback, 0);
	}

});
