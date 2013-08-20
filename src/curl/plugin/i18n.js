/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl i18n plugin
 *
 * Fetch the user's locale-specific i18n bundle (e.g. strings/en-us.js"),
 * any less-specific versions (e.g. "strings/en.js"), and a default i18n bundle
 * (e.g. "strings.js").  All of these files are optional, but at least one
 * is required or an error is propagated.
 *
 * If no locale-specific versions are found, use a default i18n bundle, if any.
 *
 * If multiple locale-specific versions are found, merge them such that
 * the more specific versions override properties in the less specific.
 *
 * Browsers follow the language specifiers in the Language-Tags feature of
 * RFC 5646: http://tools.ietf.org/html/rfc5646
 *
 * Example locales: "en", "en-US", "en-GB", "fr-FR", "kr", "cn", "cn-"
 *
 * These are lower-cased before being transformed into module ids.  This
 * plugin uses a simple algorithm to formulate file names from locales.
 * It's probably easier to show an example than to describe it.  Take a
 * look at the examples section for more information.  The algorithm may
 * also be overridden via the localToModuleId configuration option.
 *
 * Nomenclature (to clarify usages of "bundle" herein):
 *
 * i18n bundle: A collection of javascript variables in the form of a JSON or
 *   javascript object and exported via an AMD define (or CommonJS exports
 *   if you are using the cjsm11 shim).  These are typically strings, but
 *   can be just about anything language-specific or location-specific.
 *
 * AMD bundle: A concatenated set of AMD modules (or AMD-wrapped CommonJS
 *   modules) that can be loaded more efficiently than individual modules.
 *
 * Configuration options:
 *
 * locale {Boolean|String|Function} (default === true)
 *   If an explicit true value is provided, the plugin will sniff the
 *   browser's clientInformation.language property (or fallback equivalent)
 *   to determine the locale and seek a locale-specific i18n bundle.  If the
 *   bundle is not already loaded, it will be fetched, potentially in many
 *   parts -- one part for each dash-delimited term in the locale.
 *
 *   If an explicit false value is provided, the plugin will sniff the
 *   browser's locale but will only seek the default bundle if the correct
 *   bundle isn't already loaded.  This is a great option for early
 *   development and when you don't want this plugin to attempt to fetch
 *   (possibly unsupported) locales automatically in production.
 *
 *   If this is a string, it is assumed to be an RFC 5646-compatible language
 *   specifier(s).  The plugin will seek the i18n bundles for this locale.
 *   This is an excellent option to test specific locales or to override
 *   the browser's locale.
 *
 *   This option may also be a function that returns a language specifier
 *   string or boolean. The absolute module id and a language specifier
 *   are passed as the parameters to this function.
 *
 *   Note: contrary to our advice for most other plugin options, locale
 *   should be specified at the package level or at the top level of the
 *   configuration.  Specifying it at the plugin level won't work when
 *   loading code in a bundle since the i18n plugin is not used in a bundle.
 *   The locale! plugin is used, instead.  For instance, the following
 *   configuration for the i18n plugin will not be visible to anything in a
 *   bundle:
 *
 *   curl.config({ plugins: { i18n: { locale: false } } });
 *
 *   Use one of these configuration strategies, instead:
 *
 *   // locale is configured for the "myApp" package
 *   curl.config({
 *     packages: {
 *       myApp: { location: 'myapp', config: { locale: false } }
 *     }
 *   });
 *
 *   // locale is configured for all packages
 *   curl.config({ locale: false });
 *
 *   // locale is specified for both plugins
 *   curl.config({
 *     plugins: {
 *       i18n: { locale: false },
 *       locale: { locale: false }
 *     }
 *   });
 *
 * localeToModuleId {Function} a function that translates a locale string to a
 *   module id where an AMD-formatted string bundle may be found.  The default
 *   format is a module whose name is the locale located under the default
 *   (non-locale-specific) bundle.  For example, if the default bundle is
 *   "myview/strings.js", the en-us version will be "myview/strings/en-us.js".
 *   Parameters: moduleId {String}, locale {String}, returns {String}
 *
 * locales {Array} a build-time-only option that specifies an array of
 *   language specifier strings.  These i18n bundles will be built into the
 *   AMD bundle as locale bundles.
 *
 * During a build, locale-specific i18n bundles are merged into a single
 * bundle and prefixed with the locale! plugin id. This allows the lightweight
 * locale! plugin to be used in the build, rather than the larger i18n! plugin.
 * The locale! plugin takes the same run-time configuration options as the
 * i18n! plugin and will exhibit nearly identical behavior.
 * For instance, if you specify the locales for "en" and "en-us" for a module,
 * "foo", two separate i18n bundles, "locale!foo/en" and "locale!foo/en-us"
 * will be included in the AMD bundle.
 *
 * @example
 *
 * `var strings = require("i18n!myapp/myview/strings");`
 *
 * If the current user's locale is "en-US", this plugin will simultaneously
 * seek the following modules unless "i18n!myapp/myview/strings" is already
 * loaded:
 *   * "myapp/myview/strings.js"
 *   * "myapp/myview/strings/en.js"
 *   * "myapp/myview/strings/en-us.js"
 *
 * If none are found, an error is propagated.  If neither "en" or "en-us"
 * is found, "strings" (the default bundle) is used.  If only "en" or "en-us"
 * is found, it is used. If both are found, "en-us" is used to override "en"
 * and the merged result is used.
 *
 */

define(/*=='curl/plugin/i18n',==*/ ['./locale'], function (getLocale) {

	return {

		load: function (resId, require, loaded, config) {
			var eb, toId, locale, bundles, fetched, id, ids, specifiers, i;

			eb = loaded.error;

			if (!resId) {
				eb(new Error('blank i18n bundle id.'));
			}

			// resolve config options
			toId = config['localeToModuleId'] || getLocale.toModuleId;
			locale = getLocale(config, resId);

			// keep track of what bundles we've found
			ids = [resId];
			bundles = [];
			fetched = 0;

			if (locale) {
				// get variations / specificities

				// determine all the variations / specificities we might find
				ids = ids.concat(locale.toLowerCase().split('-'));
				specifiers = [];

				// correct. start loop at 1! default bundle was already fetched
				for (i = 1; i < ids.length; i++) {
					// add next part to specifiers
					specifiers[i - 1] = ids[i];
					// create bundle id
					id = toId(resId, specifiers.join('-'));
					// fetch and save found bundles, while silently skipping
					// missing ones
					fetch(require, id, i, got, countdown);
				}
			}

			// get the default bundle, if any. this goes after we get
			// variations to ensure that ids.length is set correctly.
			fetch(require, resId, 0, got, countdown);

			function got (bundle, i) {
				bundles[i] = bundle;
				countdown();
			}

			function countdown () {
				var base;
				if (++fetched == ids.length) {
					if (bundles.length == 0) {
						eb(new Error('No i18n bundles found: "' + resId + '", locale "' + locale + '"'));
					}
					else {
						base = bundles[0] || {};
						for (i = 1; i < bundles.length; i++) {
							base = mixin(base, bundles[i]);
						}
						loaded(base);
					}
				}
			}

		},

		'cramPlugin': '../cram/i18n'

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

});
