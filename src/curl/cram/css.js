/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl css! plugin build-time module
 *
 * TODO: support comma-separated resource ids
 */
define(['./jsEncode'], function (jsEncode) {
	"use strict";

	var template, templateRx, nonRelUrlRe, findUrlRx;

	template = 'define("${resourceId}", function () { return "${text}"; });\n' +
		'define("${absId}", ["${runtimePlugin}!${resourceId}", "${runtimePlugin}"], function (sheet) { return sheet; });\n';
	templateRx = /\${([^}]+)}/g;

	// tests for absolute urls and root-relative urls
	nonRelUrlRe = /^\/|^[^:]*:\/\//;
	// Note: this will fail if there are parentheses in the url
	findUrlRx = /url\s*\(['"]?([^'"\)]*)['"]?\)/g;

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

	return {

		// TODO: reuse this with run-time plugin
		normalize: function (resourceId, normalize) {
			var resources, normalized;

			if (!resourceId) return resourceId;

			resources = resourceId.split(",");
			normalized = [];

			for (var i = 0, len = resources.length; i < len; i++) {
				normalized.push(normalize(resources[i]));
			}

			return normalized.join(',');
		},

		compile: function (pluginId, resId, req, io, config) {
			var absId, /*sheets, resources,*/ cssWatchPeriod, cssNoWait, i;

			absId = pluginId + '!' + resId;
//			sheets = [];
//			resources = (resId || '').split(/\s*,\s*/);
			cssWatchPeriod = parseInt(config['cssWatchPeriod']) || 50;
			cssNoWait = config['cssNoWait'];

			io.read(resId, function (text) {
				var moduleText;

				// TODO: copy configuration options to run-time plugin
				// Note: inline options and run-time options still need to have precedence somehow!

				// TODO: translate urls
				text = translateUrls(text, resId);

				moduleText = replace(
					template,
					{
						absId: absId,
						runtimePlugin: 'curl/plugin/style',
						resourceId: resId,
						text: jsEncode(text)
					}
				);

				io.write(moduleText);

			}, io.error);
		}

	};

	function replace (text, values) {
		return text.replace(templateRx, function (m, id) {
			return values[id];
		});
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