/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl dojo 1.7 shim
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

/**
 * dojo 1.7 does some unique things with its loader.  This shim helps handle
 * those things.
 *
 * usage:
 *  curl({
 *  	preload: ['curl/shim/dojo17'],
 * 		package: { ... }
 *  }, ['dojo/parser'], function (parser) {
 *  	parser.parse();
 *  });
 *
 */
define(/*=='curl/shim/dojo17',==*/ ['curl/_privileged', './dojo16'], function (priv) {
	"use strict";

	var orig, dojoDetectorRx;

	orig = priv['core'].handleDepCycle;

	dojoDetectorRx = /^dojo\//;

	// in addition to expecting a require.ready function on the loader
	// (see dojo16 shim), dojo 1.7 has a wholly unnecessary dependency cycle
	// that the dojo loader resolves in a very janky way.

	priv['core'].handleDepCycle = function (defs, earlyExport, failure) {
		// don't resolve def since other modules that aren't in the
		// cycle (and aren't coded to handle a cycle) could be waiting
		// call earlyExport instead so that the currently waiting module
		// can have something to work with.  iiuc, this is roughly how the
		// dojo loader works.
		var parent = defs[0], dep = defs[1];
		if (dojoDetectorRx.test(dep.id)) {
			if (dep.ctx.useExports && (!parent || parent.ctx.useExports)) {
				earlyExport(dep.ctx.cjsVars.exports);
			}
			else {
				// wait until another time when the dep uses exports!
				// this could be using entirely different modules in the cycle.
			}
		}
		else {
			orig(defs, earlyExport, failure);
		}
	};

	return true;

});
