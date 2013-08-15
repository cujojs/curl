define(/*=='curl/plugin/getLocale',==*/ function () {

	var appendLocaleRx;

	// finds the end and an optional .js extension since some devs may have
	// added it, which is legal since plugins sometimes require an extension.
	appendLocaleRx = /(\.js)?$/;

	getLocale.toModuleId = localeToModuleId;

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

	function localeToModuleId (defaultId, locale) {
		return defaultId.replace(appendLocaleRx, locale ? '/' + locale  : '');
	}

});
