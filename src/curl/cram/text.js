/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl text! cram plugin
 */
define(['./jsEncode'], function (jsEncode) {

	return {

		compile: function (pluginId, resId, req, io, config) {
			var absId;

			absId = pluginId + '!' + resId;

			io.read(resId, function (text) {
				io.write(
					'define("' + absId + '", function () {\n' +
					'\treturn "' + jsEncode(text) + '";\n' +
					'});\n'
				);
			}, io.error);
		}

	};

});
