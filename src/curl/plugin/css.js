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
 * cssNoWait: Boolean. You can instruct this plugin to not wait
 * for any css resources. They'll get loaded asap, but other code won't wait
 * for them.
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
 *      require(['css!myWidget']);
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
		createStyleSheet = 'createStyleSheet',
		parentNode = 'parentNode',
		setTimeout = global.setTimeout,
		nonNetworkUri = 'about:blank',
		nonNetworkUri_bad = 'about:_curl_',
		pluginBuilder = './builder/css',
		// doc will be undefined during a build
		doc = global.document,
		// find the head element and set it to it's standard property if nec.
		head,
		// serious inference here, need something better:
		shouldCollectSheets = doc && doc[createStyleSheet] && !doc.addEventListener,
		ieCollectorLinks = [],
		loadSheet,
		urlAnchor,
		msgHttp = 'HTTP or network error.',
		hasEvent = { links: {} };

	if (doc) {
		head = doc.head || (doc.head = doc.getElementsByTagName('head')[0]);
		if (shouldCollectSheets) {
			loadSheet = loadImport;
			urlAnchor = doc.createElement('a');
		}
		else {
			// the following code attempts to pre-determine if the browser supports
			// onload and onerror event handlers. None of these work in Opera.
			// success: Chrome, FF13, IE6-9
			testLinkEvent('load', nonNetworkUri);
			// success: Chrome only
			testLinkEvent('error', nonNetworkUri_bad, true);
			// FF and Chrome fire onerror on this one, but Safari and Opera scream loudly (in Net tab)
			//testLinkEvent('error', 'javascript:');
			// FF and chrome also fire onerror here, but Safari and Opera scream loudly (in Net tab)
			//testLinkEvent('error', 'data:text/css;base64,_');
			// FF correctly fails here (protocol error) and Safari doesn't scream, yay:
			testLinkEvent('error', 'data:text/text,');
			loadSheet = loadLink;
		}
	}

	function testLinkEvent (event, page, keep) {
		var link;
		link = hasEvent.links[event] = createLink();
		link['on' + event] = function () { setLoadDetection(event, true); };
		link.href = page;
		head.appendChild(link);
		if (!keep) setTimeout(function () { head.removeChild(link); }, 50);
		return link;
	}

	function setLoadDetection (event, hasNative, name) {
		hasEvent[event] = hasEvent[event] || hasNative;
	}

	function createLink () {
		var link;
		link = doc[createElement]('link');
		link.rel = "stylesheet";
		link.type = "text/css";
		return link;
	}

	/***** ie load functions *****/

	/**
	 * Loads a stylesheet via IE's addImport() method, which is the only
	 * way to detect both onload and onerror in IE.  The tricky part is
	 * that IE does not indicate which @import'ed sheet is being loaded.
	 * @private
	 * @param url {String}
	 * @param cb {Function}
	 * @param eb {Function}
	 */
	function loadImport (url, cb, eb) {
		// IE needs a url with a protocol or it won't fire events
		url = toAbsUrl(url);
		function error () {
			eb(new Error(msgHttp));
		}
		getCollectorLink(function (link) {
			waitForLink(link, function (link) {
				var sheet;
				// check that this url wasn't already added (otherwise events won't fire)
				// TODO: do this without noticeable turds (in IE inspector)
				if (url in link) {
					link[url] ? cb() : error();
				}
				else {
					// set new callbacks
					link.onload = function () {
						link[url] = true;
						finalize(link);
						console.log(url);
						cb();
					};
					link.onerror = function () {
						link[url] = false;
						finalize(link);
						console.log('error', ' ', url);
						error();
					};
					// import sheet into collector stylesheet
					sheet = link.styleSheet;
					sheet.addImport(url);
				}
			});
		});
	}

	function waitForLink (link, cb) {
		if (isFinalized(link)) {
			cb(link);
		}
		else {
			link.onload = chain(link, link.onload, cb);
			link.onerror = chain(link, link.onerror, cb);
		}
	}

	function chain (link, func, cb) {
		return function (e) {
			func(e);
			cb(link);
			// IE chokes if stylesheets are built too quickly
			//setTimeout(function () { cb(link); }, 10);
		};
	}

	function toAbsUrl (url) {
		urlAnchor.href = url;
		return urlAnchor.href;
	}

	/**
	 * Gets the next collector sheet in the collection.  If a collector sheet
	 * is full, a new one is created.  The callback is called when the sheet
	 * is ready.
	 * @param cb {Function} function (sheet) {}
	 */
	function getCollectorLink (cb) {
		var pos, link;
		pos = ieCollectorLinks.length - 1;
		link = ieCollectorLinks[pos];
		if (link && link.styleSheet.imports.length > 29) {
			pos++;
		}
		if (pos == ieCollectorLinks.length) {
			link = ieCollectorLinks[pos] = createLink();
			link.href = nonNetworkUri /*+ '?' + pos*/;
			link.onload = function () { finalize(link); cb(link); };
			head.appendChild(link);
		}
		else {
			cb(link);
		}
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

	/***** load functions for all other browsers *****/

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
					sheet.insertRule('-curl-css-test {}', 0);
					sheet.deleteRule(0);
					ready = true;
					setLoadDetection('load', false);
				}
			}
		}
		catch (ex) {
			// a "security" or "access denied" error indicates that an XD
			// stylesheet has been successfully loaded in old FF
			ready = /security|denied/i.test(ex.message);
			if (ready) setLoadDetection('load', false);
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
			// (doesn't seem to fire events)
			img = document[createElement]('img');
			img.onerror = img.onload = function () {
				setTimeout(function () {
					if (!hasEvent['error'] && !isFinalized(link)) eb();
				}, 10); // a wee bit more time to process sheet
			};
			img.src = link.href;
		}, wait);
	}

	function linkLoaded (link, wait, cb) {
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

	function linkErrored (link, cb) {
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
			cb(new Error(msgHttp));
		}
		// always try standard handler
		errorHandler(link, error);
		// if we are not sure if the native error event works, try the fallback
		errorWatcher(link, 500, error);
	}

	function loadLink (url, cb, eb, period) {
		var link;
		link = createLink();
		linkLoaded(link, period, cb);
		linkErrored(link, eb);
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
