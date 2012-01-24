/** @license MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl (cujo resource loader)
 * An AMD-compliant javascript module and resource loader
 *
 * curl is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * @version 0.6
 */
(function (global, doc, userCfg) {

	/*
	 * Basic operation:
	 * When a dependency is encountered and it already exists, it's returned.
	 * If it doesn't already exist, it is created and the dependency's script
	 * is loaded. If there is a define call in the loaded script with a id,
	 * it is resolved asap (i.e. as soon as the module's dependencies are
	 * resolved). If there is a (single) define call with no id (anonymous),
	 * the resource in the resNet is resolved after the script's onload fires.
	 * IE requires a slightly different tactic. IE marks the readyState of the
	 * currently executing script to 'interactive'. If we can find this script
	 * while a define() is being called, we can match the define() to its id.
	 * Opera marks scripts as 'interactive' but at inopportune times so we
	 * have to handle it specifically.
	 */

	var
		version = '0.6',
		head = doc && (doc['head'] || doc.getElementsByTagName('head')[0]),
		// local cache of resource definitions (lightweight promises)
		cache = {},
		// preload are files that must be loaded before any others
		preload = false,
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
		removeCommentsRx = /\/\*[\s\S]*?\*\/|(?:[^\\])\/\/.*?[\n\r]/g,
		findRValueRequiresRx = /require\s*\(\s*["']([^"']+)["']\s*\)|((?:[^\\])?["'])/,
		// script ready states that signify it's loaded
		readyStates = { 'loaded': 1, 'interactive': 1, 'complete': 1 },
		orsc = 'onreadystatechange',
		core;

	function isType (obj, type) {
		return toString.call(obj).indexOf('[object ' + type) == 0;
	}

	function normalizePkgDescriptor (descriptor) {
		var path, main;

		path = descriptor.path = removeEndSlash(descriptor['path'] || descriptor['location'] || '');
		main = descriptor['main'] || 'main';
		descriptor.config = descriptor['config'];
		descriptor.main = main.charAt(0) == '.' ?
			removeEndSlash(core.normalizeName(main, path)) :
			joinPath(path, main);

		return descriptor;
	}

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
			// we no longe throw during multiple calls to resolve or reject
			// since we don't really provide useful information anyways.
			resolve = reject =
				function () { /*throw new Error('Promise already completed.');*/ };
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

		extractCfg: function (cfg) {
			var pluginCfgs;

			// set defaults and convert from closure-safe names
			cfg.baseUrl = cfg['baseUrl'] || '';
			cfg.pluginPath = 'pluginPath' in cfg ? cfg['pluginPath'] : 'curl/plugin';

			// create object to hold path map.
			// each plugin and package will have its own pathMap, too.
			cfg.pathMap = {};
			pluginCfgs = cfg.plugins = cfg['plugins'] || {};

			// temporary arrays of paths. this will be converted to
			// a regexp for fast path parsing.
			cfg.pathList = [];

			// normalizes path/package info and places info on either
			// the global cfg.pathMap or on a plugin-specific altCfg.pathMap.
			// also populates a pathList on cfg or plugin configs.
			function fixAndPushPaths (coll, isPkg) {
				var id, data, prefixPos, prefix, currCfg, info;
				for (var name in coll) {
					data = coll[name];
					currCfg = cfg;
					// grab the package id, if specified. default to
					// property name.
					id = removeEndSlash(data['id'] || data['name'] || name);
					prefixPos = id.indexOf('!');
					if (prefixPos > 0) {
						// plugin-specific path
						prefix = id.substr(0, prefixPos);
						currCfg = pluginCfgs[prefix];
						if (!currCfg) {
							currCfg = pluginCfgs[prefix] = beget(cfg);
							currCfg.pathMap = beget(cfg.pathMap);
							currCfg.pathList = [];
						}
						// remove prefix from id
						id = id.substr(prefixPos + 1);
						// remove plugin-specific path from coll
						delete coll[name];
					}
					if (isPkg) {
						info = normalizePkgDescriptor(data);
					}
					else {
						info = { path: removeEndSlash(data) };
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
						currCfg.baseUrl = core.resolveUrl(data, cfg);
					}
				}
			}

			// adds the path matching regexp onto the cfg or plugin cfgs.
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

			// handle preload here since extractCfg can be called from two places
			if (cfg['preload']){
				// chain from previous preload (for now. revisit when
				// doing package-specific configs).
				when(preload, function () {
					var ctx = core.begetCtx('', cfg);
					preload = new ResourceDef('*preload');
					ctx.isPreload = true;
					_require(cfg['preload'], preload, ctx);
				});
			}

			return cfg;

		},

		begetCtx: function (absId, cfg) {

			var baseId, ctx, exports, require;

			function normalize (id) {
				return core.normalizeName(id, baseId);
			}

			function toUrl (n) {
				// TODO: determine if we can skip call to normalize if all ids passed to this function are normalized or absolute
				var path = core.resolvePathInfo(normalize(n), cfg).path;
				return core.resolveUrl(path, cfg);
			}

			function req (deps, callback) {
				// this is a public function, so remove ability for callback
				// to be a deferred (also fixes issue #41)
				var cb = callback && function () { callback.apply(undef, arguments); };
				return _require(deps, cb, ctx);
			}

			baseId = absId.substr(0, absId.lastIndexOf('/'));
			exports = {};
			ctx = {
				baseId: baseId,
				require: req,
				cjsVars: {
					'require': req,
					'exports': exports,
					'module': {
						'id': absId,
						'uri': toUrl(absId),
						'exports': exports
					}
				}
			};

			ctx.require['toUrl'] = toUrl;
			ctx.require.normalize = normalize;

			return ctx;
		},

		resolvePathInfo: function (id, cfg, isPlugin) {
			// TODO: figure out why this gets called so often for the same file
			// searches through the configured path mappings and packages
			var pathMap, pathInfo, path, config, found;

			pathMap = cfg.pathMap;

			if (isPlugin && userCfg.pluginPath && id.indexOf('/') < 0) {
				// prepend plugin folder path, if it's missing and path isn't in pathMap
				// Note: this munges the concepts of ids and paths for plugins,
				// but is generally safe since it's only for non-namespaced
				// plugins (plugins without path or package info).
				// TODO: use plugin-specific cfg instead of userCfg?
				id = joinPath(userCfg.pluginPath, id);
			}

			if (!absUrlRx.test(id)) {
				path = id.replace(cfg.pathRx, function (match) {

					pathInfo = pathMap[match] || {};
					found = true;
					config = pathInfo.config;

					// if pathInfo.main and match == id, this is a main module
					if (pathInfo.main && match == id) {
						return pathInfo.main;
					}
					// if pathInfo.path return pathInfo.path
					else {
						return pathInfo.path || '';
					}

				});
			}
			else {
				path = id;
			}

			return {
				path: path,
				config: config || userCfg
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
					this.onload = this[orsc] = this.onerror = ''; // ie cries if we use undefined
					success();
				}
			}

			function fail (e) {
				// some browsers send an event, others send a string,
				// but none of them send anything useful, so just say we failed:
				failure(new Error('Syntax error or http error: ' + def.url));
			}

			// set type first since setting other properties could
			// prevent us from setting this later
			// TODO: do we need this at all?
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

		extractCjsDeps: function (defFunc) {
			// Note: ignores require() inside strings and comments
			var source, ids = [], currQuote;
			// prefer toSource (FF) since it strips comments
			source = typeof defFunc == 'string' ?
					 defFunc :
					 defFunc.toSource ? defFunc.toSource() : defFunc.toString();
			// remove comments, then look for require() or quotes
			source.replace(removeCommentsRx, '').replace(findRValueRequiresRx, function (m, id, qq) {
				// if we encounter a quote
				if (qq) {
					currQuote = currQuote == qq ? undef : currQuote;
				}
				// if we're not inside a quoted string
				else if (!currQuote) {
					ids.push(id);
				}
				return m; // uses least RAM/CPU
			});
			return ids;
		},

		fixArgs: function (args) {
			// resolve args
			// valid combinations for define:
			// (string, array, object|function) sax|saf
			// (array, object|function) ax|af
			// (string, object|function) sx|sf
			// (object|function) x|f

			var id, deps, defFunc, isDefFunc, len, cjs;

			len = args.length;

			defFunc = args[len - 1];
			isDefFunc = isType(defFunc, 'Function');

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

			// Hybrid format: assume that a definition function with zero
			// dependencies and non-zero arity is a wrapped CommonJS module
			if (!deps && isDefFunc && defFunc.length > 0) {
				cjs = true;
				deps = ['require', 'exports', 'module'].concat(core.extractCjsDeps(defFunc));
			}

			return {
				id: id,
				deps: deps || [],
				res: isDefFunc ? defFunc : function () { return defFunc; },
				cjs: cjs
			};
		},

		resolveResDef: function (def, args) {

			// TODO: does the context's config need to be passed in somehow?
			// TODO: resolve context outside this function
			var childCtx = core.begetCtx(def.id, userCfg);

			// get the dependencies and then resolve/reject
			core.getDeps(def, args.deps, childCtx,
				function (deps) {
					var res, defContext;
					try {
						// node.js assumes `this` === exports.
						// anything returned overrides exports.
						// use module.exports if nothing returned (node.js
						// convention). exports === module.exports unless
						// module.exports was reassigned.
						defContext = args.cjs ? childCtx.cjsVars['exports'] : global;
						res = args.res.apply(defContext, deps);
						if (args.cjs && res === undef) {
							res = childCtx.cjsVars['module']['exports'];
						}
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

					// if our resource was not explicitly defined with an id (anonymous)
					// Note: if it did have an id, it will be resolved in the define()
					if (def.useNet !== false) {

						if (!args) {
							// uh oh, nothing was added to the argsNet
							def.reject(new Error('define() not found or duplicates found: ' + def.url));
						}
						else if (args.ex) {
							// the argsNet resource was already rejected, but it didn't know
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
				var path = (dot2 ? basePath.substr(0, basePath.lastIndexOf('/')) : basePath);
				// don't add slash to blank string or it will look like a
				// page-relative path
				return path && path + '/';
			});
		},

		fetchDep: function (depName, ctx) {
			var fullId, delPos, loaderId, pathMap, resId, loaderInfo, pathInfo,
				def, cfg;

			pathMap = userCfg.pathMap;
			// check for plugin loaderId
			delPos = depName.indexOf('!');
			// obtain absolute id of resource (assume resource id is a
			// module id until we've obtained and queried the loader/plugin)
			// this will work for both cases (delPos == -1, or >= 0)
			resId = ctx.require.normalize(depName.substr(delPos + 1));

			if (delPos >= 0) {
				// get plugin info
				loaderId = ctx.require.normalize(depName.substr(0, delPos));
				// allow plugin-specific path mappings
				cfg = userCfg.plugins[loaderId] || userCfg;
			}
			else {
				// get path information for this resource
				pathInfo = core.resolvePathInfo(resId, userCfg);
				// get custom module loader from package config
				cfg = pathInfo.config || userCfg;
				loaderId = cfg['moduleLoader'];
			}

			if (!loaderId) {

				// normal AMD module
				def = cache[resId];
				if (!def) {
					def = cache[resId] = new ResourceDef(resId);
					// TODO: def.ctx = core.childCtx(ctx);
					def.url = core.resolveUrl(pathInfo.path, cfg, true);
					core.fetchResDef(def);
				}

			}
			else {

				// fetch plugin or loader
				var usePluginPath, loaderDef = cache[loaderId];
				if (!loaderDef) {
					loaderInfo = core.resolvePathInfo(loaderId, userCfg, delPos > 0);
					loaderDef = cache[loaderId] = new ResourceDef(loaderId);
					loaderDef.url = core.resolveUrl(loaderInfo.path, userCfg, true);
					core.fetchResDef(loaderDef);
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
							resId = plugin['normalize'](resId, ctx.require.normalize, cfg);
						}

						// dojo/has may return falsey values (0, actually)
						if (resId) {
							// plugin may have its own pathMap (plugin-specific paths)
							childCtx = core.begetCtx(resId, cfg);

							// use the full id (loaderId + id) to id plugin resources
							// so multiple plugins may each process the same resource
							fullId = loaderId + '!' + resId;
							normalizedDef = cache[fullId];

							// if this is our first time fetching this (normalized) def
							if (!normalizedDef) {

								normalizedDef = new ResourceDef(fullId);

								// resName could be blank if the plugin doesn't specify an id (e.g. "domReady!")
								// don't cache non-determinate "dynamic" resources (or non-existent resources)
								if (!plugin['dynamic']) {
									cache[fullId] = normalizedDef;
								}

								// curl's plugins prefer to receive a deferred,
								// but to be compatible with AMD spec, we have to
								// piggy-back on the callback function parameter:
								var loaded = function (res) {
									if (!plugin['dynamic']) cache[fullId] = res;
									normalizedDef.resolve(res);
								};
								// using bracket property notation so closure won't clobber id
								loaded['resolve'] = loaded;
								loaded['reject'] = normalizedDef.reject;

								// load the resource!
								plugin.load(resId, childCtx.require, loaded, cfg);

							}
						}

						// chain defs (resolve when plugin.load executes)
						if (def != normalizedDef) {
							when(normalizedDef, def.resolve, def.reject);
						}

					},
					def.reject
				);

			}

			return def;
		},

		getDeps: function (def, names, ctx, success, failure) {
			var deps = [],
				count = names.length,
				completed = false,
				len, i;

			function doFailure (ex) {
				completed = true;
				failure(ex);
			}

			function checkDone () {
				if (--count == 0) {
					completed = true;
					success(deps);
				}
			}

			// wait for preload
			// TODO: cascade context so this will work:
			when(ctx.isPreload || preload, function () {

				preload = true; // indicate we've preloaded everything

				// obtain each dependency
				// Note: IE may have obtained the dependencies sync (stooooopid!) thus the completed flag
				for (i = 0, len = names.length; i < len && !completed; i++) (function (index, depName) {
						// look for commonjs free vars
					if (depName in ctx.cjsVars) {
						deps[index] = ctx.cjsVars[depName];
						ctx.cjsVars.inUse
						checkDone();
					}
					// check for blanks. fixes #32.
					// this could also help with the has! plugin (?)
					else if (!depName) {
						count--;
					}
					else {
						// hook into promise callbacks
						when(core.fetchDep(depName, ctx),
							function (dep) {
								deps[index] = dep; // got it!
								checkDone();
							},
							doFailure
						);
					}
				}(i, names[i]));

				// were there none to fetch and did we not already complete the promise?
				if (count == 0 && !completed) {
					success(deps);
				}

			}, doFailure);

		},

		getCurrentDefName: function () {
			// IE marks the currently executing thread as "interactive"
			// Note: Opera lies about which scripts are "interactive", so we
			// just have to test for it. Opera provides a true browser test, not
			// a UA sniff, thankfully.
			// learned this trick from James Burke's RequireJS
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
			var id = ctx.require.normalize(ids), def = cache[id];
			if (!(id in cache) || def instanceof ResourceDef) {
				throw new Error('Module is not already resolved: '  + id);
			}
			if (callback) {
				throw new Error('require(<string>, callback) not allowed. use <array>.');
			}
			return def;
		}

		// resolve dependencies
		core.getDeps(undef, ids, ctx,
			function (deps) {
				// Note: deps are passed to a promise as an array, not as individual arguments
				callback.resolve ? callback.resolve(deps) : callback.apply(undef, deps);
			},
			function (ex) {
				if (callback.reject) callback.reject(ex);
				else throw ex;
			}
		);

	}

	function _curl (/* various */) {

		var args = aslice.call(arguments), ids, ctx;

		// extract config, if it's specified
		if (isType(args[0], 'Object')) {
			userCfg = core.extractCfg(args.shift());
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
				_require([].concat(ids), promise, ctx);
			});
		}

		ids = [].concat(args[0]); // force to array TODO: create unit test
		return new CurlApi(ids, args[1]);

	}

	function _define (args) {

		var id = args.id;

		if (id == undef) {
			if (argsNet !== undef) {
				argsNet = {ex: 'Multiple anonymous defines found in ${url}.'};
			}
			else if (!(id = core.getCurrentDefName())/* intentional assignment */) {
				// anonymous define(), defer processing until after script loads
				argsNet = args;
			}
		}
		if (id != undef) {
			// named define(), it is in the cache if we are loading a dependency
			// (could also be a secondary define() appearing in a built file, etc.)
			var def = cache[id];
			if (!def) {
				def = cache[id] = new ResourceDef(id);
			}
			// check if this resource has already been resolved (can happen if
			// a module was defined inside a built file and outside of it and
			// dev didn't coordinate it explicitly)
			if (def instanceof ResourceDef) {
				def.useNet = false;
				core.resolveResDef(def, args);
			}
		}

	}

	/***** grab any global configuration info *****/

	// if userCfg is a function, assume curl() exists already
	if (isType(userCfg, 'Function')) return;

	userCfg = core.extractCfg(userCfg || {});

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

	// indicate our capabilities:
	define['amd'] = { 'plugins': true, 'jQuery': true, 'curl': version };

	// allow curl to be a dependency
	// TODO: use this? define('curl', function () { return _curl; });
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
	this.document,
	// grab configuration
	this['curl']
));
