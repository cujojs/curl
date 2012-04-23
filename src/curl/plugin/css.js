/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl css! plugin
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

(function (global) {
"use strict";

/*
 * AMD css! plugin
 * This plugin will load and wait for css files.  This could be handy when
 * loading css files as part of a layer or as a way to apply a run-time theme.
 * Some browsers do not support the load event handler of the link element.
 * Therefore, we have to use other means to detect when a css file loads.
 * Some browsers don't support the error event handler, either.
 * The HTML5 spec states that the LINK element should have both load and
 * error events:
 * http://www.w3.org/TR/html5/semantics.html#the-link-element
 *
 * This plugin tries to use the load event and a universal work-around when
 * it is invoked the first time.  If the load event works, it is used on
 * every successive load.  Therefore, browsers that support the load event will
 * just work (i.e. no need for hacks!).  FYI, Feature-detecting the load
 * event is tricky since most browsers have a non-functional onload property.
 *
 * The universal work-around watches a stylesheet until its rules are
 * available (not null or undefined).  There are nuances, of course, between
 * the various browsers.  The isLinkReady function accounts for these.
 *
 * Note: it appears that all browsers load @import'ed stylesheets before
 * fully processing the rest of the importing stylesheet. Therefore, we
 * don't need to find and wait for any @import rules explicitly.
 *
 * Global configuration options:
 *
 * cssDeferLoad: Boolean. You can also instruct this plugin to not wait
 * for any css resources. They'll get loaded asap, but other code won't wait
 * for them. This is just like using the !nowait option on every css file.
 *
 * cssWatchPeriod: if direct load-detection techniques fail, this option
 * determines the msec to wait between brute-force checks for rules. The
 * default is 50 msec.
 *
 * You may specify an alternate file extension:
 *      require('css!myproj/component.less') // --> myproj/component.less
 *      require('css!myproj/component.scss') // --> myproj/component.scss
 *
 * When using alternative file extensions, be sure to serve the files from
 * the server with the correct mime type (text/css) or some browsers won't
 * parse them, causing an error in the plugin.
 *
 * usage:
 *      require(['css!myproj/comp']); // load and wait for myproj/comp.css
 *      define(['css!some/folder/file'], {}); // wait for some/folder/file.css
 *      require(['css!myWidget!nowait']);
 *
 * Tested in:
 *      Firefox 3.6, 4.0, 11
 *      Safari 3.0.4, 3.2.1, 5.0
 *      Chrome 19
 *      Opera 11.62
 *      IE 6, 7, 8, and 9
*/

	var
		// compressibility shortcuts
		createElement = 'createElement',
		// doc will be undefined during a build
		doc = global.document,
		// find the head element and set it to it's standard property if nec.
		head,
		collectSheets,
		collectorSheet = doc && !!doc.createStyleSheet,
		insertedSheets = {},
		features = {
			// true if the onload event handler works
			// "event-link-onload" : false
		};

	if (doc) {
		head = doc.head || (doc.head = doc.getElementsByTagName('head')[0]);
	}

	function has (feature) {
		return features[feature];
	}

	/***** load-detection functions *****/

	function loadHandler (link, cb) {
		link.onload = function () {
			// we know this works now!
			features["event-link-onload"] = true;
			cb();
		};
	}

	function isLinkReady (link) {
		var ready, sheet, rules;
		// don't bother testing until we've fully initialized the link;
		if (!link.href) return false;

		ready = false;

		try {
			// no need to check for IE's link.styleSheet cuz IE won't get here
			sheet = link.sheet;
			if (sheet) {
				// FF will throw a security exception here when an XD
				// sheet is loaded. webkits (that don't support onload)
				// will return null when an XD sheet is loaded
				rules = sheet.cssRules;
				ready = rules ? 'length' in rules : rules === null;
				if (!ready) {
					// Opera needs to further test for rule manipulation
					sheet.insertRule('-curl-css-test {}', 0);
					sheet.removeRule(0);
				}
			}
		}
		catch (ex) {
			// a "security" or "access denied" error indicates that an XD
			// stylesheet has been successfully loaded!
			ready = /security|denied/.test(ex.message);
		}

		return ready;
	}

	function ssWatcher (link, wait, cb) {
		// watches a stylesheet for loading signs.
		if (isLinkReady(link)) {
			cb();
		}
		else if (link.onload) {
			setTimeout(function () { ssWatcher(link, wait, cb); }, wait);
		}
	}

	function loadDetector (link, wait, cb) {
		// most browsers now support link.onload, but many older browsers
		// don't. Browsers that don't will launch the ssWatcher to repeatedly
		// test the link for readiness.
		function cbOnce () {
			// only executes once since link.onload is blanked
			if (link.onload) {
				// note: Opera doesn't clear handlers if we set them to blank
				// and IE fails if we use `undefined` string so we use null
				link.onload = link.onerror = null;
				cb();
			}
		}
		loadHandler(link, cbOnce);
		if (!has("event-link-onload")) {
			ssWatcher(link, wait, cbOnce);
		}
	}

	function errorDetector (link, cb) {
		// very few browsers (Chrome 19+ and FF9+ as of Apr 2012) have a
		// functional onerror handler (and those only detect 40X/50X http
		// errors, not parsing errors as per the w3c spec).
		// IE6-9 call onload when there's an http error, but I can't seem
		// to find a way to detect the error, yet.
		function error () {
			link.onload = link.onerror = null;
			cb(new Error('HTTP or network error.'));
		}
		link.onerror = error;
		// for browsers that don't call onerror or onload after an http error:
		// we wait 500 msec before testing for failure via an image element.
		// this will cause another fetch, but we don't have any other options.
		setTimeout(function () {
			var img;
			// if link didn't load yet
			if (link.onload) {
				// Note: can't use `new Image()` in webkit browsers (doesn't fire)
				img = document[createElement]('img');
				img.onerror = img.onload = function () {
					// only call if link didn't load while fetching image
					if (link.onload) error();
				};
				img.src = link.href;
			}
		}, 500);
	}

	function createLink (doc) {
		// detect if we need to avoid 31-sheet limit in IE
		if (collectSheets) {
			if (!collectorSheet) {
				collectorSheet = document.createStyleSheet();
			}
			if (document.styleSheets.length >= 30) {
				moveLinksToCollector();
			}
		}
		var link = doc[createElement]('link');
		link.rel = "stylesheet";
		link.type = "text/css";
		if (collectSheets) link.setAttribute('_curl_movable', true);
		return link;
	}

	function moveLinksToCollector () {
		// IE 6-8 fails when over 31 sheets, so we collect them.
		// Note: this hack relies on proper cache headers.
		var link, links, collector, pos = 0;
		collector = collectorSheet;
		collectorSheet = null; // so a new one will be created
		links = document.getElementsByTagName('link');
		while ((link = links[pos])) {
			if (link.getAttribute('_curl_movable')) {
				// move to the collector (note: bad cache directive
				// will cause a re-download)
				collector.addImport(link.href);
				// remove from document
				if (link.parentNode) link.parentNode.removeChild(link);
			}
			else {
				// skip this sheet
				pos++;
			}
		}
	}

	function nameWithExt (name, defaultExt) {
		return name.lastIndexOf('.') <= name.lastIndexOf('/') ?
			name + '.' + defaultExt : name;
	}

	/***** finally! the actual plugin *****/

	define(/*=='css',==*/ {

		'normalize': function (resourceId, normalize) {
			var resources, normalized;

			if (!resourceId) return resourceId;

			resources = resourceId.split(",");
			normalized = [];

			for (var i = 0, len = resources.length; i < len; i++) {
				normalized.push(normalize(resources[i]));
			}

			return normalized.join(',');
		},

		'load': function (resourceId, require, callback, config) {
			var resources = (resourceId || '').split(","),
				loadingCount = resources.length;

			// all detector functions must ensure that this function only gets
			// called once per stylesheet!
			function loaded () {
				if(--loadingCount == 0){
					callback(link.sheet || link.styleSheet);
				}
			}

			function failed (ex) {
				var eb;
				eb = callback.reject || function (ex) { throw ex; };
				eb(ex);
			}

			// `after` will become truthy once the loop executes a second time
			for (var i = resources.length - 1, after; i >= 0; i--, after = true) {

				resourceId = resources[i];

				var
					url = require['toUrl'](nameWithExt(resourceId, 'css')),
					link = createLink(doc),
					nowait = !!config['cssDeferLoad'],
					wait = config['cssWatchPeriod'] || 50;

				if (nowait) {
					callback(link.sheet || link.styleSheet);
				}
				else {
					// hook up load detector(s)
					loadDetector(link, wait, loaded);
					// hook up error detector(s)
					errorDetector(link, failed);
				}

				// go!
				link.href = url;

				if (after) {
					head.insertBefore(link, insertedSheets[after].previousSibling);
				}
				else {
					head.appendChild(link);
				}
				insertedSheets[url] = link;
			}


		},

		'plugin-builder': './builder/css',
		'pluginBuilder': './builder/css'

	});

})(this);
