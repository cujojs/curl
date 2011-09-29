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
		version = '0.5.3',
		head = doc['head'] || doc.getElementsByTagName('head')[0],
		// configuration information
		baseUrl,
		pluginPath = 'curl/plugin',
		paths = {},
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
		findSlashRx = /\//,
		dontAddExtRx = /\?/,
		pathSearchRx,
		// script ready states that signify it's loaded
		readyStates = { 'loaded': 1, 'interactive': 1, 'complete': 1 },
		orsc = 'onreadystatechange',
		// the defaults for a typical package descriptor
		defaultDescriptor = {
			main: './lib/main',
			lib: './lib'
		},
		core;

	function isType (obj, type) {
		return toString.call(obj).indexOf('[object ' + type) == 0;
	}

	function normalizePkgDescriptor (descriptor, nameOrIndex) {
		// TODO: remove nameOrIndex param
		// we need to use strings for prop names to account for google closure

		// check for string shortcuts
		if (isType(descriptor, 'String')) {
			descriptor = removeEndSlash(descriptor);
			// fill in defaults
			descriptor = {
				id: descriptor,
				'path': descriptor,
				'main': defaultDescriptor.main,
				'lib': defaultDescriptor.lib
			};
		}

		descriptor.path = descriptor['path'] || ''; // (isNaN(nameOrIndex) ? nameOrIndex : descriptor.id);

		function normalizePkgPart (partName) {
			var path;
			if (partName in descriptor) {
				if (descriptor[partName].charAt(0) != '.') {
					// prefix with path
					path = joinPath(descriptor.path, descriptor[partName]);
				}
				else {
					// use normal . and .. path processing
					path = core.normalizeName(descriptor[partName], descriptor.path);
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

	function Promise () {

		var self = this,
			thens = [];

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

	function ResourceDef (id) {
		Promise.apply(this);
		this.id = id;
	}

	core = {

		extractCfg: function extractCfg (cfg) {
			var p, pStrip, path, pathList = [];

			baseUrl = cfg['baseUrl'] || '';

			// fix all paths
			var cfgPaths = cfg['paths'];
			for (p in cfgPaths) {
				pStrip = removeEndSlash(p.replace('!', '!/'));
				path = paths[pStrip] = { path: removeEndSlash(cfgPaths[p]) };
				path.specificity = (path.path.match(findSlashRx) || []).length;
				pathList.push(pStrip);
			}

			var cfgPackages = cfg['packages'];
			for (p in cfgPackages) {
				pStrip = removeEndSlash(cfgPackages[p]['id'] || p);
				path = paths[pStrip] = normalizePkgDescriptor(cfgPackages[p], pStrip);
				path.specificity = (path.path.match(findSlashRx) || []).length;
				pathList.push(pStrip);
			}

			// create path matcher
			pathSearchRx = new RegExp('^(' +
				pathList.sort(function (a, b) { return paths[a].specificity < paths[b].specificity; } )
					.join('|')
					.replace(/\//g, '\\/') +
				')(?=\\/|$)'
			);

			pluginPath = cfg['pluginPath'] || pluginPath;

		},

		begetCtx: function (id) {

			function toUrl (n) {
				return core.resolveUrl(core.resolvePath(core.normalizeName(n, baseId)), baseUrl);
			}

			var baseId = id.substr(0, id.lastIndexOf('/')),
				ctx = {
					baseId: baseId
				},
				exports = {},
				require = function (deps, callback) {
					return _require(deps, callback || noop, ctx);
				};
			// CommonJS Modules 1.1.1 compliance
			ctx.vars = {
				'exports': exports,
				'module': {
					'id': core.normalizeName(id, baseId),
					'uri': toUrl(id),
					'exports': exports
				}
			};

			ctx.require = ctx.vars['require'] = require;
			// using bracket property notation so closure won't clobber id
			require['toUrl'] = toUrl;

			return ctx;
		},

		begetCfg: function  (absPluginId) {
			var root;
			root = absPluginId ?
				userCfg['plugins'] && userCfg['plugins'][absPluginId] :
				userCfg;
			return beget(root);
		},

		resolvePath: function (id, prefix) {
			// TODO: figure out why this gets called so often for the same file
			// searches through the configured path mappings and packages
			// if the resulting module is part of a package, also return the main
			// module so it can be loaded.
			var pathInfo, path, found;

			function fixPath (id) {
				path = id.replace(pathSearchRx, function (match) {

					pathInfo = paths[match] || {};
					found = true;

					// if pathInfo.main and match == id, this is a main module
					if (pathInfo.main && match == id) {
						return pathInfo.main;
					}
					// if pathInfo.lib return pathInfo.lib
					else if (pathInfo.lib) {
						return pathInfo.lib;
					}
					else {
						return pathInfo.path || '';
					}

				});
			}

			// if this is a plugin-specific path to resolve
			if (prefix) {
				fixPath(prefix + '!/' + id);
			}
			if (!found) {
				fixPath(id);
			}

			return path;
		},

		resolveUrl: function (path, baseUrl, addExt) {
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

		resolveResDef: function (def, args, ctx) {

			// if a module id has been remapped, it will have a baseId
			var childCtx = core.begetCtx(def.baseId || def.id);

			// get the dependencies and then resolve/reject
			core.getDeps(def, args.deps, childCtx,
				function (deps) {
					try {
						// node.js assumes `this` === exports
						// anything returned overrides exports
						var res = args.res.apply(childCtx.vars['exports'], deps) || childCtx.vars['exports'];
					}
					catch (ex) {
						def.reject(ex);
					}
					def.resolve(res);
				},
				def.reject
			);

		},

		fetchResDef: function (def, ctx) {

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
							core.resolveResDef(def, args, ctx);
						}
					}

				},

				def.reject

			);

			return def;

		},

		normalizeName: function (id, baseId) {
			// if id starts with . then use parent's id as a base
			// if id starts with .. then use parent's parent
			return id.replace(normalizeRx, function (match, dot1, dot2) {
				return (dot2 ? baseId.substr(0, baseId.lastIndexOf('/')) : baseId) + '/';
			});
		},

		fetchDep: function (depName, ctx) {
			var id, delPos, prefix, resName, def, cfg;

			// check for plugin prefix
			delPos = depName.indexOf('!');
			if (delPos >= 0) {

				prefix = depName.substr(0, delPos);
				resName = depName.substr(delPos + 1);

				// prepend plugin folder path, if it's missing and path isn't in paths
				var prefixPath = core.resolvePath(prefix);
				var slashPos = prefixPath.indexOf('/');
				if (slashPos < 0) {
					prefixPath = core.resolvePath(joinPath(pluginPath, prefixPath));
				}

				// fetch plugin
				var pluginDef = cache[prefix];
				if (!pluginDef) {
					pluginDef = cache[prefix] = new ResourceDef(prefix);
					pluginDef.url = core.resolveUrl(prefixPath, baseUrl, true);
					pluginDef.baseId = prefixPath;
					core.fetchResDef(pluginDef, ctx);
				}

				// alter the toUrl passed into the plugin so that it can
				// also find plugin-prefixed path specifiers. e.g.:
				// "js!resourceId": "path/to/js/resource"
				// TODO: make this more efficient by allowing toUrl to be
				// overridden more easily and detecting if there's a
				// plugin-specific path more efficiently
				ctx = core.begetCtx(ctx.baseId);
				ctx.require['toUrl'] = function toUrl (absId) {
					var prefixed, path;
					path = core.resolvePath(absId, prefix);
					return core.resolveUrl(path, baseUrl);
				};

				// get plugin config
				cfg = core.begetCfg(prefix) || {};

				function toAbsId (id) {
					return core.normalizeName(id, ctx.baseId);
				}

				// we need to use depName until plugin tells us normalized id
				// if the plugin may changes the id, we need to consolidate
				// def promises below
				def = new ResourceDef(depName);

				pluginDef.then(
					function (plugin) {
						var normalizedDef;

						resName = depName.substr(delPos + 1);
						// check if plugin supports the normalize method
						if ('normalize' in plugin) {
							resName = plugin['normalize'](resName, toAbsId, cfg);
						}
						else {
							resName = toAbsId(resName);
						}

						// the spec is unclear, so we're using the full id (prefix + id) to id resources
						// so multiple plugins could each process the same resource
						id = prefix + '!' + resName;
						normalizedDef = cache[id];

						// if this is our first time fetching this (normalized) def
						if (!normalizedDef) {

							normalizedDef = new ResourceDef(id);

							// resName could be blank if the plugin doesn't specify a id (e.g. "domReady!")
							// don't cache non-determinate "dynamic" resources (or non-existent resources)
							if (resName && !plugin['dynamic']) {
								cache[id] = normalizedDef;
							}

							// curl's plugins prefer to receive the back-side of a promise,
							// but to be compatible with commonjs's specification, we have to
							// piggy-back on the callback function parameter:
							var loaded = normalizedDef.resolve;
							// using bracket property notation so closure won't clobber id
							loaded['resolve'] = loaded;
							loaded['reject'] = normalizedDef.reject;

							// load the resource!
							plugin.load(resName, ctx.require, loaded, cfg);

						}

						// chain defs (resolve when plugin.load executes)
						normalizedDef.then(def.resolve, def.reject);

					},
					def.reject
				);

			}
			else {
				resName = id = core.normalizeName(depName, ctx.baseId);

				def = cache[resName];
				if (!def) {
					def = cache[resName] = new ResourceDef(resName);
					def.url = core.resolveUrl(core.resolvePath(resName), baseUrl, true);
					core.fetchResDef(def, ctx);
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
				if (depName in ctx.vars) {
					deps[index] = ctx.vars[depName];
					count--;
				}
				else {
					// hook into promise callbacks
					core.fetchDep(depName, ctx).then(
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
			// a UA sniff thankfully.
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

	function _require (deps, callback, ctx) {
		// Note: callback could be a promise

		// RValue require
		if (isType(deps, 'String')) {
			// return resource
			var def = cache[deps],
				res = def && def.resolved;
			if (res === undef) {
				throw new Error('Module is not already resolved: '  + deps);
			}
			return res;
		}

		// resolve dependencies
		core.getDeps(null, deps, ctx,
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

		var args = aslice.call(arguments), callback, names, ctx;

		// extract config, if it's specified
		if (isType(args[0], 'Object')) {
			userCfg = args.shift();
			core.extractCfg(userCfg);
		}

		// extract dependencies
		names = [].concat(args[0]); // force to array TODO: create unit test when this is official
		callback = args[1];

		// this must be after extractCfg
		ctx = core.begetCtx('');

		var promise = new Promise(),
			api = {};

			// return the dependencies as arguments, not an array
			// using bracket property notation so closure won't clobber id
			api['then'] = function (resolved, rejected) {
				promise.then(
					function (deps) { if (resolved) resolved.apply(null, deps); },
					function (ex) { if (rejected) rejected(ex); else throw ex; }
				);
				return api;
			};

			// promise chaining
			api['next'] = function (names, cb) {
				var origPromise = promise;
				promise = new Promise();
				// wait for the previous promise
				origPromise.then(
					// get dependencies and then resolve the current promise
					function () { ctx.require(names, promise, ctx); },
					// fail the current promise
					function (ex) { promise.reject(ex); }
				);
				// execute this callback after dependencies
				if (cb) {
					promise.then(function (deps) {
						cb.apply(this, deps)
					});
				}
				return api;
			};

			if (callback) api['then'](callback);

		ctx.require(names, promise, ctx);

		return api;

	}

	function _define (/* various */) {

		var args = core.fixArgs(arguments),
			id = args.id;

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
				core.resolveResDef(def, args, core.begetCtx(id));
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

	// allow curl to be a dependency
	cache['curl'] = new ResourceDef(apiName);
	cache['curl'].resolve(_curl);

	// wrap inner _define so it can be replaced without losing define.amd
	define = global['define'] = function () { _define.apply(this, arguments); };
	_curl['version'] = version;

	// this is to comply with the AMD CommonJS proposal:
	define['amd'] = { 'plugins': true, 'curl': version };

	// expose curl core for special plugins and modules
	// Note: core overrides will only work in either of two scenarios:
	// 1. the files are running un-compressed (Google Closure or Uglify)
	// 2. the overriding module was compressed with curl.js
	// Compiling curl and the overriding module separately won't work.
	define('curl/_privileged', {
		'core': core,
		'cache': cache,
		'cfg': userCfg,
		'_require': _require,
		'_define': _define,
		'_curl': _curl,
		'global': global
	});

}(
	this,
	document,
	// grab configuration
	this['curl'] || {}
));
