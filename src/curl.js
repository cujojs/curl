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
(function (global) {
"use strict";
	var
		version = '0.8.0',
//		curlName = 'curl',
//		defineName = 'define',
//		runModuleAttr = 'data-curl-run',
		globalRealm,
//		prevCurl,
//		prevDefine,
		doc = global.document,
		head = doc && (doc['head'] || doc.getElementsByTagName('head')[0]),
		// constants / flags
//		msgUsingExports = {},
//		msgFactoryExecuted = {},
		// these are always handy :)
		cleanPrototype = {},
		toString = cleanPrototype.toString,
		undef,
		// local cache of resource definitions (lightweight promises)
		cache = {},
		// local url cache
//		urlCache = {},
		// preload is a promise for files that must be loaded before any others
//		preload = false,
		// net to catch anonymous define()s' arguments (non-IE browsers)
		argsNet,
		// RegExp's used later, pre-compiled here
//		findDotsRx = /(\.)(\.?)(?:$|\/([^\.\/]+.*)?)/g,
//		splitMainDirectives = /\s*,\s*/,
		core;

	core = {

		/***** module pipelines *****/

		createPipeline: function (tasks) {
			var head, i;
			head = tasks[0];
			i = 0;
			while (++i < tasks.length) head = queue(head, tasks[i]);
			return head;
		},

		resolveDeps: function (mctx) {
			var promises, i;
			promises = [];
			i = 0;
			while (i < mctx.deps.length) promises.push(resolveAndCache(mctx.deps[i++]));
			return all(promises).yield(mctx);

			function resolveAndCache (id) {
				return core.requireModule(mctx.realm, id).then(function (ctx) {
					return mctx.realm.cache[id] = mctx;
				});
			}
		},

		requireModule: function (pctx, id) {
			var realm = pctx.realm, mctx;
			// check for pseudo-modules
			if (id in core.cjsFreeVars) return core.cjsFreeVars[id].call(mctx);
			// check in cache
			if (id in realm.cache) return realm.cache[id];
			if (!realm.locate) realm.locate = core.createPipeline(realm.cfg.locate);
			// TODO: should the context be created here or by the first step in the pipeline?
			mctx = core.createModuleContext(realm, id);
			return realm.cache[id] = realm.locate(mctx);
		},

		defineModule: function (mctx) {
			var realm = mctx.realm, id = mctx.id;
			if (realm.cache[id]) throw new Error(id + ' already defined.');
			if (!realm.declare) realm.declare = core.createPipeline(realm.cfg.declare);
			return realm.cache[id] = realm.declare(mctx);
		},

		createFactoryExporter: function (mctx) {
			// hmm... is this the general pattern or is this too specific to
			// CJS/AMD?
			mctx.runFactory = function () {
				var i, params, dctx, param;
				i = 0;
				params = [];
				while (i++ < mctx.deps.length) {
					dctx = mctx.realm.cache[mctx.deps[i]];
					param = core.isModuleContext(dctx)
						? core.importModuleSync(dctx)
						: dctx;
					params.push(param);
				}
				return mctx.factory.apply(null, params);
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
			if (notReady) throw new Error(importErrorMessage(mctx));
			if (core.isModuleContext(mctx)) realm.cache[id] = mctx.runFactory();
			return realm.cache[id];
		},

		/**** module context *****/

		isModuleContext: function (it) {
			return it instanceof ModuleContext;
		},

		createModuleContext: function (id, parentRealm) {
			return new ModuleContext(id, parentRealm);
		},

		initModuleContext: function (mctx) {
			var realm, pathMap, id, pathInfo, url;

			// TODO: generate _pathMap and _pathRx
			// TODO: _pathMap should prefix baseUrl in advance

			realm = mctx.parentRealm;
			pathMap = realm.cfg._pathMap;
			id = mctx.id;

			if (!core.isAbsUrl(id)) {
				url = id.replace(realm.cfg._pathRx, function (match) {
					pathInfo = pathMap[match] || {};
					mctx.realm = pathInfo.realm;
					return pathInfo.path || '';
				});
			}
			else {
				url = id;
			}
			// NOTE: if url == id, then the id *is* a url, not an id!
			// should we do anything with this knowledge?

			mctx.url = url;

			return mctx;
		},

		/***** amd-specific functions *****/

		resolveAmdCtx: function (mctx) {
			// TODO: if module has no id, see if it's a newly-loaded anonymous module
			// TODO: where does the id transformation go? should it happen in an import pipeline?
			// resolve url, etc
			return when(core.initModuleContext(mctx));
		},

		fetchAmdModule: function (mctx) {
			var dfd = new Deferred();
			core.loadScript(mctx, resolve, dfd.reject);
			return dfd.promise;

			function resolve () {
				var args = argsNet;
				argsNet = undef;
				// TODO: determine if we can process all define()s here rather than processing some in defineAmdModule
				if (!args) {
					args = mctx.useNet === false
						? {}
						: { ex: 'define() not found:' + mctx.url };
				}
				if (args.ex) {
					dfd.reject(new Error(args.ex));
				}
				else {
					core.assignAmdProperties.apply(mctx, args);
					dfd.fulfill(mctx);
				}
			}
		},

		defineAmdModule: function (id, deps, factory, isCjsWrapped) {
			var mctx;

			if (undef == id) {
				if (undef != argsNet) {
					argsNet = { ex: 'Multiple anonymous defines in url or AMD module loaded via <script/> or js! plugin' };
				}
				// check if we can find id in activeScripts
				else if (!(id = core.getCurrentModuleId())) {
					argsNet = arguments;
				}
			}

			if (undef != id) {
				// create or lookup mctx in cache
				// TODO: how do we support multiple realms when resolving here?
				// TODO: can we resolve in fetchAmdModule's callback instead?
				if ((id in globalRealm.cache)) {
					mctx = globalRealm.cache[id];
				}
				else {
					mctx = core.createModuleContext(id, globalRealm);
				}
				// append amd-specific stuff
				core.assignAmdProperties.apply(mctx, arguments);
				mctx.useNet = false;
				// initiate pipeline
				core.defineModule(mctx);
			}
		},

		assignAmdProperties: function (id, deps, factory, isCjsWrapped) {
			this.id = id;
			this.deps = deps;
			this.factory = factory;
			this.isCjsWrapped = isCjsWrapped;
			return this;
		},

		fixDefineArgs: function (args) {
			var id, deps, factory, arity, len, cjs;
			// valid combinations for define:
			// define(string, array, <anything>)
			// define(array, <anything>)
			// define(string, <anything>)
			// define(function)
			// define(object) // anything but a string or array

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

			// Hybrid format: assume that a definition function with zero
			// dependencies and non-zero arity is a wrapped CommonJS module
			if (!deps && arity > 0) {
				cjs = true;
				deps = ['require', 'exports', 'module'].slice(0, arity).concat(core.extractCjsDeps(factory));
			}

			return [
				id,
				deps,
				arity >= 0 ? factory : function () { return factory; },
				cjs
			];
		},

		parseAmdFactory: function (mctx) {
			var rvals;
			if (!mctx.isCjsWrapped) return mctx;
			rvals = core.extractCjsDeps(mctx.factory);
			if (rvals.length > 0) {
				mctx.deps = (mctx.deps || []).concat(rvals);
			}
			return mctx;
		},

		/***** script loading *****/

		/**
		 * this is the collection of scripts that IE is loading. one of these
		 * will be the "interactive" script. too bad IE doesn't send a
		 * readystatechange event to tell us exactly which one.
		 */
		activeScripts: {},

		/** readyStates for IE6-9 */
		readyStates: 'addEventListener' in global
			? {}
			: { 'loaded': 1, 'complete': 1 },

		loadScript: (function (insertBeforeEl) {
			return function (mctx, cb, eb) {
				var el;
				// script processing rules learned from RequireJS

				el = doc.createElement('script');

				// js! plugin uses alternate mimetypes and such
				el.type = mctx.mimetype || 'text/javascript';
				el.charset = mctx.charset || 'utf-8';
				el.async = !mctx.order;
				el.src = mctx.url;

				// using dom0 event handlers instead of wordy w3c/ms
				el.onload = el.onreadystatechange = process;
				el.onerror = fail;

				// loading will start when the script is inserted into the dom.
				// IE will load the script sync if it's in the cache, so
				// indicate the current resource definition first.
				core.activeScripts[mctx.id] = el;

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
					if (ev.type == 'load' || core.readyStates[el.readyState]) {
						delete core.activeScripts[mctx.id];
						// release event listeners
						el.onload = el.onreadystatechange = el.onerror = ''; // ie cries if we use undefined
						cb();
					}
				}

				function fail (e) {
					// some browsers send an event, others send a string,
					// but none of them send anything useful, so just say we failed:
					eb(new Error('Syntax or http error: ' + mctx.url));
				}
			}
		}(head && head.getElementsByTagName('base')[0] || null)),

		getCurrentModuleId: function () {
			// IE6-9 mark the currently executing thread as "interactive"
			// Note: Opera lies about which scripts are "interactive", so we
			// just have to test for it. Opera provides a true browser test, not
			// a UA sniff, thankfully.
			// learned this trick from James Burke's RequireJS
			var id;
			if (!core.isType(global['opera'], 'Opera')) {
				for (id in core.activeScripts) {
					if (core.activeScripts[id].readyState == 'interactive') {
						return id;
					}
				}
			}
		},

		/***** config *****/

		config: function (cfg) {
			// override and replace globalRealm.cfg
			// if preloads, fetch them
			// if main, fetch them
		},

		// TODO: should this be a separate API call (noConflict(cfg)) from config()?
		setApi: function (cfg) {

		},

		/***** utilities *****/

		cjsFreeVars: {
			// these should be called in the context of a mctx
			'require': function () { return this.require; },
			'exports': function () {
				return this.exports || (this.exports = {});
			},
			'module': function () {
				var module = this.module;
				if (!module) {
					module = this.module = {
						'id': this.id,
						'uri': this.url,
						'exports': core.cjsFreeVars.exports.call(this),
						'config': function () { return this.realm.cfg; }
					};
					module.exports = module['exports']; // GCC AO issue?
				}
				return this.module;
			}
		},

		extractCjsDeps: (function (removeCommentsRx, findRValueRequiresRx) {
			return function (factory) {
				// Note: ignores require() inside strings and comments
				var source, ids = [], currQuote;
				// prefer toSource (FF) since it strips comments
				source = typeof factory == 'string' ?
						 factory :
						 factory.toString();
				// remove comments, then look for require() or quotes
				source.replace(removeCommentsRx, '').replace(findRValueRequiresRx, function (m, rq, id, qq) {
					// if we encounter a string in the source, don't look for require()
					if (qq) {
						currQuote = currQuote == qq ? undef : currQuote;
					}
					// if we're not inside a quoted string
					else if (!currQuote) {
						ids.push(id);
					}
					return ''; // uses least RAM/CPU
				});
				return ids;
			}
		}(
			/\/\*[\s\S]*?\*\/|\/\/.*?[\n\r]/g,
			/require\s*\(\s*(["'])(.*?[^\\])\1\s*\)|[^\\]?(["'])/g
		)),

		/**
		 * Returns true if the url is absolute (not relative to the document)
		 * @param {String} url
		 * @return {Boolean}
		 */
		isAbsUrl: (function (absUrlRx) {
			return function (url) {
					return absUrlRx.test(url);
			}
		}(/^\/|^[^:]+:\/\//)),

		/**
		 * Returns true if the thing to test has the constructor named.
		 * @param {*} it is the thing to test
		 * @param {String} type is the name of the constructor for the type
		 * @return {Boolean}
		 */
		isType: (function (toString) {
			return function (it, type) {
				return toString.call(it).indexOf('[object ' + type) == 0;
			}
		}(Object.prototype.toString)),

		/**
		 * Executes a task in the "next turn". Prefers process.nextTick or
		 * setImmediate, but will fallback to setTimeout.
		 * @param {Function} task
		 */
		nextTurn: typeof global.setImmediate == 'function'
			? global.setImmediate.bind(global)
			: typeof process === 'object' && process.nextTick
				? process.nextTick
				: function (task) { setTimeout(task, 0); }

	};

	/***** startup *****/

	// default configs
	globalRealm = {
		cfg: {
			baseUrl: '',
			pluginPath: 'curl/plugin',
			dontAddFileExt: /\?|\.js\b/,
			paths: {},
			packages: {},
			plugins: {},
			_pathMap: {},
			pathRx: /$^/,
			type: 'amd',
			types: {
				amd: {
					declare: [
						core.parseAmdFactory,
						core.resolveDeps,
						core.createFactoryExporter
					],
					locate: [
						core.resolveAmdCtx,
						core.fetchAmdModule
					]
				}
			}
		},
		cache: {
//			'curl': curl,
//			'curl/define': _define,
//			'curl/config': function () { return globalRealm.cfg; },
			'curl/core': core,
			'curl/Deferred': Deferred
		}
	};

	// TODO: look for global config, `global.curl`
	// look for "data-curl-run" directive, and override config
//	globalRealm.cfg = core.extractDataAttrConfig(globalRealm.cfg);

	/***** define *****/

	// TODO: make this namespaceable / renameable
	global.define = function () {
		var args = core.fixDefineArgs(arguments);
		core.defineAmdModule.apply(this, args);
	};

	/***** promises / deferreds *****/

	// promise implementation adapted from https://github.com/briancavalier/avow
	function Deferred () {
		var dfd, promise, pendingHandlers, bindHandlers;

		promise = { then: then, yield: yieldVal };

		// Create a dfd, which has a pending promise plus methods
		// for fulfilling and rejecting the promise
		dfd = this;

		this.promise = promise;

		this.fulfill = function (value) {
			applyAllPending(applyFulfill, value);
		};

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
			pendingHandlers = undef;

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
		return apply(val, onFulfilled, fulfillNext, fulfillNext, rejectNext);
	}

	// Call rejected handler and forward to the next promise in the queue
	function applyReject (val, _, onRejected, fulfillNext, rejectNext) {
		return apply(val, onRejected, rejectNext, fulfillNext, rejectNext);
	}

	// Call a handler with value, and take the appropriate action
	// on the next promise in the queue
	function apply (val, handler, fallback, fulfillNext, rejectNext) {
		var result;
		try {
			if (typeof handler === 'function') {
				result = handler(val);

				if (result && typeof result.then === 'function') {
					result.then(fulfillNext, rejectNext);
				} else {
					fulfillNext(result);
				}

			} else {
				fallback(val);
			}
		} catch (e) {
			rejectNext(e);
		}
	}

	function isDeferred (it) {
		return it && it instanceof Deferred;
	}
	Deferred.isDeferred = isDeferred;

	 function isPromise (it) {
		return it && it.then == 'function';
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

	function queue (task1, task2) {
		return function () { return task1.apply(this, arguments).then(task2); };
	}

	/***** public curl API *****/

	/**
	 *
	 * @param {Array} ids
	 * @param {Function} [callback]
	 * @param {Function} [errback]
	 * @constructor
	 */
	function CurlApi (ids, callback, errback, waitFor) {
		var ctx, dfd, promise;

		// TODO: ensure next-turn so inline code can execute first

		// defaults
		if (!callback) callback = noop;
		if (!errback) errback = function (ex) { throw ex; };

		dfd = new Deferred();

		if (ids) {
			// create a phony module context
			ctx = core.createModuleContext('', globalRealm);
			ctx.deps = ids || []; // prevents cjs-wrapped functionality
			ctx.factory = callback; // callback mimics a module factory
		}

		promise = when(waitFor, function () {
			var deps;
			// get the dependencies, if any
			deps = ctx && core.resolveDeps(ctx).then(
				function () {
					core.createFactoryExporter(ctx);
					ctx.runFactory();
					return ctx;
				},
				errback
			);
			// resolve
			return when(deps, dfd.fulfill, dfd.reject);
		});

		/**
		 *
		 * @param {Function} [callback]
		 * @param {Function} [errback]
		 * @return {CurlApi}
		 * @memberOf CurlApi
		 */
		this['then'] = function (callback, errback) {
			ctx && promise.then(function () {
				// set the new "factory" and re-run it
				ctx.factory = callback;
				ctx.runFactory();
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
		 * @param {Function} [callback]
		 * @param {Function} [errback]
		 * @return {CurlApi}
		 * @memberOf CurlApi
		 */
		this['config'] = function (cfg, callback, errback) {
			// don't wait for previous promise to start config
			promise = all([promise, core.config(cfg)]);
			if (callback || errback) promise = promise.then(callback, errback);
			return this;
		};
	}

	/**
	 * @param {Object} [cfg]
	 * @param {Array|String} [ids]
	 * @param {Function} [callback]
	 * @param {Function} [errback]
	 * @return {CurlApi}
	 */
	function curl (/* various */) {
		var args, promise, cfg;

		args = [].slice.call(arguments);

		// sync curl(id)
		if (core.isType(args[0], 'String')) {
			var ctx = globalRealm.cache[args[0]];
			return core.isModuleContext(ctx)
				? core.importModuleSync(ctx)
				: ctx;
		}

		// extract config, if it's specified
		if (core.isType(args[0], 'Object')) {
			cfg = args.shift();
			promise = core.config(cfg);
		}

		return new CurlApi(args[0], args[1], args[2], promise);
	}

	/**
	 *
	 * @type {String}
	 */
	curl['version'] = version;

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

	// TODO: make this moveable / renamable
	global.curl = curl;

	/***** utilities *****/

	function ModuleContext (id, parentRealm) {
		this.id = id;
		this.parentRealm = parentRealm;
		this.realm = parentRealm; // could be replaced later
	}

	function importErrorMessage (mctx) {
		// TODO: figure out how to display calling module's id
		return 'attempt to sync import ' + mctx.id + ' before it is resolved';
	}

	function noop () {}

}(this.window || (typeof global != 'undefined' && global) || this));
