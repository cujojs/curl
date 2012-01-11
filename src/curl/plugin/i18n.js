/**
 * curl i18n plugin
 *
 * (c) copyright 2010-2012 Brian Cavalier and John Hann
 *
 * curl is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
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
