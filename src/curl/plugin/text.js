/**
 * curl text loader plugin
 *
 * (c) copyright 2011, unscriptable.com
 *
 * TODO: load xdomain text, too
 * 
 */

define(function () {

//	function isXDomain (url, doc) {
//		// using rules at https://developer.mozilla.org/En/Same_origin_policy_for_JavaScript
//		// Note: file:/// urls are not handled by this function!
//		// See also: http://en.wikipedia.org/wiki/Same_origin_policy
//		if (!/:\/\/|^\/\//.test(url)) {
//			// relative urls are always same domain, duh
//			return false;
//		}
//		else {
//			// same domain means same protocol, same host, same port
//			// exception: document.domain can override host (see link above)
//			var loc = doc.location,
//				parts = url.match(/([^:]+:)\/\/([^:\/]+)(?::([^\/]+)\/)?/);
//			return (
//				loc.protocol !== parts[1] ||
//				(doc.domain !== parts[2] && loc.host !== parts[2]) ||
//				loc.port !== (parts[3] || '')
//			);
//		}
//	}

	var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];

	function xhr () {
		if (typeof XMLHttpRequest !== "undefined") {
			// rewrite the getXhr method to always return the native implementation
			xhr = function () { return new XMLHttpRequest(); };
		}
		else {
			// keep trying progIds until we find the correct one, then rewrite the getXhr method
			// to always return that one.
			var noXhr = xhr = function () {
					throw new Error("getXhr(): XMLHttpRequest not available");
				};
			while (progIds.length > 0 && xhr === noXhr) (function (id) {
				try {
					new ActiveXObject(id);
					xhr = function () { return new ActiveXObject(id); };
				}
				catch (ex) {}
			}(progIds.shift()));
		}
		return xhr();
	}

	function fetchText (url, callback, errback) {
		var x = xhr();
		x.open('GET', url, true);
		x.onreadystatechange = function (e) {
			if (x.readyState === 4) {
				if (x.status < 400) {
					callback(x.responseText);
				}
				else {
					errback(new Error('fetchText() failed. status: ' + x.statusText));
				}
			}
		};
		x.send(null);
	}

	return {

		load: function (resourceName, require, callback, config) {
			// remove suffixes (future)
			// hook up callbacks
			var cb = callback.resolve || callback,
				eb = callback.reject || function () {};
			// get the text
			fetchText(resourceName, cb, eb);
		}

	};

});
