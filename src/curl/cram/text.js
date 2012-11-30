/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl text! cram plugin
 */
define(['./jsEncode'], function (jsEncode) {

	return {

		normalize: function (resourceId, toAbsId) {
			// remove options
			return resourceId ? toAbsId(resourceId.split("!")[0]) : resourceId;
		},

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
