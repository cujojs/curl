/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl i18n! builder plugin
 */
define(['../i18n'], function (i18n) {

	var toString, passThrus, converts, remove$QuotesRx;

	toString = Object.prototype.toString;
	passThrus = {
		Array: 1, Boolean: 1, Null: 1, Number: 1, Object: 1, String: 1, Undefined: 1
	};
	converts = {
		Date: 1, Function: 1, RegExp: 1
	};
	remove$QuotesRx = /"\$|\$"/g;

	return {

		compile: function (absId, req, io, config) {
			var loaded;

			// use the load method of the run-time plugin, snooping in on
			// requests.
			loaded = function (bundle) {
				var str;
				// convert to JSON with most Javascript objects preserved
				str = JSON.stringify(bundle, replacer, ' ');
				// remove specially-marked quotes
				str = str.replace(remove$QuotesRx, '');
				io.write(str);
			};
			loaded.error = io.error;
			i18n.load(absId, req, loaded, config);

			function replacer (key, value) { return asString(key, value, io.warn); }
		}
	};

	function asString (key, thing, warn) {
		var t;
		t = type(thing);
		if (t in passThrus) return thing;
		else if (t in converts) return '$' + thing.toString() + '$';
		else warn('Property "' + key + '" of type, ' + t + ', not supported in i18n bundle.');
	}

	function type (thing) {
		return toString.call(thing).slice(8, -1);
	}

});
