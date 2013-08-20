/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl CommonJS Modules/1.1 loader
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

(function (global, document, globalEval) {

define(/*=='curl/loader/cjsm11',==*/ ['../plugin/_fetchText', 'curl/_privileged'], function (fetchText, priv) {

	var head, insertBeforeEl, extractCjsDeps, checkToAddJsExt;

	head = document && (document['head'] || document.getElementsByTagName('head')[0]);
	// to keep IE from crying, we need to put scripts before any
	// <base> elements, but after any <meta>. this should do it:
	insertBeforeEl = head && head.getElementsByTagName('base')[0] || null;

	extractCjsDeps = priv['core'].extractCjsDeps;
	checkToAddJsExt = priv['core'].checkToAddJsExt;

	function wrapSource (source, resourceId, fullUrl) {
		var sourceUrl = fullUrl ? '/*\n////@ sourceURL=' + fullUrl.replace(/\s/g, '%20') + '.js\n*/' : '';
		return "define('" + resourceId + "'," +
			"['require','exports','module'],function(require,exports,module){" +
			source + "\n});\n" + sourceUrl + "\n";
	}

	var injectSource = function (el, source) {
		// got this from Stoyan Stefanov (http://www.phpied.com/dynamic-script-and-style-elements-in-ie/)
		injectSource = ('text' in el) ?
			function (el, source) { el.text = source; } :
			function (el, source) { el.appendChild(document.createTextNode(source)); };
		injectSource(el, source);
	};

	function injectScript (source) {
		var el = document.createElement('script');
		injectSource(el, source);
		el.charset = 'utf-8';
		head.insertBefore(el, insertBeforeEl);
	}

	wrapSource['load'] = function (resourceId, require, callback, config) {
		var errback, url, sourceUrl;

		errback = callback['error'] || function (ex) { throw ex; };
		url = checkToAddJsExt(require.toUrl(resourceId), config);
		sourceUrl = config['injectSourceUrl'] !== false && url;

		fetchText(url, function (source) {
			var moduleMap;

			// find (and replace?) dependencies
			moduleMap = extractCjsDeps(source);

			// get deps
			require(moduleMap, function () {


				// wrap source in a define
				source = wrapSource(source, resourceId, sourceUrl);

				if (config['injectScript']) {
					injectScript(source);
				}
				else {
					//eval(source);
					globalEval(source);
				}

				// call callback now that the module is defined
				callback(require(resourceId));

			}, errback);
		}, errback);
	};

	wrapSource['cramPlugin'] = '../cram/cjsm11';

	return wrapSource;

});

}(this, this.document, function () { /* FB needs direct eval here */ eval(arguments[0]); }));
