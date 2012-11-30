/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl js! cram plugin
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

		compile: function (pluginId, resId, req, io /*, config*/) {
			var absId, exportsPos, exports;

			absId = pluginId + '!' + resId;
			exportsPos = resId.indexOf('!exports=');
			exports = exportsPos > 0 && resId.substr(exportsPos + 9); // must be last option!

			io.read(resId, function (text) {
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

});
