/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl locale! plugin
 *
 * This is a very light localization plugin that gets inserted into AMD bundles
 * by cram.js.  Its functionality is nearly identical to the i18n! plugin.
 * The only difference of significance is that the locale! plugin initially
 * assumes that the module for the i18n strings is already loaded.  If the
 * module is not loaded (and config.locale != false), it invokes the i18n!
 * plugin to fetch it and assemble it.
 *
 * You probably don't want to use this plugin directly.  You likely want the
 * i18n! plugin.  Just sayin.
 *
 */
define(/*=='curl/plugin/getLocale',==*/ function () {

	var appendLocaleRx;

	// finds the end and an optional .js extension since some devs may have
	// added it, which is legal since plugins sometimes require an extension.
	appendLocaleRx = /(\.js)?$/;

	getLocale['toModuleId'] = toModuleId;
	getLocale['load'] = load;

	return getLocale;

	/**
	 * Sniffs the current locale.  In environments that don't have
	 * a global `window` object, no sniffing happens and false is returned.
	 * You may also skip the sniffing by supplying an options.locale value.
	 * @param {Object} [options]
	 * @param {String|Boolean|Function} [options.locale] If a string, it is
	 * assumed to be a locale override and is returned.  If a strict false,
	 * locale sniffing is skipped and false is returned. If a function, it is
	 * called with the same signature as this function and the result returned.
	 * @param {String} [absId] the normalized id sent to the i18n plugin.
	 * @returns {String|Boolean}
	 */
	function getLocale (options, absId) {
		var locale, ci;

		if (options) {
			locale = options['locale'];
			// if locale is a function, use it to get the locale
			if (typeof locale == 'function') locale = locale(options, absId);
			// just return any configured locale or false if the config
			// says to not sniff.
			if (typeof locale == 'string' || locale === false) return locale;
		}

		// bail if we're server-side
		if (typeof window == 'undefined') return false;

		// closure doesn't seem to know about recent DOM standards
		ci = window['clientInformation'] || window.navigator;
		return ci && ci.language || ci['userLanguage'];
	}

	function toModuleId (defaultId, locale) {
		var suffix = locale ? '/' + locale  : '';
		return defaultId.replace(appendLocaleRx, suffix + '$&');
	}

	function load (absId, require, loaded, config) {
		var defaultId, locale, bundleId;

		// figure out the locale and bundle to use
		defaultId = absId.split('!')[0];
		locale = getLocale(config, defaultId);
		bundleId = locale
			? config['localeToModuleId'] || toModuleId(defaultId, locale)
			: defaultId;

		try {
			// try to get a bundle that's already loaded
			loaded(require('i18n!' + bundleId));
		}
		catch (ex) {
			// unless locale == false, fetch the locale async via i18n plugin
			if (config.locale) {
				require(['i18n!' + defaultId], loaded, loaded.error);
			}
			else {
				throw ex;
			}
		}
	}

});
