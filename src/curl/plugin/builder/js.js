/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl js! builder plugin
 *
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 */
define(['./jsEncode'], function (jsEncode) {
	var stripOrderOptionRx;

	stripOrderOptionRx = /!order/;

	return {

		normalize: function (resourceId, toAbsId) {
			// Remove !order option.  It's not needed in a bundle.
			// !exports option must be preserved so that it will be
			// passed to the compile() method.
			return resourceId
				? toAbsId(resourceId.replace(stripOrderOptionRx, ''))
				: resourceId;
		},

		compile: function (absId, req, io /*, config*/) {

			var exportsPos, exports;

			exportsPos = absId.indexOf('!exports=');
			exports = exportsPos > 0 && absId.substr(exportsPos + 9); // must be last option!

			io.read(resourceId(absId), function (text) {
				var moduleText =
					'define("' + absId + '", function () {\n' +
						jsEncode(text) + ';\n' +
						'\treturn ';

				moduleText += exports
					? 'window.' + exports
					: 'new Error()';

				moduleText += ';\n});\n';

				io.write(moduleText);

			}, io.error);
		}

	};

	function resourceId (absId) {
		return absId && absId.split('!')[1] || '';
	}

});
