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

	var appendLocaleRx;

	// finds the end and an optional .js extension since some devs may have
	// added it, which is legal since plugins sometimes require an extension.
	appendLocaleRx = /(\.js)?$/;

	return {
		load: function (absId, require, loaded, config) {
			var eb, toFile, locale, bundles, fetched, id, parts, specifier, i;

			eb = loaded.error;

			if (!absId) {
				eb(new Error('blank i18n bundle id.'));
			}

			// resolve config options
			toFile = config['localeToModuleId'] || localeToModuleId;
			locale = config['locale'] || getLocale;
			if (typeof locale == 'function') locale = locale(absId);

			// keep track of what bundles we've found
			bundles = [];
			fetched = 0;

			// determine all the variations / specificities we might find
			parts = locale.split('-');
			specifier = '';

			for (i = 0; i < parts.length; i++) {
				// create bundle id
				id = toFile(absId, specifier);
				// fetch and save found bundles, while silently skipping
				// missing ones
				fetch(require, id, i, got, countdown);
				// generate next specifier
				specifier += (i ? '-' : '') + parts[i];
			}

			function got (bundle, i) {
				bundles[i] = bundle;
				countdown();
			}

			function countdown () {
				var base;
				if (++fetched == parts.length) {
					if (bundles.length == 0) {
						eb(new Error('No i18n bundles found: "' + absId + '", locale "' + locale + '"'));
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

	function mixin (base, props) {
		if (props) {
			for (var p in props) {
				base[p] = props[p];
			}
		}
		return base;
	}

	function getLocale () {
		var ci = global['clientInformation'] || global.navigator;
		return ci.language || ci['userLanguage'];
	}

	function localeToModuleId (absId, locale) {
		return absId.replace(appendLocaleRx, locale ? '/' + locale  : '');
	}

});

}(this));
