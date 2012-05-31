/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl createContext module
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

define(['curl/_privileged', 'require'], function (priv, require) {
	var cache, cleanupScript;

	cache = priv['cache'];

	cleanupScript = typeof document != 'undefined' ? removeScript : noop;

	/**
	 * Removes a module from curl.js's cache so that it can
	 * be re-defined or re-required.  Provide an array of moduleIds
	 * instead of a single moduleId to delete many at a time.
	 * @param moduleId {String|Array} the id of a module (or modules)
	 */
	return function undefine (moduleId) {
		var ids, id, url;

		ids = [].concat(moduleId);
		while ((id = ids.pop())) {
			if (cache[id] instanceof priv.Promise) {
				url = require.toUrl(cache[id].ctxId || id);
			}
			else {
				url = require.toUrl(id);
			}
			delete cache[id];
			cleanupScript(url);
		}
	};

	function removeScript (url) {
		var rx, scripts, i, script;
		rx = new RegExp(url + '($|\\.)', 'i');
		scripts = document.getElementsByTagName('script');
		i = 0;
		while ((script = scripts[i++])) {
			if (rx.test(script.src)) {
				script.parentNode.removeChild(script);
				scripts = []; // all done!
			}
		}
	}

	function noop () {}

});
