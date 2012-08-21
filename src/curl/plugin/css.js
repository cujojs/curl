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
 * loading css files as part of a component or a theme.
 * Some browsers do not support the load event handler of the link element.
 * Therefore, we have to use other means to detect when a css file loads.
 * Some browsers don't support the error event handler, either.
 * The HTML5 spec states that the LINK element should have both load and
 * error events:
 * http://www.w3.org/TR/html5/semantics.html#the-link-element
 *
 * This plugin tries to use the load event and a universal work-around when
 * it is invoked.  If the load event works, it is used on every successive load.
 * Therefore, browsers that support the load event will just work (i.e. no
 * need for hacks!).  FYI, sniffing for the load event is tricky
 * since most browsers still have a non-functional onload property.
 *
 * IE is a special case since it also has a 31-stylesheet limit (finally
 * fixed in IE 10).  To get around this, we can use a set of <style>
 * elements instead of <link> elements and add @import; rules into them.
 * This allows us to add considerably more than 31 stylesheets.  See the
 * comment for the loadImport method for more information.
 *
 * The universal work-around for other browsers watches a stylesheet
 * until its rules are available (not null or undefined).  There are
 * nuances, of course, between the various browsers.  The isLinkReady
 * function accounts for these.
 *
 * Note: it appears that all browsers load @import'ed stylesheets before
 * fully processing the rest of the importing stylesheet. Therefore, we
 * don't need to find and wait for any @import rules explicitly.  They'll
 * be waited for implicitly.
 *
 * Global configuration options:
 *
 * cssNoWait: Boolean. You can instruct this plugin to not wait
 * for any css resources. They'll get loaded asap, but other code won't wait
 * for them.
 *
 * cssWatchPeriod: if direct load-detection techniques fail, this option
 * determines the msec to wait between brute-force checks for rules. The
 * default is 50 msec.
 *
 * You may specify an alternate file extension or no extension:
 *      require('css!myproj/component.less') // --> myproj/component.less
 *      require('css!myproj/component') // --> myproj/component.css
 *
 * When using alternative file extensions, be sure to serve the files from
 * the server with the correct mime type (text/css) or some browsers won't
 * parse them, causing an error.
 *
 * usage:
 *      require(['css!myproj/comp.css']); // load and wait for myproj/comp.css
 *      define(['css!some/folder/file'], {}); // wait for some/folder/file.css
 *      require(['css!myWidget']);
 *
 * Tested in:
 *      Firefox 3.6, 4.0, 11, 21
 *      Safari 3.0.4, 3.2.1, 5.0
 *      Chrome 19
 *      Opera 11.62, 12.01
 *      IE 6-10
 *  Error handlers work in the following:
 *  	Firefox 12+
 *  	Safari 6+
 *  	Chrome 9+
 *  	IE7-9
 *  Error handlers don't work in:
 *  	Opera 11.62, 12.01
 *  	Firefox 3.6, 4.0
 *  	IE 6 and 10
