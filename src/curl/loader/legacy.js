/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl legacy loader
 */

/**
 * TODO: code docs
 */
(function (global, doc, testGlobalVar) {
define(/*=='curl/loader/legacy',==*/ ['curl/_privileged'], function (priv) {
"use strict";
	var hasAsyncFalse, loadScript, dontAddExtRx;

	hasAsyncFalse = doc && doc.createElement('script').async == true;
	loadScript = priv['core'].loadScript;
	dontAddExtRx = /\?|\.js\b/;

	return {

		'load': function (resId, require, callback, cfg) {
			var exports, deps, dontAddFileExt, url, options, countdown;

			exports = cfg['exports'] || cfg.exports;
			if (!exports) {
				throw new Error('`exports` required for legacy: ' + resId);
			}

			deps = [].concat(cfg['requires'] || cfg.requires || []);
			dontAddFileExt = cfg['dontAddFileExt'] || cfg.dontAddFileExt;
			dontAddFileExt = dontAddFileExt
				? new RegExp(dontAddFileExt)
				: dontAddExtRx;
			url = require['toUrl'](resId);

			if (!dontAddFileExt.test(url)) {
				url = nameWithExt(url, 'js');
			}

			options = {
				url: url,
				order: true,
				// set a fake mimetype if we need to wait and don't support
				// script.async=false.
				mimetype:  hasAsyncFalse || !deps.length ? '' : 'text/cache'
			};

			// hasAsyncFalse, nodeps: load | _export
			// hasAsyncFalse, deps: getDeps+load | _export
			// !hasAsyncFalse, nodeps: load | _export
			// !hasAsyncFalse, deps: getDeps+load | reload | _export

			if (deps.length) {
				countdown = 2;
				getDeps();
				load();
			}
			else {
				countdown = 1;
				load();
			}

			function getDeps () {
				// start process of getting deps, then either export or reload
				require(deps, hasAsyncFalse ? _export : reload, reject);
			}

			function load () {
				// load script, possibly with a fake mimetype
				loadScript(options, _export, reject);
			}

			function reload () {
				// if we faked the mimetype, we need to refetch.
				// (hopefully, from cache, if cache headers allow.)
				options.mimetype = '';
				loadScript(options, _export, reject);
			}

			function _export () {
				if (--countdown > 0) return;
				try {
					callback(testGlobalVar(exports));
				}
				catch (ex) {
					reject(new Error ('Failed to find exports ' + exports + ' for legacy ' + resId));
				}
			}

			function reject (ex) {
				(callback['error'] || function (ex) { throw ex; })(ex);
			}

		},

		'cramPlugin': '../cram/legacy'

	};

	function nameWithExt (name, defaultExt) {
		return name.lastIndexOf('.') <= name.lastIndexOf('/') ?
			name + '.' + defaultExt : name;
	}

});
}(
	this,
	this.document,
	function () { return (1, eval)(arguments[0]); }
));
