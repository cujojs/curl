/**
 * curl (cujo resource loader)
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

(function (global, doc, userCfg) {

	/*
	 * Overall operation:
	 * When a dependency is encountered and it already exists, it's returned.
	 * If it doesn't already exist, it is created and the dependency's script
	 * is loaded. If there is a define call in the loaded script with a id,
	 * it is resolved asap (i.e. as soon as the dependency's dependencies are
	 * resolved). If there is a (single) define call with no id (anonymous),
	 * the resource in the resNet is resolved after the script's onload fires.
	 * IE requires a slightly different tactic. IE marks the readyState of the
	 * currently executing script to 'interactive'. If we can find this script
	 * while a define() is being called, we can match the define() to its id.
	 * Opera marks scripts as 'interactive' but at inopportune times so we
	 * have to handle it specifically.
	 */

	/*
	 * Paths in 0.6:
	 * Use cases (most common first):
	 * -  "my package is located at this url" (url / location or package)
	 * -  "I want all text! plugins to use the module named x/text" (module id)
	 * -  "I want calls to 'x/a' from one package to reference 'x1.5/x/a' but
	 *    calls to 'x/a' from another package to reference 'x1.6/x/a'"
	 *    (url/location)
	 * -  "I want to alias calls to a generic 'array' module to the module
	 *     named 'y/array'" (module id) (or vice versa. see chat with JD Dalton)
	 * -  "I want to alias calls to 'my/array' to 'y/array'" (module id)
	 * -  "I want to use root paths like in node.js ("/x/b" should be the same
	 *    as "x/b" unless we implement a way to have each package specify its
	 *    relative dependency paths)
	 */

	var
		version = '0.5.4dev',
		head = doc['head'] || doc.getElementsByTagName('head')[0],
		// local cache of resource definitions (lightweight promises)
		cache = {},
		// net to catch anonymous define calls' arguments (non-IE browsers)
		argsNet,
		// this is the list of scripts that IE is loading. one of these will
		// be the "interactive" script. too bad IE doesn't send a readystatechange
		// event to tell us exactly which one.
		activeScripts = {},
		// these are always handy :)
		toString = ({}).toString,
		undef,
		aslice = [].slice,
		// RegExp's used later, "cached" here
		absUrlRx = /^\/|^[^:]+:\/\//,
		normalizeRx = /^(\.)(\.)?(\/|$)/,
		findSlashRx = /\//g,
		dontAddExtRx = /\?/,
		//pathSearchRx,
		// script ready states that signify it's loaded
		readyStates = { 'loaded': 1, 'interactive': 1, 'complete': 1 },
		orsc = 'onreadystatechange',
		core;

	function isType (obj, type) {
		return toString.call(obj).indexOf('[object ' + type) == 0;
	}

	function normalizePkgDescriptor (descriptor) {

		descriptor.path = descriptor['path'] || '';
		descriptor.config = descriptor['config'];

		function normalizePkgPart (partName) {
			var path, part;
			if (partName in descriptor) {
				part = descriptor[partName];
				if (part.charAt(0) != '.') {
					// prefix with path
					path = joinPath(descriptor.path, part);
				}
				else {
					// use normal . and .. path processing
					path = core.normalizeName(part, descriptor.path);
				}
				return removeEndSlash(path);
			}
		}
		descriptor.lib = normalizePkgPart('lib');
		descriptor.main = normalizePkgPart('main');

		return descriptor;
	}

	function noop () {}

	function endsWithSlash (str) {
		return str.charAt(str.length - 1) == '/';
	}

	function joinPath (path, file) {
		return (!path || endsWithSlash(path) ? path : path + '/') + file;
	}

	function removeEndSlash (path) {
		return endsWithSlash(path) ? path.substr(0, path.length - 1) : path;
	}

	function Begetter () {}

	function beget (parent) {
		Begetter.prototype = parent;
		var child = new Begetter();
		Begetter.prototype = undef;
		return child;
	}

	function Promise (id) {

		var self = this,
			thens = [];

		this.id = id; // for ResourceDefs

		function then (resolved, rejected) {
			// capture calls to callbacks
			thens.push([resolved, rejected]);
		}

		function resolve (val) { complete(true, val); }

		function reject (ex) { complete(false, ex); }

		function complete (success, arg) {
			// switch over to sync then()
			then = success ?
				function (resolve, reject) { resolve && resolve(arg); } :
				function (resolve, reject) { reject && reject(arg); };
			// disallow multiple calls to resolve or reject
			resolve = reject =
				function () { throw new Error('Promise already completed.'); };
			// complete all callbacks
			var aThen, cb, i = 0;
			while ((aThen = thens[i++])) {
				cb = aThen[success ? 0 : 1];
				if (cb) cb(arg);
			}
		}

		this.then = function (resolved, rejected) {
			then(resolved, rejected);
			return self;
		};
		this.resolve = function (val) {
			self.resolved = val;
			resolve(val);
		};
		this.reject = function (ex) {
			self.rejected = ex;
			reject(ex);
		};

	}

	var ResourceDef = Promise; // subclassing isn't worth the extra bytes

	function when (promiseOrValue, callback, errback) {
		// we can't just sniff for then(). if we do, resources that have a
		// then() method will make dependencies wait!
		if (promiseOrValue instanceof Promise) {
			promiseOrValue.then(callback, errback);
		}
		else {
			callback(promiseOrValue);
		}
	}

	core = {

		extractCfg: function extractCfg (cfg) {
			var pluginCfgs;

			// set defaults and convert from non-closure-safe names
			cfg.baseUrl = cfg['baseUrl'] || '';
			cfg.pluginPath = cfg['pluginPath'] || 'curl/plugin';
			pluginCfgs = cfg.plugins = cfg['plugins'] || {};

			// create object to hold path map.
			// each plugin and package will have its own pathMap, too.
			if (!cfg.pathMap) cfg.pathMap = {};
			if (!userCfg.plugins) userCfg.plugins = userCfg['plugins'] || {};

			// temporary arrays of paths. this will be converted to
			// a regexp for fast path parsing.
			cfg.pathList = [];

			// normalizes path/package info and places info on either
			// the global cfg.pathMap or on a plugin-specific altCfg.pathMap.
			// also populates a pathList on cfg or plugin configs.
			function fixAndPushPaths (coll, isPkg) {
				var id, prefixPos, prefix, currCfg, info;
				for (var name in coll) {
					currCfg = cfg;
					// grab the package id, if specified. default to
					// property name.
					id = removeEndSlash(coll[name]['id'] || name);
					prefixPos = id.indexOf('!');
					if (prefixPos > 0) {
						// plugin-specific path
						prefix = id.substr(0, prefixPos);
						if (!pluginCfgs[prefix]) {
							currCfg = pluginCfgs[prefix] = beget(cfg);
							currCfg.pathMap = beget(cfg.pathMap);
							currCfg.pathList = [];
						}
						// remove prefix from id
						id = id.substr(prefixPos + 1);
					}
					if (isPkg) {
						info = normalizePkgDescriptor(coll[name]);
					}
					else {
						info = { path: removeEndSlash(coll[name]) };
					}
					info.specificity = (id.match(findSlashRx) || []).length;
					if (id) {
						currCfg.pathMap[id] = info;
						currCfg.pathList.push(id);
					}
					else {
						// naked plugin name signifies baseUrl for plugin
						// resources. baseUrl could be relative to global
						// baseUrl.
						currCfg.baseUrl = core.resolveUrl(coll[name], cfg);
					}
				}
			}

			// adds the path matching regexp ono the cfg or plugin cfgs.
			function convertPathMatcher (cfg) {
				var pathList = cfg.pathList, pathMap = cfg.pathMap;
				cfg.pathRx = new RegExp('^(' +
					pathList.sort(function (a, b) { return pathMap[a].specificity < pathMap[b].specificity; } )
						.join('|')
						.replace(/\//g, '\\/') +
					')(?=\\/|$)'
				);
				delete cfg.pathList;
			}

			// fix all paths and packages
			fixAndPushPaths(cfg['paths'], false);
			fixAndPushPaths(cfg['packages'], true);

			// create search regex for each path map
			for (var p in pluginCfgs) {
				var pathList = pluginCfgs[p].pathList;
				if (pathList) {
					pluginCfgs[p].pathList = pathList.concat(cfg.pathList);
					convertPathMatcher(pluginCfgs[p]);
				}
			}
			convertPathMatcher(cfg);

		},

		begetCtx: function (absId, cfg) {

			function toUrl (n) {
				var path = core.resolvePathInfo(core.normalizeName(n, baseId), cfg).path;
				return core.resolveUrl(path, cfg);
			}

			var baseId = absId.substr(0, absId.lastIndexOf('/')),
				ctx = {
					baseId: baseId
				},
				exports = {},
				require = function (deps, callback) {
					return _require(deps, callback || noop, ctx);
				};
			// CommonJS Modules 1.1.1 and node.js helpers
			ctx.cjsVars = {
				'exports': exports,
				'module': {
					'id': absId,
					'uri': toUrl(absId),
					'exports': exports
				}
			};

			ctx.require = ctx.cjsVars['require'] = require;
			// using bracket property notation so closure won't clobber id
			require['toUrl'] = toUrl;

			return ctx;
		},

		resolvePathInfo: function (id, cfg) {
			// TODO: figure out why this gets called so often for the same file
			// searches through the configured path mappings and packages
			// if the resulting module is part of a package, also return the main
			// module so it can be loaded.
			var pathMap, pathInfo, path, config, found;

			pathMap = cfg.pathMap;

			path = id.replace(cfg.pathRx, function (match) {

				pathInfo = pathMap[match] || {};
				found = true;
				config = pathInfo.config;

				// if pathInfo.main and match == id, this is a main module
				if (pathInfo.main && match == id) {
					return pathInfo.main;
				}
				// if pathInfo.lib return pathInfo.lib
				else {
					return pathInfo.lib || pathInfo.path || '';
				}

			});

			return {
				path: path,
				config: config
			};
		},

		resolveUrl: function (path, cfg, addExt) {
			var baseUrl = cfg.baseUrl;
			return (baseUrl && !absUrlRx.test(path) ? joinPath(baseUrl, path) : path) + (addExt && !dontAddExtRx.test(path) ? '.js' : '');
		},

		loadScript: function (def, success, failure) {
			// script processing rules learned from RequireJS

			// insert script
			var el = doc.createElement('script');

			// initial script processing
			function process (ev) {
				ev = ev || global.event;
				// detect when it's done loading
				if (ev.type === 'load' || readyStates[this.readyState]) {
						delete activeScripts[def.id];
					// release event listeners
					this.onload = this[orsc] = this.onerror = null;
					success(el);
				}
			}

			function fail (e) {
				// some browsers send an event, others send a string,
				// but none of them send anything useful, so just say we failed:
				failure(new Error('Syntax error or http error: ' + def.url));
			}

			// set type first since setting other properties could
			// prevent us from setting this later
			el.type = 'text/javascript';
			// using dom0 event handlers instead of wordy w3c/ms
			el.onload = el[orsc] = process;
			el.onerror = fail;
			el.charset = def.charset || 'utf-8';
			el.async = true;
			el.src = def.url;

			// loading will start when the script is inserted into the dom.
			// IE will load the script sync if it's in the cache, so
			// indicate the current resource definition if this happens.
				activeScripts[def.id] = el;
			// use insertBefore to keep IE from throwing Operation Aborted (thx Bryan Forbes!)
			head.insertBefore(el, head.firstChild);

		},

		fixArgs: function (args) {
			// resolve args
			// valid combinations for define:
			// (string, array, object|function) sax|saf
			// (array, object|function) ax|af
			// (string, object|function) sx|sf
			// (object|function) x|f

			var id, deps, definition, isDefFunc, len = args.length;

			definition = args[len - 1];
			isDefFunc = isType(definition, 'Function');

			if (len == 2) {
				if (isType(args[0], 'Array')) {
					deps = args[0];
				}
				else {
						id = args[0];
				}
			}
			else if (len == 3) {
					id = args[0];
				deps = args[1];
			}

			// mimic RequireJS's assumption that a definition function with zero
			// dependencies and non-zero arity is a wrapped CommonJS module
			if (!deps && isDefFunc && definition.length > 0) {
				deps = ['require', 'exports', 'module'];
			}

			return {
				id: id,
				deps: deps || [],
				res: isDefFunc ? definition : function () { return definition; }
			};
		},

		resolveResDef: function (def, args) {

			// if a module id has been remapped, it will have a baseId
			// TODO: does the context's config need to be passed in somehow?
			var childCtx = core.begetCtx(def.baseId || def.id, userCfg);

			// get the dependencies and then resolve/reject
			core.getDeps(def, args.deps, childCtx,
				function (deps) {
					var res;
					try {
						// node.js assumes `this` === exports.
						// anything returned overrides exports.
						// uses module.exports if nothing returned (node.js
						// convention). exports === module.exports unless
						// module.exports was reassigned.
						res = args.res.apply(childCtx.cjsVars['exports'], deps) ||
							childCtx.cjsVars['module']['exports'];
					}
					catch (ex) {
						def.reject(ex);
					}
					cache[def.id] = res; // replace ResourceDef with actual value
					def.resolve(res);
				},
				def.reject
			);

		},

		fetchResDef: function (def) {

			core.loadScript(def,

				function () {
					var args = argsNet;
					argsNet = undef; // reset it before we get deps

					// if our resource was not explicitly defined with a id (anonymous)
					// Note: if it did have a id, it will be resolved in the define()
					if (def.useNet !== false) {

						if (!args) {
							// uh oh, nothing was added to the resource net
							def.reject(new Error('define() not found or duplicates found: ' + def.url));
						}
						else if (args.ex) {
							// the resNet resource was already rejected, but it didn't know
							// its id, so reject this def now with better information
							def.reject(new Error(args.ex.replace('${url}', def.url)));
						}
						else {
								core.resolveResDef(def, args);
						}
					}

				},

				def.reject

			);

			return def;

		},

		normalizeName: function (id, basePath) {
			// if id starts with . then use parent's id as a base
			// if id starts with .. then use parent's parent
			return id.replace(normalizeRx, function (match, dot1, dot2) {
				return (dot2 ? basePath.substr(0, basePath.lastIndexOf('/')) : basePath) + '/';
			});
		},

		fetchDep: function (depName, ctx) {
			var fullId, delPos, loaderId, pathMap, resId, loaderInfo, pathInfo, def, cfg;

			pathMap = userCfg.pathMap;
			// check for plugin loaderId
			delPos = depName.indexOf('!');
			if (delPos >= 0) {
				// obtain absolute id of resource
				resId = core.normalizeName(depName.substr(delPos + 1), ctx.baseId);
				// get plugin info
				loaderId = depName.substr(0, delPos);
				// allow plugin-specific path mappings
				cfg = userCfg.plugins[loaderId] || userCfg;
				// prepend plugin folder path, if it's missing and path isn't in pathMap
				loaderInfo = core.resolvePathInfo(loaderId, userCfg);
				if (loaderInfo.path.indexOf('/') < 0) {
					loaderInfo = core.resolvePathInfo(joinPath(userCfg.pluginPath, loaderInfo.path), userCfg);
				}
			}
			else {
				// get path information for this resource
				resId = core.normalizeName(depName, ctx.baseId);
				pathInfo = core.resolvePathInfo(resId, userCfg);
				// get custom module loader from package config
				cfg = pathInfo.config || userCfg;
				loaderId = cfg.moduleLoader;
				loaderInfo = loaderId && core.resolvePathInfo(loaderId, cfg);
			}

			if (loaderId) {

				// fetch plugin or loader
				var loaderDef = cache[loaderId];
				if (!loaderDef) {
					loaderDef = cache[loaderId] = new ResourceDef(loaderId);
					loaderDef.url = core.resolveUrl(loaderInfo.path, userCfg, true);
					loaderDef.baseId = loaderInfo.path; // TODO: does baseId have to be normalized?
					core.fetchResDef(loaderDef);
				}

				function toAbsId (id) {
					return core.normalizeName(id, ctx.baseId);
				}

				// we need to use depName until plugin tells us normalized id.
				// if the plugin changes the id, we need to consolidate
				// def promises below.
				def = new ResourceDef(depName);

				when(loaderDef,
					function (plugin) {
						var childCtx, normalizedDef;

						//resName = depName.substr(delPos + 1);
						// check if plugin supports the normalize method
						if ('normalize' in plugin) {
							resId = plugin['normalize'](resId, toAbsId, cfg);
						}

						// plugin may have its own pathMap (plugin-specific paths)
						childCtx = core.begetCtx(resId, cfg);

						// the spec is unclear, so we're using the full id (loaderId + id) to id resources
						// so multiple plugins could each process the same resource
						fullId = loaderId + '!' + resId;
						normalizedDef = cache[fullId];

						// if this is our first time fetching this (normalized) def
						if (!normalizedDef) {

							normalizedDef = new ResourceDef(fullId);

							// resName could be blank if the plugin doesn't specify an id (e.g. "domReady!")
							// don't cache non-determinate "dynamic" resources (or non-existent resources)
							if (resId && !plugin['dynamic']) {
								cache[fullId] = normalizedDef;
							}

							// curl's plugins prefer to receive the back-side of a promise,
							// but to be compatible with commonjs's specification, we have to
							// piggy-back on the callback function parameter:
							var loaded = function (res) {
								cache[fullId] = res;
								normalizedDef.resolve(res);
							};
							// using bracket property notation so closure won't clobber id
							loaded['resolve'] = loaded;
							loaded['reject'] = normalizedDef.reject;

							// load the resource!
							plugin.load(resId, childCtx.require, loaded, cfg);

						}

						// chain defs (resolve when plugin.load executes)
						when(normalizedDef, def.resolve, def.reject);

					},
					def.reject
				);

			}
			else {
				def = cache[resId];
				if (!def) {
					def = cache[resId] = new ResourceDef(resId);
					def.url = core.resolveUrl(pathInfo.path, cfg, true);
					core.fetchResDef(def);
				}

			}

			return def;
		},

		getDeps: function (def, names, ctx, success, failure) {
			var deps = [],
				count = names.length,
				len = count,
				completed = false;

			// obtain each dependency
			// Note: IE may have obtained the dependencies sync (stooooopid!) thus the completed flag
			for (var i = 0; i < len && !completed; i++) (function (index, depName) {
					// look for commonjs free vars
				if (depName in ctx.cjsVars) {
					deps[index] = ctx.cjsVars[depName];
					count--;
				}
				else {
					// hook into promise callbacks
					when(core.fetchDep(depName, ctx),
						function (dep) {
							deps[index] = dep; // got it!
							if (--count == 0) {
								completed = true;
								success(deps);
							}
						},
						function (ex) {
							completed = true;
							failure(ex);
						}
					);
				}
			}(i, names[i]));

			// were there none to fetch and did we not already complete the promise?
			if (count == 0 && !completed) {
				success(deps);
			}

		},

		getCurrentDefName: function () {
			// Note: Opera lies about which scripts are "interactive", so we
			// just have to test for it. Opera provides a true browser test, not
			// a UA sniff, thankfully.
			// TODO: find a way to remove this browser test
			var def;
			if (!isType(global.opera, 'Opera')) {
				for (var d in activeScripts) {
					if (activeScripts[d].readyState == 'interactive') {
						def = d;
						break;
					}
				}
			}
			return def;
		}

	};

	function _require (ids, callback, ctx) {
		// Note: callback could be a promise

		// RValue require (CommonJS)
		if (isType(ids, 'String')) {
			// return resource
			var def = cache[ids];
			if (!(ids in cache) || def instanceof ResourceDef) {
				throw new Error('Module is not already resolved: '  + ids);
			}
			if (callback) {
				throw new Error('require(<string>, callback) not allowed. use <array>.');
			}
			return def;
		}

		// resolve dependencies
		core.getDeps(null, ids, ctx,
			function (deps) {
				// Note: deps are passed to a promise as an array, not as individual arguments
				callback.resolve ? callback.resolve(deps) : callback.apply(null, deps);
			},
			function (ex) {
				if (callback.reject) callback.reject(ex);
				else throw ex;
			}
		);

	}

	function _curl (/* various */) {

		var args = aslice.call(arguments), ctx;

		// extract config, if it's specified
		if (isType(args[0], 'Object')) {
			userCfg = args.shift();
			core.extractCfg(userCfg);
		}

		// this must be after extractCfg
		ctx = core.begetCtx('', userCfg);

		// thanks to Joop Ringelberg for helping troubleshoot the API
		function CurlApi (ids, callback, waitFor) {
			var promise = new Promise();
			this['then'] = function (resolved, rejected) {
				when(promise,
					// return the dependencies as arguments, not an array
					function (deps) { if (resolved) resolved.apply(undef, deps); },
					// just throw if the dev didn't specify an error handler
					function (ex) { if (rejected) rejected(ex); else throw ex; }
				);
				return this;
			};
			this['next'] = function (ids, cb) {
				// chain api
				return new CurlApi(ids, cb, promise);
			};
			if (callback) this['then'](callback);
			when(waitFor, function () {
				ctx.require([].concat(ids), promise, ctx);
			});
		}

		return new CurlApi(args[0], args[1]);

	}

	function _define (args) {

		var id = args.id;

		if (id == null) {
			if (argsNet !== undef) {
				argsNet = {ex: 'Multiple anonymous defines found in ${url}.'};
			}
			else if (!(id = core.getCurrentDefName())/* intentional assignment */) {
				// anonymous define(), defer processing until after script loads
				argsNet = args;
			}
		}
		if (id != null) {
			// named define(), it is in the cache if we are loading a dependency
			// (could also be a secondary define() appearing in a built file, etc.)
			// if it's a secondary define(), grab the current def's context
			var def = cache[id];
			if (!def) {
				def = cache[id] = new ResourceDef(id);
			}
			def.useNet = false;
			// check if this resource has already been resolved (can happen if
			// a module was defined inside a built file and outside of it and
			// dev didn't coordinate it explicitly)
			if (!('resolved' in def)) {
				core.resolveResDef(def, args);
			}
		}

	}

	/***** grab any global configuration info *****/

	// if userCfg is a function, assume curl() exists already
	var conflict = isType(userCfg, 'Function');
	if (!conflict) {
		core.extractCfg(userCfg);
	}

	/***** define public API *****/

	var apiName, apiContext, define;

	// allow curl to be renamed and added to a specified context
	apiName = userCfg['apiName'] || 'curl';
	apiContext = userCfg['apiContext'] || global;
	apiContext[apiName] = _curl;

	// wrap inner _define so it can be replaced without losing define.amd
	define = global['define'] = function () {
		var args = core.fixArgs(arguments);
		_define(args);
	};
	_curl['version'] = version;

	// this is to comply with the AMD CommonJS proposal:
	define['amd'] = { 'plugins': true, 'curl': version };

	// allow curl to be a dependency
	cache['curl'] = _curl;

	// expose curl core for special plugins and modules
	// Note: core overrides will only work in either of two scenarios:
	// 1. the files are running un-compressed (Google Closure or Uglify)
	// 2. the overriding module was compressed with curl.js
	// Compiling curl and the overriding module separately won't work.
	cache['curl/_privileged'] = {
		'core': core,
		'cache': cache,
		'cfg': userCfg,
		'_require': _require,
		'_define': _define,
		'_curl': _curl,
		'global': global,
		'ResourceDef': ResourceDef
	};

}(
	this,
	document,
	// grab configuration
	this['curl'] || {}
));
