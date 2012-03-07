/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl ssjs shim
 * Modifies curl to work as an AMD loader function in server-side
 * environments such as RingoJS, Rhino, and NodeJS.
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */
define.amd.node = define.amd.ringo = define.amd.rhino = true;
(function (freeRequire, globalLoad) {
define(function (require, exports) {
"use strict";

	var priv, http, localLoadFunc, remoteLoadFunc;

	priv = require('curl/_privileged');

	// sniff for capabilities
	if (freeRequire) {
		localLoadFunc = loadScriptViaRequire;
		// try to find an http client
		try {
			http = freeRequire('http'); // node
			remoteLoadFunc = loadScriptViaNodeHttp;
		}
		catch (ex) {
			http = freeRequire('ringo/httpclient'); // ringo
			remoteLoadFunc = loadScriptViaRingoHttp;
		}
		
	}
	else if (globalLoad) {
		localLoadFunc = remoteLoadFunc = loadScriptViaLoad;
	}

	function stripExtension (url) {
		return url.replace(/\.js$/, '');
	}

	priv.core.loadScript = function (def, success, fail) {
		var urlOrPath;
		// figure out if this is local or remote and call appropriate function
		// remote urls always have a protocol or a // at the beginning
		urlOrPath = def.url;
		if (/^\/\//.test(urlOrPath)) {
			// if there's no protocol, i guess we should assume http?
			// TODO: make this configurable somehow
			def.url = 'http:' + def.url;
		}
		if (/^\w+:/.test(def.url)) {
			return remoteLoadFunc(def, success, fail);
		}
		else {
			return localLoadFunc(def, success, fail);
		}
	};

	function loadScriptViaLoad (def, success, fail) {
		try {
			globalLoad(def.url);
			success();
		}
		catch (ex) {
			fail(ex);
		}
	}

	function loadScriptViaRequire (def, success, fail) {
		var modulePath;
		try {
			modulePath = stripExtension(def.url);
			freeRequire(modulePath);
			success();
		}
		catch (ex) {
			fail(ex);
		}
	}

	function loadScriptViaNodeHttp (def, success, fail) {
		var options;
		// Note: the next line also checks for protocol-less urls: TODO: consolidate?
		options = freeRequire('url').parse(def.url, false, true);
		http.get(options, success).on('error', fail);
	}

	function loadScriptViaRingoHttp (def, success, fail) {
		http.get(def.url, '', success, fail);
	}

});
}(require, load));
