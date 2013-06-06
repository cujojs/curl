/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl json! plugin
 *
 * Like the text! plugin, will only load same-domain resources.
 */

(function (globalEval) {
define(/*=='curl/plugin/json',==*/ ['./_fetchText'], function (fetchText) {

	var hasJsonParse, missingJsonMsg;

	hasJsonParse = typeof JSON != 'undefined' && JSON.parse;
	missingJsonMsg = 'Cannot use strictJSONParse without JSON.parse';

	return {

		load: function (absId, require, loaded, config) {
			var evaluator, errback;

			errback = loaded['error'] || error;

			if (config.strictJSONParse) {
				if (!hasJsonParse) error(new Error(missingJsonMsg));
				evaluator = parseSource;
			}
			else {
				evaluator = evalSource;
			}

			// get the text, then eval it
			fetchText(require['toUrl'](absId), evaluator, errback);

			function evalSource (source) {
				try {
					loaded(globalEval('(' + source + ')'));
				}
				catch (ex) {
					errback(ex);
				}
			}

			function parseSource (source) {
				return JSON.parse(source);
			}

		},

		'cramPlugin': '../cram/json'

	};

});
}(
	function () {/*jshint evil:true*/ return (1,eval)(arguments[0]); }
));
