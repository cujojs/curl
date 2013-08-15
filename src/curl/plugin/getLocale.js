(function (define) {
define(/*=='curl/plugin/getLocale',==*/ function () {

	/**
	 * Sniffs the current locale.  In environments that don't have
	 * a global `window` object, no sniffing happens and false is returned.
	 * You may also skip the sniffing by supplying an options.locale value.
	 * @param {Object} [options]
	 * @param {String|Boolean|Function} [options.locale] If a string, it is
	 * assumed to be a locale override and is returned.  If a strict false,
	 * locale sniffing is skipped and false is returned. If a function, it is
	 * called with the same signature as this function and the result returned.
	 * @param {String} [absId]
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

	return getLocale;

});
}(
	typeof define == 'function' && define.amd
		? define
		: function (deps, factory) { module.exports = factory(deps.map(require)); }
));
