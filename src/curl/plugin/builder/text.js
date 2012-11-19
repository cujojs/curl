/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl text! builder plugin
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */
define(['./jsEncode'], function (jsEncode) {

	return {

		normalize: function (resourceId, toAbsId) {
			// remove options
			return resourceId ? toAbsId(resourceId.split("!")[0]) : resourceId;
		},

		compile: function (absId, req, io, config) {
			io.read(resourceId(absId), function (text) {
				io.write(
					'define("' + absId + '", function () {\n' +
					'\treturn "' + jsEncode(text) + '";\n' +
					'});\n'
				);
			}, io.error);
		}

	};

	function resourceId (absId) {
		return absId && absId.split('!')[1] || '';
	}

});
