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
 */
(function (global, cjsModule) {
"use strict";

//	var
//		msgUsingExports = {},
//		msgFactoryExecuted = {},

	/***** public API *****/

	var version = '0.8.0';

	/**
	 * @global
	 * @param {String} [id]
	 * @param {Array} [dependencyIds]
	 * @param {*} factoryOrExports
	 */
	function define (factoryOrExports) {
		var args = amd.fixDefineArgs(arguments);
		amd.defineModule.apply(undefined, args);
	}
	define['amd'] = { 'plugins': true, 'jQuery': true, 'curl': curl };

	/**
	 * @global
	 * @exports
	 * @param {Object} [cfg]
	 * @param {Array} [ids]
	 * @param {Function} [callback]
	 * @param {Function} [errback]
	 * @return {CurlApi}
	 */
	function curl () {
		var args, promise, cfg;

		args = [].slice.call(arguments);

		// extract config, if it's specified
		if (core.isType(args[0], 'Object')) {
			cfg = args.shift();
			promise = when(config.set(cfg));
		}

		return new CurlApi(args[0], args[1], args[2], all([firstConfig, promise]));
	}

	/**
	 * Current version of curl.js.
	 * @type {String}
	 */
	curl['version'] = version;

	/**
	 * Obtains an already-cached module.  If the module is not already cached,
	 * an exception is thrown.
	 * @param {String} id
	 * @return {*} module
	 */
	curl['get'] = function (id) {
		var ctx;
		if (!(id in globalRealm.cache)) {
			throw new Error(importErrorMessage(id));
		}
		ctx = globalRealm.cache[id];
		return core.isModuleContext(ctx)
			? core.importModuleSync(ctx)
			: ctx;
	};

	/**
	 *
	 * @param {Object} cfg
	 * @param {Function} [cb]
	 * @param {Function} [eb]
	 * @return {CurlApi}
	 */
	curl['config'] = function (cfg, cb, eb) {
		new CurlApi().config(cfg, cb, eb);
	};

	/**
	 * Restores the global API variables to their previous values before
	 * curl.js executed.  Call this function after capturing the new/current
	 * APIs like this:
	 *   var define = curl.get('curl/define');
	 *   my.curl = curl;
	 *   my.define = define;
	 *   curl.restore();
	 */
	curl['restore'] = function () {
		global['curl'] = prevCurl;
		global['define'] = prevDefine;
	};

	/**
	 *
	 * @param {Array} [ids]
	 * @param {Function} [callback]
	 * @param {Function} [errback]
	 * @constructor
	 */
	function CurlApi (ids, callback, errback, waitFor) {
		var ctx, dfd, promise, args;

		// defaults
		if (!callback) callback = identity;
		if (!errback) errback = function (ex) { throw ex; };

		dfd = new Deferred();
		promise = dfd.promise;
		args = [];

		if (ids) {
			// create a phony module context
			ctx = core.createModuleContext('', globalRealm, '');
			// `|| []` prevents accidental cjs-wrapped functionality
			ctx.deps = ids || [];
			// create a "factory" that captures its arguments (dependencies)
			ctx.factory = function () { args = arguments; };
			// exporter will create ctx.funFactory()
			core.createFactoryExporter(ctx);
		}

		// when ready, call the callback or errback
		promise.then(function () {
			callback.apply(undefined, args);
		}, errback);

		// wait for previous promise. then get deps. then resolve deps
		// by running the factory. then resolve the deferred.
		when(waitFor, function () {
			when(ctx && core.resolveDeps(ctx).then(ctx.runFactory),
				dfd.fulfill,
				dfd.reject
			);
		});

		/**
		 *
		 * @param {Function} [callback]
		 * @param {Function} [errback]
		 * @return {CurlApi}
		 * @memberOf CurlApi
		 */
		this['then'] = function (callback, errback) {
			promise = promise.then(function () {
				callback.apply(undefined, args);
			}, errback);
			return this;
		};

		/**
		 * @param {Array} ids
		 * @param {Function} [callback]
		 * @param {Function} [errback]
		 * @return {CurlApi}
		 * @memberOf CurlApi
		 */
		this['next'] = function (ids, callback, errback) {
			return new CurlApi(ids, callback, errback, promise);
		};

		/**
		 * @param {Object} cfg
		 * @return {CurlApi}
		 * @memberOf CurlApi
		 */
		this['config'] = function (cfg) {
			// don't wait for previous promise to start config
			promise = all([promise, config.set(cfg)]);
			return this;
		};
	}


	/***** core *****/

	var core;

	/**
	 *
	 * @type {Object}
	 * @module 'curl/core'
	 */
	core = {

		/***** module pipelines *****/

		requirePipeline: [
			'normalize', 'locate', 'fetch', 'transform', 'resolve', 'link'
		],

		providePipeline: [
			'define'
		],

		/**
		 * Creates a promise-aware pipeline of composed functions.
		 * @param {Array} order - list of pipeline functions or an array of
		 *   strings that are used to look up pipeline functions in `map`
		 * @param {Object} [map] - key-value pairs of pipeline functions
		 *   that correspond to keys in the `order` list
		 * @return {Function}
		 */
		createPipeline: function (order, map) {
			var head, i;

			head = next(0);
			i = 0;

			// queue all the pipeline tasks
			while (++i < order.length) head = queue(head, next(i));

			// append an error handler that catches ShortCircuit
			return queue(head, undefined, err);

			// TODO: hoist these functions?

			function next (i) {
				var item = order[i];
				if (typeof item == 'function') return item;
				item = map[item];
				if (typeof item == 'function') return item;
				return core.createPipeline(item);
			}

			function err (ex) {
				if (ex instanceof ShortCircuit) return ex.result;
				else throw ex;
			}

			function queue (task1, task2, err2) {
				return function () {
					return when(task1.apply(this, arguments)).then(task2, err2);
				};
			}
		},

		resolveDeps: function (mctx) {
			var count, i;
			count = mctx.deps.length;
			mctx.imports = [];
			i = -1;
			while (++i < count) {
				mctx.imports.push(resolveAndCache(mctx.deps[i]));
			}
			return count ? all(mctx.imports).then(replaceImports) : mctx;

			function resolveAndCache (id) {
				var result;
				// TODO: move special treatment of cjs vars to locate step once caching is advice to the steps
				// check for pseudo-modules
				if (id in core.cjsFreeVars) {
					result = core.cjsFreeVars[id].call(mctx);
				}
				// resolve it
				else {
					result = core.requireModule(mctx, id);
					// result may not be a promise:
					when(result, function (mctx) {
						// replace cache with mctx
						// TODO: move this to advice at the end of the pipeline
						return mctx.realm.cache[mctx.id] = mctx;
					});
				}
				return result;
			}

			function replaceImports (imports) {
				mctx.imports = imports;
				return mctx;
			}
		},

		requireModule: function (pctx, id) {
			var realm = pctx.realm, mctx, pipeline;
			if (!realm.require) {
				pipeline = core.requirePipeline;
				realm.require = core.createPipeline(
					pipeline,
					realm.cfg.types[realm.cfg.type].require
				);
			}
			mctx = core.createModuleContext(id, realm, pctx.id);
			// don't store anything in the cache, yet. just save the promise
			return mctx.promise = realm.require(mctx);
		},

		createFactoryExporter: function (mctx) {
			// TODO: split this into "link" (deps->imports) and "provide" steps
			// hmm... is this the general pattern or is this too specific to
			// CJS/AMD?
			mctx.runFactory = function () {
				var i, imports, imp, exports, exp;
				i = -1;
				imports = mctx.imports;
				while (++i < imports.length) {
					imp = imports[i];
					if (core.isModuleContext(imp)) {
						imports[i] = core.importModuleSync(imp);
					}
				}
				// node.js runs the factory in the context of the exports
				exports = mctx.module ? mctx.module.exports : mctx.exports;
				// Note: don't grab a reference to mctx.factory in advance since
				// it could be replaced or created just-in-time.
				exp = mctx.factory.apply(exports, imports.slice(0, mctx.arity));
				// find exported thing
				return mctx.usesExports && exp === undefined
					? (mctx.module ? mctx.module.exports : mctx.exports)
					: exp;
			};
			return mctx;
		},

		/**
		 * Returns the exports of the module.  The the module's runFactory hasn't
		 * been executed, it executes that first.  The module's exports are
		 * stored in the cache so subsequent imports don't re-execute the
		 * runFactory.
		 * @param {ModuleContext} mctx
		 * @return {*}
		 * TODO: should this be another pipeline, but sync?
		 */
		importModuleSync: function (mctx) {
			var realm = mctx.realm, id = mctx.id, notReady;
			notReady = isDeferred(mctx);
			if (notReady) throw new Error(importErrorMessage(mctx.id));
			realm.cache[id] = mctx.runFactory();
			return realm.cache[id];
		},

		/**** module context *****/

		isModuleContext: function (it) {
			return it instanceof ModuleContext;
		},

		createModuleContext: function (id, realm, baseId) {
			var mctx;
			mctx = new ModuleContext();
			mctx.id = id;
			mctx.baseId = baseId;
			mctx.realm = realm; // could be replaced later
			mctx.deps = [];
			return mctx;
		},

		/***** utilities *****/

		cjsFreeVars: {
			// these should be called in the context of a mctx
			'require': function () {
				// TODO: this is gross. can we reuse some code or otherwise improve this?
				var mctx = this, realm = mctx.realm, xform;
				xform = realm.cfg.types[realm.cfg.type].require.normalize;
				return function (id) {
					var cctx, callback;
					callback = arguments[1];
					if (core.isType(callback, 'Function')) {
						core.requireModule(mctx, id)
							.then(core.importModuleSync, arguments[2])
							.then(callback);
					}
					else {
						// can't use promises here because they're async
						cctx = xform(core.createModuleContext(id, realm, mctx.id));
						if (!cctx.id in realm.cache) {
							throw new Error(cctx.id + ' not already loaded.');
						}
						return realm.cache[cctx.id];
					}
				};
			},
			'exports': function () {
				this.usesExports = true;
				return this.exports || (this.exports = {});
			},
			'module': function () {
				var mctx = this, module = mctx.module;
				if (!module) {
					this.usesExports = true;
					module = mctx.module = core.toObfuscatedName({
						id: mctx.id,
						uri: mctx.url,
						exports: core.cjsFreeVars['exports'].call(mctx),
						config: function () { return mctx.realm.cfg; }
					});
				}
				return module;
			}
		},

		extractCjsDeps: (function (findRValueRequiresRx, commentPair) {
			return function (factory) {
				var source, ids = [], inQuote, inComment;

				source = typeof factory == 'string'
					? factory
					: factory.toString();

				source.replace(findRValueRequiresRx, findRequires);

				return ids;

				function findRequires (m, rq, id, cm, qq) {
					// don't look for require() in comments or strings
					if (inComment) {
						if (cm == inComment) inComment = undefined;
					}
					else if (inQuote) {
						if (qq == inQuote) inQuote = undefined;
					}
					else {
						if (cm) inComment = commentPair[cm];
						else if (qq) inQuote = qq;
						else ids.push(id);
					}
					return '';
				}
			}
		}(
			/require\s*\(\s*(["'])(.*?[^\\])\1\s*\)|(\/\/|\/\*|\n|\*\/)|[^\\]?(["'])/g,
			{ '//': '\n', '/*': '*/' }
		)),

		/**
		 * Returns true if the thing to test has the constructor named,
		 * but only for built-in types, such as Array, Object, String,
		 * RegExp, Date.
		 * @param {*} it - the thing to test
		 * @param {String} type - the name of the constructor for the type
		 * @return {Boolean}
		 */
		isType: (function (toString) {
			return function (it, type) {
				return toString.call(it).indexOf('[object ' + type) == 0;
			}
		}(Object.prototype.toString)),

		beget: function (parent, mixin, transform) {
			var child, p;
			if (!transform) transform = identity;
			Begetter.prototype = parent || {};
			child = new Begetter();
			Begetter.prototype = {};
			for (p in mixin) child[p] = mixin[p];
			return child;
		},

		// this is gross. can we move this to an external module that is
		// baked in to dist versions?
		toObfuscatedName: (function (map) {
			var test, invert, p;
			// test if we've been obfuscated
			test = { prop: version };
			if (test.prop == test['prop']) return identity;
			// create a converter
			invert = {};
			for (p in map) invert[map[p]] = p;
			return function (it) {
				var p;
				if (core.isType(it, 'Object')) {
					for (p in it) it[p] = it[core.toObfuscatedName(p)];
				}
				return it in invert ? invert[it] : it;
			}
		}({
			baseUrl: 'baseUrl',
			pluginPath: 'pluginPath',
			dontAddFileExt: 'dontAddFileExt',
			paths: 'paths',
			packages: 'packages',
			plugins: 'plugins',
			preloads: 'preloads',
			main: 'main',
			type: 'type',
			types: 'types',
			amd: 'amd',
			provide: 'provide',
			normalize: 'normalize',
			locate: 'locate',
			fetch: 'fetch',
			transform: 'transform',
			resolve: 'resolve',
			link: 'link',
			define: 'define'
		})),

		/**
		 * Executes a task in the "next turn". Prefers process.nextTick or
		 * setImmediate, but will fallback to setTimeout.
		 * @param {Function} task
		 */
		nextTurn: typeof setImmediate == 'function'
			? setImmediate.bind(global)
			: typeof process === 'object' && process.nextTick
			? process.nextTick
			: function (task) { setTimeout(task, 0); }
	};

		/***** amd-specific functions *****/

	var amd;

	/**
	 * AMD-specific behavior.
	 * @type {Object}
	 * @module curl/amd
	 */
	amd = {

		defineCache: {},

		anonCache: undefined,

		errorCache: undefined,

		transformId: function (mctx) {
			// TODO: id transforms
			mctx.id = path.reduceLeadingDots(mctx.id, mctx.baseId);
			return mctx;
		},

		locateModule: function (mctx) {
			var cache;

			// TODO: remove cache-related behavior and put into advice

			cache = mctx.realm.cache;

			// use the cached one in case another pipeline is resolving
			// already. the first one in the cache is used by all.
			if (mctx.id in cache) throw new ShortCircuit(cache[mctx.id]);

			// TODO: turn this on when caching is added as advice to pipeline steps
//			if (mctx.id in core.cjsFreeVars) {
//				throw new ShortCircuit(core.cjsFreeVars[mctx.id].call(mctx));
//			}

			// put this pipeline in the cache
			cache[mctx.id] = mctx.promise;
			mctx.promise = undefined;

			// check define cache (inline define()s?)
			if (mctx.id in amd.defineCache) {
				amd.applyArguments.apply(mctx, amd.defineCache);
				delete amd.defineCache[mctx.id];
			}
			// add a url. we're going to need to fetch the module
			else {
				// NOTE: if url == id, then the id *is* a url, not an id!
				// should we do anything with this knowledge?
				mctx.url = mctx.realm.idToUrl(mctx.id);
			}

			return mctx;
		},

		fetchModule: function (mctx) {
			var dfd;

			// check if we have it. may have been in define cache
			// Note: we're using mctx.factory as a flag that it was fetched
			// Note: this only skips fetch pipeline (fetchModule +
			// assignDefines).
			// TODO: consider doing this as advice
			if (mctx.factory) throw new ShortCircuit(mctx);

			dfd = new Deferred();
			script.load(mctx, assignSync, dfd.reject);

			return dfd.promise;

			function assignSync () {
				// assignDefines() must happen sync or the next inflight script
				// will overlap
				dfd.fulfill(amd.assignDefines(mctx));
			}
		},

		assignDefines: function (mctx) {
			var cache, args, id;

			// save and clear define cache
			cache = amd.defineCache;
			amd.defineCache = {};

			if (amd.errorCache) err(amd.errorCache);
			if (!amd.anonCache && !(mctx.id in cache)) {
				err('module ' + mctx.id + ' not found in ' + mctx.url);
			}

			if (amd.anonCache) {
				args = amd.anonCache;
				amd.anonCache = undefined;
			}
			else {
				args = cache[mctx.id];
			}
			amd.applyArguments.apply(mctx, args);

			// move all the named defines to the correct realm
			if (mctx.realm != globalRealm) {
				for (id in cache) {
					mctx.realm.cache[id] = globalRealm.cache[id];
					delete globalRealm.cache[id];
				}
			}

			return mctx;

			function err (msg) {
				throw new Error(msg + mctx.url);
			}
		},

		defineModule: function (id, deps, factory, options) {
			if (id == undefined) {
				if (amd.anonCache) {
					amd.errorCache
						= 'previous anonymous module loaded as plain javascript, or'
						+ 'multiple anonymous defines in ';
				}
				// check if we can find id in activeScripts
				else if (!(id = script.getCurrentModuleId())) {
					amd.anonCache = arguments;
				}
			}

			if (id != undefined) {
				// is there a perf problem from storing arguments?
				amd.defineCache[id] = arguments;
			}
		},

		applyArguments: function (id, deps, factory, options) {
			if (id != undefined) this.id = id;
			if (deps) this.deps = deps;
			this.factory = factory;
			this.isCjsWrapped = options.isCjsWrapped;
			this.arity = options.arity;
			return this;
		},

		/**
		 * Normalizes the many flavors of arguments passed to `define()`.
		 * @param {Array} args
		 * @return {Array} [id, deps, factory, options]
		 * @description
		 * The returned options contains `isCjsWrapped` (Boolean) and `arity`
		 * (Number) the length of the factory function or -1.
		 * valid combinations for define:
		 * define(string, array, function)
		 * define(string, array, <non-function>)
		 * define(array, function)
		 * define(array, <non-function>)
		 * define(string, function)
		 * define(string, <non-function>)
		 * define(function)
		 * define(<non-function>)
		 */
		fixDefineArgs: function (args) {
			var id, deps, factory, arity, len, cjs;

			len = args.length;

			factory = args[len - 1];
			arity = core.isType(factory, 'Function') ? factory.length : -1;

			if (len == 2) {
				if (core.isType(args[0], 'Array')) {
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

			// assume that a definition function with zero dependencies and
			// non-zero arity is a wrapped CommonJS module.
			if (!deps && arity > 0) {
				cjs = true;
				deps = ['require', 'exports', 'module'].slice(0, arity);
			}

			return [
				id,
				deps,
				arity >= 0 ? factory : function () { return factory; },
				{ isCjsWrapped: cjs, arity: arity }
			];
		},

		parseFactory: function (mctx) {
			var rvals;
			if (!mctx.isCjsWrapped) return mctx;
			rvals = core.extractCjsDeps(mctx.factory);
			if (rvals.length > 0) {
				mctx.deps = (mctx.deps || []).concat(rvals);
			}
			return mctx;
		}

	};


	/***** config *****/

	var escapeRx, escapeReplace, prevCurl, prevDefine, config;

	escapeRx = /\/|\./g;
	escapeReplace = '\\$&';
	prevCurl = global['curl'];
	prevDefine = global['define'];

	config = {
		/**
		 *
		 * @param {Object} cfg
		 * @return {promise}
		 * @memberOf config
		 */
		set: function (cfg) {
			var prevCfg, newCfg, desclist,
				cfgMaps, map, name, i, desc, promise,
				pathMap, pathRx;

			// convert all new cfg props from quoted props (GCC AO)
			prevCfg = globalRealm.cfg;
			newCfg = core.beget(prevCfg, cfg, core.toObfuscatedName);

			if (typeof newCfg.dontAddFileExt == 'string') {
				newCfg.dontAddFileExt = new RegExp(newCfg.dontAddFileExt);
			}

			// TODO: should pathMap prefix baseUrl in advance?
			pathMap = {};

			// create a list of paths from all of the configured path maps
			desclist = [];
			cfgMaps = { paths: 0, /*plugins: 0,*/ packages: 1 }; // TODO: hoist?
			for (name in cfgMaps) {
				// only process owned props
				if (!own(newCfg, name)) continue;
				map = newCfg[name];
				if (core.isType(map, 'Array')) {
					map = config.arrayToPkgMap(map);
				}
				newCfg[name] = core.beget(map, cfg[name] || {});
				desclist = desclist.concat(
					config.normalizePkgDescriptors(newCfg[name], cfgMaps[name])
				);
			}

			// process desclist
			i = -1;
			while (++i < desclist.length) {
				desc = desclist[i];
				// prepare for pathMatcher
				desc.specificity = desc.name.split('/').length;
				desc.toString = function () { return this.name };
				// add to path map
				pathMap[desc.name] = desc;
				// if this desc has a custom config, extend main config
				if (own(desclist[i], core.toObfuscatedName('config'))) {
					desc.config = core.beget(newCfg, desc.config);
				}
			}
			pathRx = config.generatePathMatcher(desclist);

			// TODO: how to deal with different realms
			globalRealm.idToUrl = function (id) {
				var url, pkgDesc;
				if (!path.isAbsUrl(id)) {
					url = id.replace(pathRx, function (match) {
						pkgDesc = pathMap[match] || {};
						return pkgDesc.path || '';
					});
				}
				else {
					url = id;
				}
				// NOTE: if url == id, then the id *is* a url, not an id!
				// should we do anything with this knowledge?
				url = url + (newCfg.dontAddFileExt.test(url) ? '' : '.js');
				return path.joinPaths(newCfg.baseUrl, url);
			};

			globalRealm.cfg = newCfg;

			// TODO: create a config pipeline and put these in the pipeline:
			// if preloads, fetch them
			if (cfg.preloads && cfg.preloads.length) {
				promise = new CurlApi(cfg.preloads);
			}
			// if main (string or array), fetch it/them
			var main, fallback;
			main = cfg.main;
			if (main && main.length) {
				if (core.isType(main, 'String')) main = main.split(',');
				if (main[1]) fallback = function () {
					promise = new CurlApi([main[1]], undefined, undefined, promise);
				};
				promise = new CurlApi([main[0]], undefined, fallback, promise);
			}

			// when all is done, set global config and return it
			return promise? promise.yield(newCfg) : newCfg;
		},

		normalizePkgDescriptors: function (map, isPackage) {
			var list, name, desc;
			list = [];
			for (name in map) {
				desc = map[name];
				// don't process items in prototype chain again
				if (own(map, name)) {
					// TODO: plugin logic (but hopefully not here, before and/or after this loop?)
					// normalize and add to path list
					desc = config.normalizePkgDescriptor(desc, name, isPackage);
					// TODO: baseUrl shenanigans with naked plugin name
				}
				list.push(desc);
			}
			return list;
		},

		/**
		 * Normalizes a package (or path) descriptor.
		 * @param {Object|String} orig - package/path descriptor.
		 * @param {String} [name] - required if typeof orig == 'string'
		 * @param {Boolean} isPackage - required if this is a package descriptor
		 * @return {Object} descriptor that inherits from orig
		 */
		normalizePkgDescriptor: function (orig, name, isPackage) {
			var desc, main;

			// convert from string shortcut (such as paths config)
			if (core.isType(orig, 'String')) {
				orig = { name: name, path: orig };
			}

			desc = core.beget(orig);

			// for object maps, name is probably not specified
			if (!desc.name) desc.name = name;
			desc.path = path.removeEndSlash(desc.path || desc.location || '');

			if (isPackage) {
				main = desc['main'] || './main';
				if (!path.isRelPath(main)) main = './' + main;
				// trailing slashes trick reduceLeadingDots to see them as base ids
				desc.main = path.reduceLeadingDots(main, desc.name + '/');
			}

			return desc;
		},

		/**
		 * @type {Function}
		 * @param {Array} pathlist
		 * @return {RegExp}
		 * @memberOf core
		 */
		generatePathMatcher: function (pathlist) {
			var pathExpressions;

			pathExpressions = pathlist
				.sort(sortBySpecificity)// put more specific paths, first
				.join('|')
				// escape slash and dot
				.replace(escapeRx, escapeReplace)
			;

			return new RegExp('^(' + pathExpressions + ')(?=\\/|$)');
		},

		arrayToPkgMap: function (array) {
			var map = {}, i = -1;
			while (++i < array.length) map[array[i].name] = array[i];
			return map;
		},

		/**
		 *
		 * @param {Object} defaultConfig
		 * @return {Object}
		 */
		init: function (defaultConfig) {
			var firstCfg;

			// bail if there's a global curl that's not an object literal
			if (prevCurl && !core.isType(prevCurl, 'Object')) return defaultConfig;

			// merge any attributes off the data-curl-run script element
			firstCfg = core.beget(prevCurl || {}, script.extractDataAttrConfig());

			// return the default config overridden with the global config(s)
			return core.beget(defaultConfig, firstCfg);
		}
	};



	/***** path *****/

	var path, absUrlRx, findDotsRx;

	absUrlRx = /^\/|^[^:]+:\/\//;
	findDotsRx = /(\.)(\.?)(?:$|\/([^\.\/]+.*)?)/g;

	/**
	 * @type {Object}
	 * @module 'curl/path'
	 */
	path = {
		/**
		 * Returns true if the url is absolute (not relative to the document)
		 * @param {String} url
		 * @return {Boolean}
		 */
		isAbsUrl: function (url) { return absUrlRx.test(url); },

		isRelPath: function (url) { return url.charAt(0) == '.'; },

		joinPaths: function (base, sub) {
			base = path.removeEndSlash(base);
			return (base ? base + '/' : '') + sub;
		},

		removeEndSlash: function (path) {
			return path && path.charAt(path.length - 1) == '/'
				? path.substr(0, path.length - 1)
				: path;
		},

		reduceLeadingDots: function (childId, baseId) {
			var removeLevels, normId, levels, isRelative, diff;
			// this algorithm is similar to dojo's compactPath, which
			// interprets module ids of "." and ".." as meaning "grab the
			// module whose name is the same as my folder or parent folder".
			// These special module ids are not included in the AMD spec
			// but seem to work in node.js, too.

			removeLevels = 1;
			normId = childId;

			// remove leading dots and count levels
			if (path.isRelPath(normId)) {
				isRelative = true;
				// replaceDots also counts levels
				normId = normId.replace(findDotsRx, replaceDots);
			}

			if (isRelative) {
				levels = baseId.split('/');
				diff = levels.length - removeLevels;
				if (diff < 0) {
					// this is an attempt to navigate above parent module.
					// maybe dev wants a url or something. punt and return url;
					return childId;
				}
				levels.splice(diff, removeLevels);
				// normId || [] prevents concat from adding extra "/" when
				// normId is reduced to a blank string
				return levels.concat(normId || []).join('/');
			}
			else {
				return normId;
			}

			function replaceDots (m, dot, dblDot, remainder) {
				if (dblDot) removeLevels++;
				return remainder || '';
			}
		}
	};


	/***** script loading *****/

	var doc, head, script, insertBeforeEl, runModuleAttr;

	doc = global.document;
	head = doc && (doc['head'] || doc.getElementsByTagName('head')[0]);
	insertBeforeEl = head && head.getElementsByTagName('base')[0] || null;
	runModuleAttr = 'data-curl-run';

	script = {
		/**
		 * @module 'curl/script'
		 * @param {Object} options
		 * @param {String} options.id
		 * @param {String} options.url
		 * @param {String} [options.mimetype]
		 * @param {String} [options.charset]
		 * @param {Boolean} [options.order]
		 * @param {Function} cb
		 * @param {Function} eb
		 * @return {HTMLScriptElement}
		 */
		load: function (options, cb, eb) {
			var el;
			// script processing rules learned from RequireJS

			el = doc.createElement('script');

			// js! plugin uses alternate mimetypes and such
			el.type = options.mimetype || 'text/javascript';
			el.charset = options.charset || 'utf-8';
			el.async = !options.order;
			el.src = options.url;

			// using dom0 event handlers instead of wordy w3c/ms
			el.onload = el.onreadystatechange = process;
			el.onerror = fail;

			// loading will start when the script is inserted into the dom.
			// IE will load the script sync if it's in the cache, so
			// indicate the current resource definition first.
			script.activeScripts[options.id] = el;

			// to keep IE from crying, we need to put scripts before any
			// <base> elements, but after any <meta>.
			head.insertBefore(el, insertBeforeEl);

			// the js! plugin uses this
			return el;

			// initial script processing
			function process (ev) {
				ev = ev || global.event;
				// detect when it's done loading
				// ev.type == 'load' is for all browsers except IE6-9
				// IE6-9 need to use onreadystatechange and look for
				// el.readyState in {loaded, complete} (yes, we need both)
				if (ev.type == 'load' || script.readyStates[el.readyState]) {
					delete script.activeScripts[options.id];
					// release event listeners
					el.onload = el.onreadystatechange = el.onerror = ''; // ie cries if we use undefined
					cb();
				}
			}

			function fail (e) {
				// some browsers send an event, others send a string, but none
				// of them send anything informative, so just say we failed:
				eb(new Error('Syntax or http error: ' + options.url));
			}
		},

		getCurrentModuleId: function () {
			// IE6-9 mark the currently executing thread as "interactive"
			// Note: Opera lies about which scripts are "interactive", so we
			// just have to test for it. Opera provides a true browser test, not
			// a UA sniff, thankfully.
			// learned this trick from James Burke's RequireJS
			var id;
			if (!core.isType(global['opera'], 'Opera')) {
				for (id in script.activeScripts) {
					if (script.activeScripts[id].readyState == 'interactive') {
						return id;
					}
				}
			}
		},

		/**
		 * @type {Object}
		 * this is the collection of scripts that IE is loading. one of these
		 * will be the "interactive" script. too bad IE doesn't send a
		 * readystatechange event to tell us exactly which one.
		 */
		activeScripts: {},

		/**
		 * readyStates for IE6-8
		 * @type {Object}
		 */
		readyStates: 'addEventListener' in global
			? {}
			: { 'loaded': 1, 'complete': 1 },

		findScript: function (predicate) {
			var i = 0, script;
			while (doc && (script = doc.scripts[i++])) {
				if (predicate(script)) return script;
			}
		},

		/**
		 *
		 * @return {Object|Undefined}
		 */
		extractDataAttrConfig: function () {
			var el, cfg;
			el = script.findScript(function (script) {
				var main;
				// find main module(s) in data-curl-run attr on script el
				// TODO: extract baseUrl, too?
				main = script.getAttribute(runModuleAttr);
				if (main) cfg = { main: main };
				return main;
			});
			// removeAttribute is wonky (in IE6?) but this works
			if (el) el.setAttribute(runModuleAttr, '');
			return cfg;
		}

	};

	/***** deferred *****/

	/**
	 * promise implementation adapted from https://github.com/briancavalier/avow
	 * @return {Deferred}
	 * @constructor
	 */
	function Deferred () {
		var dfd, promise, pendingHandlers, bindHandlers;

		promise = { then: then, yield: yieldVal };

		// Create a dfd, which has a pending promise plus methods
		// for fulfilling and rejecting the promise
		dfd = this;

		/**
		 * Provides access to the deferred's promise, which has .then() and
		 * .yield() methods.
		 * @type {Object}
		 */
		this.promise = promise;

		/**
		 * Fulfills a deferred, resolving its promise.
		 * @param value
		 */
		this.fulfill = function (value) {
			applyAllPending(applyFulfill, value);
		};
		/**
		 * Rejects a deferred, rejecting its promise.
		 * @param reason
		 */
		this.reject = function (reason) {
			applyAllPending(applyReject, reason);
		};

		// Queue of pending handlers, added via then()
		pendingHandlers = [];

		// Arranges for handlers to be called on the eventual value or reason
		bindHandlers = function (onFulfilled, onRejected, vow) {
			pendingHandlers.push(function (apply, value) {
				apply(value, onFulfilled, onRejected, vow.fulfill, vow.reject);
			});
		};

		return dfd;

		// Arrange for a handler to be called on the eventual value or reason
		function then (onFulfilled, onRejected) {
			var dfd = new Deferred();
			bindHandlers(onFulfilled, onRejected, dfd);
			return dfd.promise;
		}

		// When the promise is fulfilled or rejected, call all pending handlers
		function applyAllPending (apply, value) {
			var bindings;

			// Already fulfilled or rejected, ignore silently
			if (!pendingHandlers)  return;

			bindings = pendingHandlers;
			pendingHandlers = undefined;

			// The promise is no longer pending, so we can swap bindHandlers
			// to something more direct
			bindHandlers = function (onFulfilled, onRejected, vow) {
				core.nextTurn(function () {
					apply(value, onFulfilled, onRejected, vow.fulfill, vow.reject);
				});
			};

			// Call all the pending handlers
			core.nextTurn(function () {
				var binding;
				while (binding = bindings.pop()) binding(apply, value);
			});
		}

		function yieldVal (val) {
			return promise.then(function () { return val; });
		}
	}

	// Call fulfilled handler and forward to the next promise in the queue
	function applyFulfill (val, onFulfilled, _, fulfillNext, rejectNext) {
		apply(val, onFulfilled, fulfillNext, fulfillNext, rejectNext);
	}

	// Call rejected handler and forward to the next promise in the queue
	function applyReject (val, _, onRejected, fulfillNext, rejectNext) {
		apply(val, onRejected, rejectNext, fulfillNext, rejectNext);
	}

	// Call a handler with value, and take the appropriate action
	// on the next promise in the queue
	function apply (val, handler, fallback, fulfillNext, rejectNext) {
		var result;
		try {
			if (typeof handler != 'function') return fallback(val);
			result = handler(val);
			if (isPromise(result)) result.then(fulfillNext, rejectNext);
			else fulfillNext(result);
		}
		catch (e) {
			rejectNext(e);
		}
	}

	function isDeferred (it) {
		return it && it instanceof Deferred;
	}
	Deferred.isDeferred = isDeferred;

	function isPromise (it) {
		return it && typeof it.then == 'function';
	}
	Deferred.isPromise = isPromise;

	function when (it, callback, errback) {
		var dfd;
		if (!isPromise(it)) {
			dfd = new Deferred();
			dfd.fulfill(it);
			it = dfd.promise;
		}
		return it.then(callback, errback);
	}
	Deferred.when = when;

	// TODO: take the all function out and save about 70 bytes?
	function all (things) {
		var howMany, dfd, results, thing;

		howMany = 0;
		dfd = new Deferred();
		results = [];

		while (thing = things[howMany]) when(thing, counter(howMany++), dfd.reject);

		if (howMany == 0) dfd.fulfill(results);

		return dfd.promise;

		function counter (i) {
			return function (value) {
				results[i] = value;
				if (--howMany == 0) dfd.fulfill(results);
			};
		}
	}
	Deferred.all = all;


/***** debug *****/
(function () {
	var p, level;
//	level = '';
//	for (p in core) (function (orig, p) {
//		if (typeof orig == 'function')
//			core[p] = function () {
//				level = level + '  ';
//				console.log(level + 'core.' + p, '-->', arguments);
//				var result = orig.apply(this, arguments);
//				console.log(level + 'core.' + p, '<--', result);
//				level = level.substr(0, level.length - 2);
//				return result;
//			};
//	}(core[p], p));
//	for (p in amd) (function (orig, p) {
//		if (typeof orig == 'function')
//			amd[p] = function () {
//				level = level + '  ';
//				console.log(level + 'amd.' + p, '-->', arguments);
//				var result = orig.apply(this, arguments);
//				console.log(level + 'amd.' + p, '<--', result);
//				level = level.substr(0, level.length - 2);
//				return result;
//			};
//	}(amd[p], p));
}());

	/***** startup *****/

	var firstConfig, globalRealm;

	// default configs. some properties are quoted to assist GCC
	// Advanced Optimization.
	globalRealm = {
		cfg: {
			baseUrl: '',
			pluginPath: 'curl/plugin',
			dontAddFileExt: /\?|\.js\b/,
			paths: {},
			packages: {},
			plugins: {},
			preloads: undefined,
			main: undefined,
			type: 'amd',
			types: {
				amd: {
					require: {
						normalize: amd.transformId,
						locate: amd.locateModule,
						fetch: amd.fetchModule,
						transform: amd.parseFactory,
						resolve: core.resolveDeps,
						link: core.createFactoryExporter
					}
				}
			}
		},
		idToUrl: function (id) { return id; },
		cache: {
			'curl': curl,
			'curl/define': define,
			'curl/core': core,
			'curl/amd': amd,
			'curl/path': path,
			'curl/config': config,
			'curl/script': script,
			'curl/Deferred': Deferred
		}
	};

	// look for global configs and initialize the configs
	globalRealm.cfg = config.init(globalRealm.cfg);
	firstConfig = config.set(globalRealm.cfg);


	/***** exports *****/

	global['curl'] = curl;
	global['define'] = define;
	if (cjsModule) cjsModule.exports = curl;

	/***** utilities *****/

	var undefined; // this ensures `typeof undefined == 'undefined';`

	function ModuleContext () {}

	function ShortCircuit (result) {
		this.result = result;
	}

	function importErrorMessage (id) {
		// TODO: figure out how to display calling module's id
		return 'attempt to sync import ' + id + ' before it is resolved';
	}

	function Begetter () {}

	function own (obj, prop) {
		return obj && obj.hasOwnProperty(prop);
	}

	function sortBySpecificity (a, b) {
		return b.specificity - a.specificity;
	}

	function identity (val) { return val; }

}(
	// find global object (browser || commonjs)
	this.window || (typeof global != 'undefined' && global),
	// find commonjs module (ringojs || nodejs)
	this.module || (typeof module != 'undefined' && module)
));
