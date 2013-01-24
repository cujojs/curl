/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl css! plugin build-time module
 */
define(['./jsEncode'], function (jsEncode) {
	"use strict";

	var templateWithRuntimeModule, templateWithRuntimePlugin, templateRx,
		nonRelUrlRe, findUrlRx, commaSepRx;

	templateWithRuntimeModule = 'define("${absId}", ["${runtime}"], function (injector) { return injector("${text}"); });\n';
	templateWithRuntimePlugin = 'define("${resourceId}", function () { return "${text}"; });\n' +
		'define("${absId}", ["${runtime}!${resourceId}"], function (sheet) { return sheet; });\n';
	templateRx = /\${([^}]+)}/g;
	commaSepRx = /\s*,\s*/g;

	// tests for absolute urls and root-relative urls
	nonRelUrlRe = /^\/|^[^:]*:\/\//;
	// Note: this will fail if there are parentheses in the url
	findUrlRx = /url\s*\(['"]?([^'"\)]*)['"]?\)/g;

	return {

		normalize: function (resourceId, normalize) {
			var resources, normalized;

			if (!resourceId) return resourceId;

			resources = resourceId.split(commaSepRx);
			normalized = [];

			for (var i = 0, len = resources.length; i < len; i++) {
				normalized.push(normalize(resources[i]));
			}

			return normalized.join(',');
		},

		compile: function (pluginId, resId, req, io, config) {
			var cssWatchPeriod, cssNoWait, template, resources, eachId;

			cssWatchPeriod = parseInt(config['cssWatchPeriod']) || 50;
			cssNoWait = config['cssNoWait'];
			template = cssNoWait
				? templateWithRuntimeModule
				: templateWithRuntimePlugin;
			resources = (resId || '').split(commaSepRx);

			while ((eachId = resources.shift())) templatize(eachId);

			function templatize (resId) {
				var absId = pluginId + '!' + resId;

				io.read(resId, function (text) {
					var moduleText;

					// TODO: we should *remove* url bits from paths here!
					text = translateUrls(text, resId);

					moduleText = replace(
						template,
						{
							absId: absId,
							runtime: 'curl/plugin/style',
							resourceId: resId,
							text: jsEncode(text)
						}
					);

					io.write(moduleText);

				}, io.error);

			}
		}

	};

	function replace (text, values) {
		return text.replace(templateRx, function (m, id) {
			return values[id];
		});
	}

	function translateUrls (cssText, baseUrl) {
		return cssText.replace(findUrlRx, function (all, url) {
			return 'url("' + translateUrl(url, baseUrl) + '")';
		});
	}

	function translateUrl (url, parentPath) {
		// if this is a relative url
		if (!nonRelUrlRe.test(url)) {
			// append path onto it
			url = parentPath + url;
		}
		return url;
	}

});

/*
define('some/id.css', function () {
	return '.foo { display: none; }';
});

define('curl/plugin/css!some/id.css', ['curl/plugin/style!some/id.css', 'curl/plugin/style'], function (sheet) {
	return sheet;
});
*/