*/

	var
		// compressibility shortcuts
		createElement = 'createElement',
		parentNode = 'parentNode',
		setTimeout = global.setTimeout,
		pluginBuilder = './builder/css',
		// doc will be undefined during a build
		doc = global.document,
		// find the head element and set it to it's standard property if nec.
		head,
		// infer IE 6-9
		// IE 10 still doesn't seem to have link.onerror support,
		// but it doesn't choke on >31 stylesheets at least!
		shouldCollectSheets = doc && doc.createStyleSheet && !(doc.documentMode >= 10),
		ieCollectorSheets = [],
		ieCollectorPool = [],
		ieCollectorQueue = [],
		ieMaxCollectorSheets = 12,
		loadSheet,
		msgHttp = 'HTTP or network error.',
		hasEvent = {};

	if (doc) {
		head = doc.head || doc.getElementsByTagName('head')[0];
		if (shouldCollectSheets) {
			loadSheet = loadImport;
		}
		else {
			loadSheet = loadLink;
		}
	}

	function setLoadDetection (event, hasNative) {
		hasEvent[event] = hasEvent[event] || hasNative;
	}

	function createLink () {
		var link;
		link = doc[createElement]('link');
		link.rel = "stylesheet";
		link.type = "text/css";
		return link;
	}

	/***** load functions for compliant browsers *****/

	function loadHandler (link, cb) {
		link.onload = function () {
			// we know browser is compliant now!
			setLoadDetection('load', true);
			cb();
		};
	}

	function errorHandler (link, cb) {
		link.onerror = function () {
			// we know browser is compliant now!
			setLoadDetection('error', true);
			cb();
		};
	}

	/***** ie load functions *****/

	/**
	 * Loads a stylesheet via IE's addImport() method, which is the only
	 * way to detect both onload and onerror in IE.  If we create a "parent
	 * stylesheet", we can addImport() other sheets into it.  The tricky part
	 * is that we have to load one sheet at a time and create a new onload
	 * and onerror event for each one.  (IE only fires an onload or onerror
	 * function once, but if you replace the onload or onerror functions,
	 * it'll fire the new ones if there's another load or error event.
	 * Way to be awesome, IE team!)
	 *
	 * To get around the one-sheet-at-a-time problem, we create many
	 * parent stylesheets at once.  If we create 12 parent sheets, we can load
	 * up to 12 imported sheets at once.  This has an additional benefit:
	 * we can load 372 (12 * 31) stylesheets.  IE 6-9 can dynamically load only
	 * 31 stylesheets in any one scope.  By creating multiple parent sheets, we
	 * create multiple scopes.
	 *
	 * The astute reader will have discovered a major flaw with this approach:
	 * we've killed the cascade (the "C" in CSS).  Rules in stylesheets override
	 * rules in stylesheets that were declared earlier.  This is universal.
	 * However, the IE team interpreted the word "earlier" differently than
	 * everybody else (including the w3c).  IE interprets it as meaning "earlier
	 * in time" (temporal), rather than "earlier in the document" (spacial).
	 * Specifically, the temporal order of the insertion of the sheet into the
	 * DOM/BOM is what matters in IE.
	 *
	 * In other words: the bungling of the IE team (both in allowing sheet
	 * error handlers to execute multiple times and in allowing us to use
	 * temporal order rather than dom order) has allowed us to implement
	 * this work-around.
	 *
	 * Note: CSS debugging tools in IE 6-8 seem to fail when inserting
	 * stylesheets dynamically no matter which method we use to insert them.
	 *
	 * @private
	 * @param url {String}
	 * @param cb {Function}
	 * @param eb {Function}
	 */
	function loadImport (url, cb, eb) {
		var coll;

		// push stylesheet and callbacks on queue
		ieCollectorQueue.push({
			url:url,
			cb:cb,
			eb: function failure () { eb(new Error(msgHttp)); }
		});

		// find an available collector
		coll = getIeCollector();

		// if we have an available collector, import a stylesheet off queue
		if (coll) {
			loadNextImport(coll);
		}

	}

	/**
	 * Grabs the next sheet/callback item from the queue and imports it into
	 * the provided collector sheet.
	 * @private
	 * @param coll {Stylesheet}
	 */
	function loadNextImport (coll) {
		var imp;

		imp = ieCollectorQueue.shift();

		if (imp) {
			coll.onload = function () {
				imp.cb();
				loadNextImport(coll);
			};
			coll.onerror = function () {
				imp.eb();
				loadNextImport(coll);
			};
			coll.styleSheet.addImport(imp.url);
		}
		else {
			finalize(coll);
			returnIeCollector(coll);
		}
	}

	/**
	 * Returns a collector sheet to the pool.
	 * @private
	 * @param coll {Stylesheet}
	 */
	function returnIeCollector (coll) {
		ieCollectorPool.push(coll);
	}

	/**
	 * Gets the next collector sheet in the pool.  If there is no collector
	 * in the pool and less than the maximum collector sheets has been created,
	 * a new one is created. If the max collectors have been created,
	 * undefined is returned.
	 * @private
	 * @return {HTMLElement} a stylesheet element to act as a collector sheet
	 */
	function getIeCollector () {
		var el;

		el = ieCollectorPool.shift();

		if (!el && ieCollectorSheets.length < ieMaxCollectorSheets) {
			el = doc.createElement('style');
			ieCollectorSheets.push(el);
			head.appendChild(el);
		}

		return el;
	}

	/***** load functions for legacy browsers (old Safari and FF) *****/

	function isLinkReady (link) {
		var ready, sheet, rules;
		// don't bother testing until we've fully initialized the link and doc;
		if (!link.href || !isDocumentComplete()) return false;

		ready = false;

		try {
			sheet = link.sheet;
			if (sheet) {
				// old FF will throw a security exception here when an XD
				// sheet is loaded. webkits (that don't support onload)
				// will return null when an XD sheet is loaded
				rules = sheet.cssRules;
				ready = rules === null;
				if (!ready && 'length' in rules) {
					// Safari needs to further test for rule manipulation
					// on local stylesheets (Opera too?)
					sheet.insertRule('-curl-css-test {}', 0);
					sheet.deleteRule(0);
					ready = true;
				}
			}
		}
		catch (ex) {
			// a "security" or "access denied" error indicates that an XD
			// stylesheet has been successfully loaded in old FF
			ready = /security|denied/i.test(ex.message);
		}

		return ready;
	}

	function finalize (link) {
		// noop serves as a flag that a link event fired
		// note: Opera and IE won't clear handlers if we use a non-function
		link.onload = link.onerror = noop;
	}

	function isFinalized (link) {
		return link.onload == noop || !link.onload;
	}

	function loadWatcher (link, wait, cb) {
		// watches a stylesheet for loading signs.
		if (hasEvent['load']) return; // always check on re-entry
		if (isLinkReady(link)) {
			cb();
		}
		else if (!isFinalized(link)) {
			setTimeout(function () { loadWatcher(link, wait, cb); }, wait);
		}
	}

	function errorWatcher (link, wait, eb) {
		if (hasEvent['error']) return;
		// TODO: figure out a method to test for stylesheet failure without risk of re-fetching
	}

	function linkLoaded (link, wait, cb) {
		// most browsers now support link.onload, but many older browsers
		// don't. Browsers that don't will launch the loadWatcher to repeatedly
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
		loadWatcher(link, wait, load);
	}

	function linkErrored (link, wait, cb) {
		// very few browsers (Chrome 19+ and FF9+ as of Apr 2012) have a
		// functional onerror handler (and those only detect 40X/50X http
		// errors, not parsing errors as per the w3c spec).
		// IE6-9 call onload when there's an http error. (nice, real nice)
		// this only matters in IE9 since IE6-8 use the addImport method
		// which does call onerror.
		function error () {
			// only executes once (link.onload is acting as a flag)
			if (isFinalized(link)) return;
			finalize(link);
			cb(new Error(msgHttp));
		}
		// always try standard handler
		errorHandler(link, error);
		// if we are not sure if the native error event works, try the fallback
		errorWatcher(link, wait, error);
	}

	function loadLink (url, cb, eb, period) {
		var link;
		link = createLink();
		linkLoaded(link, period, cb);
		linkErrored(link, period, eb);
		link.href = url;
		head.appendChild(link);
	}

	function waitForDocumentComplete (cb) {
		// this isn't exactly the same as domReady (when dom can be
		// manipulated). it's later (when styles are applied).
		// chrome needs this (and opera?)
		function complete () {
			if (isDocumentComplete()) {
				cb();
			}
			else {
				setTimeout(complete, 10);
			}
		}
		complete();
	}

	function isDocumentComplete () {
		return !doc.readyState || doc.readyState == 'complete';
	}

	function nameWithExt (name, defaultExt) {
		return name.lastIndexOf('.') <= name.lastIndexOf('/') ?
			name + '.' + defaultExt : name;
	}

	function noop () {}

	/***** finally! the actual plugin *****/

	define(/*=='curl/plugin/css',==*/ {

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
			var resources, cssWatchPeriod, cssNoWait, loadingCount, i;
			resources = (resourceId || '').split(",");
			cssWatchPeriod = config['cssWatchPeriod'] || 50;
			cssNoWait = config['cssNoWait'];
			loadingCount = resources.length;

			// this function must get called just once per stylesheet!
			function loaded () {
				if (--loadingCount == 0) {
					callback();
				}
			}

			function failed (ex) {
				var eb;
				eb = callback.reject || function (ex) {
					throw ex;
				};
				eb(ex);
			}

			for (i = 0; i < resources.length; i++) {

				resourceId = resources[i];

				var url, link;
				url = require['toUrl'](nameWithExt(resourceId, 'css'));

				if (cssNoWait) {
					link = createLink();
					link.href = url;
					head.appendChild(link);
					loaded();
				}
				else {
					loadSheet(url, loaded, failed, cssWatchPeriod);
				}
			}

		},

		'plugin-builder': pluginBuilder,
		'pluginBuilder': pluginBuilder

	});

})(this);
