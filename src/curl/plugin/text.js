/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl text! loader plugin
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

/**
 * TODO: load xdomain text, too, somehow
 *
 */

define(/*=='curl/plugin/text',==*/ ['./fetchText'], function (fetchText) {

	return {

		'normalize': function (resourceId, toAbsId) {
			// remove options
			return resourceId ? toAbsId(resourceId.split("!")[0]) : resourceId;
		},

		load: function (resourceName, req, callback, config) {
			// remove suffixes (future)
			// get the text
			fetchText(req['toUrl'](resourceName), callback, callback['error'] || error);
		},

		'plugin-builder': './builder/text',
		'pluginBuilder': './builder/text'

	};

	function error (ex) {
		throw ex;
	}

});
