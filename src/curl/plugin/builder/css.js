/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl css! plugin build-time module
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */
define(['./jsEncode'], function (jsEncode) {
	"use strict";

	var template, templateRx, nonRelUrlRe, findUrlRx;

	template = 'define("${resourceId}", function () { return ${text}; });\n' +
		'define("${absId}", ["${runtimePlugin}${resourceId}"], function (sheet) { return sheet; });\n';
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

		compile: function (absId, req, io, config) {
			var resId, /*sheets, resources,*/ cssWatchPeriod, cssNoWait, i;

			resId = resourceId(absId);
//			sheets = [];
//			resources = (resId || '').split(/\s*,\s*/);
			cssWatchPeriod = parseInt(config['cssWatchPeriod']) || 50;
			cssNoWait = config['cssNoWait'];

			// TODO: support comma-sep list of sheets
			io.read(resourceId(absId), function (text) {
				var moduleText;

				// TODO: copy configuration options to run-time plugin
				// Note: inline options and run-time options still need to have precedence somehow!

				// TODO: translate urls
				text = translateUrls(text, resId);

				moduleText = replace(
					template,
					{
						absId: absId,
						runtimePlugin: 'curl/plugin/style!',
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

	function resourceId (absId) {
		return absId && absId.split('!')[1] || '';
	}

});

/*
define('some/id.css', function () {
	return '.foo { display: none; }';
});

define('curl/plugin/css!some/id.css', ['curl/plugin/style!some/id.css'], function (sheet) {
	return sheet;
});
*/