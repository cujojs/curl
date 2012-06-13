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
		failIfBlankSheet,
		collectorSheet = doc && !!doc.createStyleSheet,
		hasEvent = { links: {} };

	if (doc) {
		head = doc.head || (doc.head = doc.getElementsByTagName('head')[0]);
		// 'about:blank' returns a valid stylesheet (blank)
		testLinkEvent('load', 'about:blank');
		// this test doesn't work in FF<=13 (and maybe future versions)
		testLinkEvent('error', 'about:_curl_bogus');
		// FF and Chrome correctly detect on this one, but Safari screams loudly (in Net tab)
		//testLinkEvent('error', 'javascript:');
		// FF and chrome also correctly fail here, but Safari screams loudly (in Net tab)
		//testLinkEvent('error', 'data:text/css;base64,_');
		// FF correctly fails here and Safari doesn't scream, yay:
		testLinkEvent('error', 'data:text/text,');
		// detect IE false positives (fires onload instead of onerror)
		testLinkEvent('load', 'about:_curl_bogus', 'false-load');
	}

	function testLinkEvent (event, page, name) {
		var link;
		name = name || event;
		link = hasEvent.links[name] = createLink(false);
		link['on' + event] = function () { setLoadDetection(event, true, name); };
		link.href = page;
		head.appendChild(link);
		setTimeout(function () { head.removeChild(link); }, 50);
	}

	function setLoadDetection (event, hasNative, name) {
		name = name || event;
		// TODO: cancel in-flight detection routines (how?)
		hasEvent[name] = hasEvent[name] || hasNative;
	}

	// TODO: how about we just move sheets to collector as soon as they're loaded? -> hm. debugging @imports sucks so we should try to keep them as links?
	function createLink (collectSheets) {
		var link;
		// TODO: detect if we need to avoid 31-sheet limit in IE
		if (collectSheets) {
			if (!collectorSheet) {
				collectorSheet = document.createStyleSheet();
			}
			if (doc.styleSheets.length >= 30) {
				moveLinksToCollector();
			}
		}
		link = doc[createElement]('link');
		link.rel = "stylesheet";
		link.type = "text/css";
		if (collectSheets) link['_curl_movable'] = true;
		return link;
	}

	function moveLinksToCollector () {
		// IE 6-8 fail when there are 31 sheets, so we collect them.
		// Note: this hack relies on proper cache headers.
		var link, links, collector, pos = 0;
		collector = collectorSheet;
		collectorSheet = null; // so a new one will be created
		links = document.getElementsByTagName('link');
		while ((link = links[pos])) {
			if (link['_curl_movable']) {
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

	/***** load-detection functions *****/

	function loadHandler (link, cb) {
		link.onload = function () {
			// we know this works now!
			setLoadDetection('load', true);
			if (hasEvent['false-load'] && failIfBlankSheet) {
				// TODO: if this could be a false positive, figure out how to determine this without causing another HTTP fetch
				// how to do this for xdomain? same-domain is easy: look for rules.length > 0
			}
			cb();
		};
	}

	function errorHandler (link, cb) {
		link.onerror = function () {
			// we know this works now!
			setLoadDetection('error', true);
			cb();
		};
	}

	function isLinkReady (link) {
		var ready, sheet, rules;
		// don't bother testing until we've fully initialized the link;
		if (!link.href) return false;

		ready = false;

		try {
			// no need to check for IE's link.styleSheet cuz IE has native onload
			sheet = link.sheet;
			if (sheet) {
				// FF will throw a security exception here when an XD
				// sheet is loaded. webkits (that don't support onload)
				// will return null when an XD sheet is loaded
				rules = sheet.cssRules;
				ready = rules === null;
				// TODO: remove browser sniff cuz it's probably not needed
				if (!ready && 'length' in rules && !window.chrome) {
					// Opera needs to further test for rule manipulation
					sheet.insertRule('-curl-css-test {}', 0);
					sheet.deleteRule(0);
					ready = true;
					setLoadDetection('load', false);
				}
			}
		}
		catch (ex) {
			// a "security" or "access denied" error indicates that an XD
			// stylesheet has been successfully loaded!
			ready = /security|denied/i.test(ex.message);
			setLoadDetection('load', false);
		}

		return ready;
	}

	function finalize (link) {
		// noop serves as a flag that a link event fired
		// note: Opera and IE won't clear handlers if we use a non-function
		link.onload = link.onerror = noop;
	}

	function isFinalized (link) {
		return link.onload == noop;
	}

	function ssWatcher (link, wait, cb) {
		// watches a stylesheet for loading signs.
		if (hasEvent['load']) return; // always check on re-entry
		if (isLinkReady(link)) {
			cb();
		}
		else if (!isFinalized(link)) {
			setTimeout(function () { ssWatcher(link, wait, cb); }, wait);
		}
	}

	function errorWatcher (link, wait, eb) {
		if (hasEvent['error']) return;
		// for browsers that don't call onerror after an http error:
		// we wait (at least) 500 msec before trying again with an image
		// element. the image element's onerror handler
		// will fire when the browser has determined if the href is valid
		// or not (20X or 40X/50X).  however, we can't know if it's a 20X
		// or something else, so we delay just a bit longer to see if
		// the sheet loaded. this will cause another fetch, but we don't
		// have any other options for dumbass browsers.
		setTimeout(function () {
			var img;
			if (hasEvent['error'] || isFinalized(link)) return;
			// Note: can't use `new Image()` in webkit browsers
			// (it doesn't seem to fire events)
			img = document[createElement]('img');
			img.onerror = img.onload = function () {
				setTimeout(function () {
					if (!hasEvent['error'] && !isFinalized(link)) eb();
				}, 10); // a wee bit more time to process sheet
			};
console.log(link.href, 'launched counter strike')
			img.src = link.href;
		}, wait);
	}

	function loadDetector (link, wait, cb) {
		// most browsers now support link.onload, but many older browsers
		// don't. Browsers that don't will launch the ssWatcher to repeatedly
		// test the link for readiness.
		function load () {
			// only executes once (link.onload is acting as a flag)
			if (isFinalized(link)) return;
			finalize(link);
			waitForDocumentComplete(cb);
		}
		// always try standard handler
		loadHandler(link, load);
		// also try the fallback
		ssWatcher(link, wait, load);
	}

	function errorDetector (link, cb) {
		var h;
		// very few browsers (Chrome 19+ and FF9+ as of Apr 2012) have a
		// functional onerror handler (and those only detect 40X/50X http
		// errors, not parsing errors as per the w3c spec).
		// IE6-9 call onload when there's an http error, but I can't seem
		// to find a way to detect the error, yet.
		function error () {
			clearTimeout(h);
			// only executes once (link.onload is acting as a flag)
			if (isFinalized(link)) return;
			finalize(link);
			cb(new Error('HTTP or network error.'));
		}
		// always try standard handler
		errorHandler(link, error);
		// if we are not sure if the native error event works, try the fallback
		errorWatcher(link, 500, error);
	}

	function waitForDocumentComplete (cb) {
		// this isn't exactly the same as domReady (when dom can be
		// manipulated). it's later (when styles are applied).
		// chrome needs this (and opera?)
		function complete () {
			if (!doc.readyState || doc.readyState == 'complete') {
				cb();
			}
			else {
				setTimeout(complete, 10);
			}
		}
		complete();
	}

	function nameWithExt (name, defaultExt) {
		return name.lastIndexOf('.') <= name.lastIndexOf('/') ?
			name + '.' + defaultExt : name;
	}

	function noop () {}

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
				loadingCount = resources.length,
				i;

			// all detector functions must ensure that this function only gets
			// called once per stylesheet!
			function loaded () {
				if (--loadingCount == 0) {
					callback();
				}
			}

			function failed (ex) {
				var eb;
				eb = callback.reject || function (ex) { throw ex; };
				eb(ex);
			}

			// `after` will become truthy once the loop executes a second time
			for (i = 0; i < resources.length; i++) {

				resourceId = resources[i];

				var
					url = require['toUrl'](nameWithExt(resourceId, 'css')),
					link = createLink(),
					nowait = !!config['cssDeferLoad'],
					wait = config['cssWatchPeriod'] || 50;

				if (nowait) {
					callback();
				}
				else {
					// hook up load detector(s)
					loadDetector(link, wait, loaded);
					// hook up error detector(s)
					errorDetector(link, failed);
				}

				// go!
				link.href = url;
console.log(link.href, 'go!');
				head.appendChild(link);
			}


		},

		'plugin-builder': './builder/css',
		'pluginBuilder': './builder/css'

	});

})(this);
