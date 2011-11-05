/**
 * curl/jQuery17Compat
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * Until AMD becomes well established, there will be issues with the various
 * libs.  This one overcomes some minor issues with jQuery 1.7's initial
 * foray into AMD territory. :)
 *
 * Problem #1 with jQuery-1.7: jQuery defines itself too soon. Code that uses
 * anything after jQuery's call to define() is undefined! Examples:
 * jQuery.Callbacks, jQuery.Deferred, jQuery.when, jQuery.support, etc.
 * Almost all of jQuery is undefined at the time define() is called!
 *
 * For this compatibility shim to work, the jquery file must declare itself
 * to AMD by calling `define('jquery', [], jQuery)`.  The id is mandatory
 * so that this shim can find any/all references to jQuery and organize them
 * by version.  The deps array is optional. Also: a function can be used in
 * place of the jQuery object (last parameter).  In this case, the function
 * must return an instance of jQuery.  jQuery 1.7 uses a function as the last
 * parameter.
 *
 * If you wish to use jQuery versions less than 1.7, just append the following
 * line to the end of the jQuery.js file:
 * define('jquery', $);
 *
 * If optimizing/compressing files, be sure to process this file simultaneously
 * with the main curl file or references to privileged methods in the code below
 * may be mangled.
 *
 *  usage:
 *  curl({ preloads: ['curl/jQuery17Compat'] }, ['js/jquery'], function ($) {
 *  	$('P').append(' w00t!');
 *  });
 *
 * usage:
 *  curl(['curl/jQuery17Compat']).then(['jQuery/jquery'], function ($) {
 *  	$('P').append(' w00t!');
 *  });
 *
 */

define(/*=='curl/jQuery17Compat',==*/ ['curl/_privileged'], function (priv) {
	var origResolveResDef;

	origResolveResDef = priv['core'].resolveResDef;

	priv['core'].resolveResDef = function (def, args) {
		var a = arguments;

		// only delay if this is actually jquery
		if ('jquery' == def.id) {
			setTimeout(function () {
				origResolveResDef.apply(this, a)
			}, 0);
		}
		else {
			origResolveResDef.apply(this, a);
		}
	};

	return true;
});

// TODO: implement package Mappings which will allow libs/modules to specify which jQuery they want

//define(/*=='curl/jQuery17Compat',==*/ ['curl/_privileged'], function (curl) {
//	var _define, fetchDep, ResourceDef, jqs, first;
//
//	// save original _define and fetchDep
//	_define = curl['_define'];
//	fetchDep = curl.core.fetchDep;
//	ResourceDef = curl.core.ResourceDef;
//
//	// cache all jQuery versions
//	jqs = {};
//
//	// duck-punch _define
//	curl.core._define = function (args) {
//		if ("jquery" == args.id && args.res) {
//			var jq;
//
//			// grab jquery
//			jq = args.res();
//
//			// remove it from global scope
//			jq = jq.noConflict(true);
//
//			// cache this version of jQuery as a ResourceDef
//			jqs[jq.fn.jquery] = jq;
//
//			// if this is the first jQuery, keep it
//			if (!first) first = jq;
//
//			// do we need to keep the id???
//			delete args.id;
//		}
//		_define(args);
//	};
//
//	// duck-punch fetchDep to look for jQuery
//	curl.core.fetchDep = function (id, ctx) {
//		// TODO: get package config
//		var jq, cfg = {};
//		if ('jquery' == id) {
//			jq = cfg.jQueryVersion ? jqs[cfg.jQueryVersion] : first;
//			if (!jq) {
//				throw new Error('jQuery version not found: ' + cfg.jQueryVersion);
//			}
//			return jq;
//		}
//	};
//
//	return true;
//});
