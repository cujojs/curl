/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl worker shim
 *
 * Modifies curl to work in a WebWorker environment
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

define(/*=='curl/shim/worker',==*/ ['curl/_privileged'], function (priv) {
"use strict";
	if (typeof window == 'object' || typeof self == 'undefined' || !self.importScripts) {
		return;
	}

	priv['core'].loadScript = function (def, success, failure) {
		try {
			importScripts(def.url);
		} catch (e) {
			failure(new Error('Syntax or http error: ' + def.url));
		}
		success();
	}
});