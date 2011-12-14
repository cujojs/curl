/**
 * curl i18n plugin
 *
 * (c) copyright 2011, unscriptable.com
 *
 */

(function (global) {

define(/*=='i18n',==*/ function () {

	function getLocale () {
		return (global.clientInformation || global.navigator).language;
	}

	return {
		load: function (absId, require, loaded, config) {
			var locale = config.locale || getLocale();
		}
	};

});

}());
