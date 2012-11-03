/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl i18n plugin
 *
 * First, fetch default string bundle.
 *
 * If the default bundle has locale information in it, use that to define
 * locale-specific values or to fetch locale-specific files at the specified
 * location.
 *
 * If default bundle does not have local information in it, start scanning
 * for progressively specific files using a default naming scheme,
 * e.g. strings.js, strings/en.js, strings/en_US.js, etc.
 *
 * Browsers follow the language specifiers in the Language-Tags feature of
 * RFC 5646: http://tools.ietf.org/html/rfc5646
 *
 * Configuration options:
 *
 * locale {String|Function} the RFC 5646-compatible language specifier or
 *   a function that returns a language specifier.  The module id is passed
 *   as the only parameter to this function.  If this option is omitted,
 *   the browser's locale is sniffed and used.
 *
 * localeToModuleId {Function} a function that translates a locale string to a
 *   module id where an AMD-formatted string bundle may be found.  The default
 *   format is a module whose name is the locale located under the default
 *   (non-locale-specific) bundle.  For example, if the default bundle is
 *   "myview/strings.js", the en-us version will be "myview/strings/en-us.js".
 *   Parameters: moduleId {String}, locale {String}, returns {String}
 *
 */

(function (global) {

define(/*=='curl/plugin/i18n',==*/ function () {

	return {
		load: function (absId, require, loaded, config) {
			var locale, toFile, ids, bundles, fetched, i;

			locale = config.locale || getLocale;
			if (typeof locale == 'function') locale = locale(absId);

			toFile = config.localeToModuleId || localeToModuleId;

			ids = localeToModuleIds(absId, locale, toFile);

			bundles = [];

			fetched = 0;

			for (i = 0; i < ids.length; i++) {
				// save found bundles, just silently skip missing ones
				fetch(require, ids[i], i, got, countdown);
			}

			function got (bundle, i) {
				bundles[i] = bundle;
				countdown();
			}

			function countdown () {
				var base, bundle;
				if (++fetched == ids.length) {
					if (bundles.length == 0) {
						loaded.error(new Error('No bundles found for ' + absId + ' and locale ' + locale));
					}
					else {
						base = {};
						for (i = 0; i < bundles.length; i++) {
							base = mixin(base, bundles[i]);
						}
						loaded(base);
					}
				}
			}

		}
	};

	function fetch (require, id, i, cb, eb) {
		require([id], function (bundle) { cb(bundle, i); }, eb);
	}

	function localeToModuleIds (absId, locale, formatter) {
		var parts, specifier, ids, part;
		parts = locale.split(/-|_/);
		specifier = '';
		ids = [formatter(absId, '')];
		while ((part = parts.shift())) {
			specifier += part;
			ids.push(formatter(absId, specifier));
		}
		return ids;
	}

	function mixin (base, props) {
		if (props) {
			for (var p in props) {
				base[p] = props[p];
			}
		}
		return base;
	}

	function getLocale () {
		var ci = global.clientInformation || global.navigator;
		return ci.language || ci.userLanguage;
	}

	function localeToModuleId (absId, locale) {
		// TODO: is this regex robust enough?
		return absId.replace(/$|\.js/, locale ? '/' + locale  : '');
	}

});

}(this));
