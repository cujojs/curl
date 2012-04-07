/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl createContext module
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

define(['curl/_privileged'], function (priv) {
	var cache = priv['cache'];

	/**
	 * Removes a module from curl.js's cache so that it can
	 * be re-defined or re-required.  Provide an array of moduleIds
	 * instead of a single moduleId to delete many at a time.
	 * @param moduleId {String|Array} the id of a module (or modules)
	 */
	return function undefine (moduleId) {
		var ids, id;

		ids = [].concat(moduleId);
		while ((id = ids.pop())) {
			delete cache[id];
		}
	};

});
