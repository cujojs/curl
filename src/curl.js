/**
 * curl (cujo resource loader)
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licnsed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 * 
 */

// TODO: code documentation!!!
// TODO: packages
// TODO: commonjs exports and module dependencies
// TODO: finish debug plugin

(function (global, doc) {

	/*
	 * Overall operation:
	 * When a dependency is encountered and it already exists, it's returned.
	 * If it doesn't already exist, it is created and the dependency's script
	 * is loaded. If there is a define call in the loaded script with a name,
	 * it is resolved asap (i.e. as soon as the dependency's dependencies are
	 * resolved). If there is a (single) define call with no name (anonymous),
	 * the resource in the resNet is resolved after the script's onload fires.
	 * IE requires a slightly different tactic. IE marks the readyState of the
	 * currently executing script to 'interactive'. If we can find this script
	 * while a define() is being called, we can match the define() to its name.
	 * Opera, why are you being so difficult!?!?!?!?
	 */


	var
		version = '0.3',
		// local cache of resource definitions (lightweight promises)
		cache = {},
		// default configuration
		config = {
			doc: doc,
			baseUrl: null, // auto-detect
			pluginPath: 'curl/plugin/', // prepended to naked plugin references
			paths: {}
		},
		// net to catch anonymous define calls' arguments (non-IE browsers)
		argsNet,
		// this is the list of scripts that IE is loading. one of these will
		// be the "interactive" script. too bad IE doesn't send a readystatechange
		// event to tell us exactly which one.
		activeScripts = {},
		// this is always handy :)
		op = Object.prototype,
		toString = op.toString,
		// and this
		undef,
		aslice = [].slice,
		// RegExp's used later, "cached" here
		pathRe = /[^\/]*(?:\/|$)/g,
		baseUrlRe = /^\/\/|^[^:]*:\/\//,
		normalizeRe = /^\.\//,
		findCurlRe = /(.*\/curl)\..*js$/,
		readyStates = { loaded: 1, interactive: 1, complete: 1 },
		// reused strings
		errorSuffix = '. Syntax error or name mismatch.';

	function forin (obj, lambda) {
		for (var p in obj) {
			if (!(p in op)) {
				lambda(obj[p], p, obj);
			}
		}
	}

	function isType (obj, type) {
		return toString.call(obj).indexOf('[object ' + type) == 0;
	}
	function _isType (obj, type) {
		return toString.call(obj) == type;
	}
	function isFunction (obj) {
		return _isType(obj, '[object Function]');
	}

	function isString (obj) {
		return _isType(obj, '[object String]');
	}

	function isArray (obj) {
		return _isType(obj, '[object Array]');
	}

	function F () {}
	function beget (ancestor) {
		F.prototype = ancestor;
		var o = new F();
		delete F.prototype;
		return o;
	}

	function begetCtx (oldCtx, name) {
		var ctx = beget(oldCtx || { doc: config.doc, baseUrl: config.baseUrl, require: _require });
		if (name) {
			var pos = name.lastIndexOf('/');
			ctx.baseName = name.substr(0, pos + 1);
		}
		ctx.require = function (deps, callback) {
			return _require(deps, callback, ctx);
		};
		// using bracket property notation to closure won't clobber name
		ctx.require['toUrl'] = function (name) {
			return fixPath(normalizeName(name, ctx), ctx.baseUrl);
		};
		if (ctx.doc && !ctx.head) {
			ctx.head = ctx.doc.getElementsByTagName('head')[0];
		}
		return ctx;
	}

	function Promise () {
		this._resolves = [];
		this._rejects = [];
	}

	Promise.prototype = {

		then: function (resolved, rejected) {
			// capture calls to callbacks
			resolved && this._resolves.push(resolved);
			rejected && this._rejects.push(rejected);
		},

		resolve: function (val) { this._complete(this._resolves, val); },

		reject: function (ex) { this._complete(this._rejects, ex); },

		_complete: function (which, arg) {
			// switch over to sync then()
			this.then = which === this._resolves ?
				function (resolve, reject) { resolve(arg); } :
				function (resolve, reject) { reject(arg); };
			// disallow multiple calls to resolve or reject
			this.resolve = this.reject =
				function () { throw new Error('Promise already completed.'); };
			// complete all callbacks
			var cb, i = 0;
			while ((cb = which[i++])) { cb(arg); }
			delete this._resolves;
			delete this._rejects;
		}

	};

	function ResourceDef (name, ctx) {
		Promise.call(this);
		this.name = name;
		this.ctx = ctx;
	}

	ResourceDef.prototype = new Promise();
	ResourceDef.prototype._complete = function (which, arg) {
		Promise.prototype._complete.call(this, which, arg);
		delete this.ctx;
		delete this.url;
	};

	function fixEndSlash (path) {
		return path.charAt(path.length - 1) === '/' ? path : path + '/';
	}

	function fixPath (name, baseUrl) {
		// TODO: stop appending a '/' to all cfg.paths properties to see if it simplifies this routine
		// takes a resource name (w/o ext!) and resolves it to a url
		var paths = config.paths,
			part = '',
			prefix = '',
			key = fixEndSlash(name),
			path = paths[key];
		// we didn't have an exact match so find the longest match in config.paths.
		if (path === undef) {
			pathRe.lastIndex = 0; // literal regexes are cached globally, so always reset this
			while ((part += pathRe.exec(key)) && paths[part]) {
				prefix = part;
			}
			path = paths[prefix] || '';
		}
		// prepend baseUrl if we didn't find an absolute url
		if (!baseUrlRe.test(path)) path = baseUrl + path;
		// append name
		return path + name.substr(prefix.length);
	}

	function toUrl (name, ext, ctx) {
		// TODO: packages in a CommonJS extension
		return fixPath(name, ctx.baseUrl) + (ext ? '.' + ext : '');
	}

	function loadScript (def, success, failure) {
		// script processing rules learned from RequireJS

		// insert script
		var el = def.ctx.doc.createElement('script'),
			head  = def.ctx.head;

		// initial script processing
		function process (ev) {
			ev = ev || global.event;
			// detect when it's done loading
			if (ev.type === 'load' || readyStates[this.readyState]) {
				delete activeScripts[def.name];
				// release event listeners
				this.onload = this.onreadystatechange = this.onerror = null;
				success(el);
			}
		}

		function fail (e) {
			// some browsers send an event, others send a string,
			// but none of them send anything useful, so just say we failed:
			failure(new Error('Script error: ' + def.url + errorSuffix));
		}

		// set type first since setting other properties could
		// prevent us from setting this later
		el.type = def.mimetype || 'text/javascript';
		// using dom0 event handlers instead of wordy w3c/ms
		el.onload = el.onreadystatechange = process;
		el.onerror = fail;
		el.charset = def.charset || 'utf-8';
		el.async = 'async' in def ? def.async : true; // for Firefox
		el.src = def.url;

		// loading will start when the script is inserted into the dom.
		// IE will load the script sync if it's in the cache, so
		// indicate the current resource definition if this happens.
		activeScripts[def.name] = el;
		// use insertBefore to keep IE from throwing Operation Aborted (thx Bryan Forbes!)
		head.insertBefore(el, head.firstChild);

	}

	function fixArgs (args, isRequire) {
		// resolve args
		// valid combinations for define:
		// (string, array, object|function) sax|saf
		// (array, object|function) ax|af
		// (string, object|function) sx|sf
		// (object|function) x|f
		// valid combinations for require:
		// (object, array, object|function) oax|oaf
		// (array, object|function) ax|af
		// (string) s
		// TODO: check invalid argument combos here?
		// TODO: CommonJS require('string') syntax in an extension
		function toFunc (res) {
			return isFunction(res) ? res : function () { return res; };
		}
		var len = args.length,
			res;
		if (len === 3) {
			res = { name: args[0], deps: args[1], res: toFunc(args[2]) };
		}
		else if (len == 2 && isString(args[0])) {
			res = { name: args[0], res: toFunc(args[1]) };
		}
		else if (len == 2) {
			res = { deps: args[0], res: toFunc(args[1]) };
		}
		// TODO: document this: if a require(array) is encountered , it assumes the array is a list of dependencies so that we can return a promise, define(array) assumes the array is the resource
		else if (isString(args[0]) || (isArray(args[0]) && isRequire)) {
			res = { deps: args[0] };
		}
		else {
			res = { res: toFunc(args[0]) };
		}
		return res;
	}

	function fetchResDef (name, ctx) {

		var def = cache[name] = new ResourceDef(name, ctx);
		def.url = toUrl(name, 'js', ctx);

		loadScript(def,

			function () {

				var args = argsNet;
				argsNet = undef; // reset it before we get deps

				// if our resource was not explicitly defined with a name (anonymous)
				// Note: if it did have a name, it will be resolved in the define()
				if (def.useNet !== false) {
					if (!args) {
						// uh oh, nothing was added to the resource net
						def.reject(new Error('define() not found: ' + def.url + errorSuffix));
					}
					else if (args.ex) {
						// the resNet resource was already rejected, but it didn't know
						// its name, so reject this def with better information
						def.reject(new Error(args.ex.replace('${url}', def.url)));
					}
					else if (!args.deps) {
						// no dependencies, just call the definition function
						def.resolve(args.res());
					}
					else {
						// resolve dependencies and execute definition function here
						// because we couldn't get the cfg in the anonymous define()
						getDeps(args.deps, begetCtx(ctx, def.name),
							function (deps) {
								def.resolve(args.res.apply(null, deps));
							},
							function (ex) {
								def.reject(ex);
							}
						);
					}
				}

			},

			function (ex) {
				def.reject(ex);
			}

		);

		return def;

	}

	function fetchPluginDef (fullName, prefix, name, ctx) {

		// prepend plugin folder path, if it's missing
		prefix = fixPath(prefix, '');
		var slashPos = prefix.indexOf('/');
		if (slashPos < 0) {
			fullName = config.pluginPath + fullName;
			prefix = config.pluginPath + prefix;
		}
		// the spec is unclear, but we're using the full name (prefix + name) to id resources
		var def = cache[fullName] = new ResourceDef(name, ctx);

		// curl's plugins prefer to receive the back-side of a promise,
		// but to be compatible with commonjs's specification, we have to
		// piggy-back on the callback function parameter:
		var loaded = function (res) { def.resolve(res); };
		// using bracket property notation to closure won't clobber name
		loaded['resolve'] = loaded;
		loaded['reject'] = function (ex) { def.reject(ex); };
		loaded['then'] = function (resolved, rejected) { def.then(resolved, rejected); };

		// go get plugin
		ctx.require([prefix], function (plugin) {
			// load the resource!
			plugin.load(name, begetCtx(ctx, name).require, loaded, ctx);

		});

		return def;

	}

	function normalizeName (name, ctx) {
		// if name starts with . then use parent's name as a base
		return name.replace(normalizeRe, ctx.baseName);
	}

	function getDeps (names, ctx, success, failure) {
		// TODO: throw if multiple exports found?
		// TODO: supply exports and module in a commonjs extension

		var deps = [],
			count = names ? names.length : 0,
			len = count,
			completed = false,
			depName;

		// obtain each dependency
		for (var i = 0; i < len && !completed; i++) (function (index, depName) {
			if (depName == 'require') {
				deps[index] = ctx.require;
				count--;
			}
			//else if (dep === 'exports') {
			//	throw new Error('exports parameter not supported.');
			//}
			//else if (dep === 'module') {
			//	throw new Error('module parameter not supported.');
			//}
			else {
				var name, /*parts, */delPos, prefix, suffixes, resName;
				// check for plugin prefix
				//parts = depName.split('!');
				delPos = depName.indexOf('!');
				//if (parts.length > 1) {
				if (delPos >= 0) {
					// hm, this normalizeName allows plugins to be relative to
					// the parent module. is this a feature?
					//prefix = normalizeName(parts[0], ctx);
					prefix = normalizeName(depName.substr(0, delPos), ctx);
					//resName = parts[1];
					resName = depName.substr(delPos + 1);
					name = prefix + '!' + resName;
				}
				else {
					resName = name = normalizeName(depName, ctx);
				}
				// get resource definition
				var def = cache[name] || 
						(prefix ?
							fetchPluginDef(name, prefix, resName, ctx) :
							fetchResDef(resName, ctx)
						);
				// hook into promise callbacks
				def.then(
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
		if (count === 0 && !completed) {
			success([]);
		}

	}

	function getCurrentDefName () {
		// Note: Opera lies about which scripts are "interactive", so we
		// just have to test for it. Opera provides a true test, not a sniff
		// thankfully.
		var def;
		if (!_isType(global.opera, '[object Opera]')) {
			for (var d in activeScripts) {
				if (activeScripts[d].readyState == 'interactive') {
					def = d;
					break;
				}
			}
		}
		return def;
	}

	function _require (deps, callback, ctx) {
		// Note: callback could be a promise

		// sync require
		// TODO: move this to a CommonJS extension
		if (isString(deps)) {
			// return resource
			// TODO: Bryan had it this way: def = normalizeName(cache[deps], ctx); he may be right!!!
			var def = normalizeName(cache[deps], ctx),
				res;
			if (def) {
				// this is a silly, convoluted way to get a value out of a resolved promise
				def.then(function (r) { res = r; });
			}
			if (res === undef) {
				throw new Error('Resource (' + deps + ') is not already resolved.');
			}
			return res;
		}

		// resolve dependencies
		getDeps(deps, ctx,
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

		var len = arguments.length,
			args;

		if (len === 3) {
			// local configuration
			forin(arguments[0], function (value, p) {
				config[p] = value;
			});
		}

		var ctx = begetCtx(null, '');
		// extract config, if it's there
		args = fixArgs(len === 3 ? aslice.call(arguments, 1) : arguments, true);

		// check if we should return a promise
		// TODO: move commonjs behavior out to an extension (if !isString(args.deps) require() returns a resource)
		if (!isString(args.deps)) {
			var callback = args.res,
				promise = args.res = new Promise(),
				waitingForDomReady,
				api = {};
			// return the dependencies as arguments, not an array
			// using bracket property notation to closure won't clobber name
			api['then'] = function (resolved, rejected) {
				promise.then(
					function (deps) { resolved.apply(null, deps); },
					function (ex) { if (rejected) rejected(ex); else throw ex; }
				);
				return api;
			};
			api['require'] = function (deps, cb) {
				var origPromise = promise;
				promise = new Promise();
				origPromise.then(
					function () {
						ctx.require(deps, promise, ctx);
					}
				);
			};
			if (callback) api.then(callback);
		}

		var result = ctx.require(args.deps, args.res, ctx);
		return api || result;

	}

	function _define (/* various */) {

		var args = fixArgs(arguments, false),
			name = args.name;

		if (name == null) {
			if (argsNet !== undef) {
				argsNet = {ex: 'Multiple anonymous defines found in ${url}.'};
			}
			else if (!(name = getCurrentDefName())/* intentional assignment */) {
				// anonymous define(), defer processing until after script loads
				argsNet = args;
			}
		}
		if (name != null) {
			// named define(), it is in the cache if we are loading a dependency
			// (could also be a secondary define() appearing in a built file, etc.)
			// if it's a secondary define(), grab the current def's context
			var def = cache[name];
			if (!def) {
				def = cache[name] = new ResourceDef(name, begetCtx(null, name));
			}
			def.useNet = false;
			if (!args.deps) {
				// call definition function
				def.resolve(args.res());
			}
			else {
				// resolve dependencies and call the definition function
				getDeps(args.deps, begetCtx(def.ctx, name),
					function (deps) { def.resolve(args.res.apply(null, deps)); },
					function (ex) { def.reject(ex); }
				);
			}
		}

	}

//	function _extend (/* arguments */) {
//		/*
//			curl.extend('debug', 'js', 'commonjs', 'domReady')
//				.require(['js!myApp.js', 'css!locale.css', 'domReady'])
//				.then(function (myApp, localeSheet) {
//					// do stuff
//				});
//			The js extension defines a js! plugin that uses internal curl
//			functions.  The domReady extension overrides the fetchResDef
//			function and watches for requests to a module named domReady.
//			Steps:
//			v DON'T make curl functions overridable (object or eval)
//			v Finish the extend and require api functions
//			v expose some useful functions
//			- Move js! and _domReady into extensions
//			- Test
//		 */
//		var extensions, exposed;
//
//		exposed = {
//			loadScript: loadScript,
//			loadDef: fetchResDef,
//			loadPlugin: fetchPluginDef
//		};
//
//		function extend () {
//			var extension, i = 0;
//			while ((extension = arguments[i++])) {
//				extension.extend(exposed);
//			}
//		}
//
//		// get args whether in _extend(arg1, arg2) or _extend([arg1, arg2]) syntax
//		extensions = [].concat([].slice.call(arguments, 0));
//		return _curl(extensions, extend);
//	}

	// grab any global configuration info
	var userCfg = global.require || global.curl;

	// exit if it's already been defined
	if (isFunction(userCfg)) {
		return;
	}

	// store global config
	forin(userCfg, function (value, p) {
		config[p] = value;
	});

	// if we don't have a baseUrl (null, undefined, or '')
	// use the document's path as the baseUrl
	// ensure there's a trailing /
	config.baseUrl = config.baseUrl ? fixEndSlash(config.baseUrl) : '';

	// ensure all paths end in a '/'
	var paths = {};
	forin(config.paths, function (path, p) {
		paths[p] = fixEndSlash(path);
		if (p.charAt(p.length - 1) !== '/') {
			paths[p + '/'] = path;
			delete paths[p];
		}
	});
	if (!('curl/' in paths)) {
		// find path to curl
		var scripts = doc.getElementsByTagName('script'),
			i, match;
		for (i = scripts.length - 1; i >= 0 && !match ; i--) {
			match = scripts[i].src.match(findCurlRe);
		}
		paths['curl/'] = match[1] + '/';
	}
	config.paths = paths;
	config.pluginPath = fixEndSlash(config.pluginPath);

	// using bracket property notation so closure won't clobber name
	global['require'] = global['curl'] = _curl['require'] = _curl;
	global['define'] = _curl['define'] = _define;
	_curl['extend'] = _extend;

	// this is to comply with the AMD CommonJS proposal:
	_define.amd = {};

//	// Plugin to load plain old javascript.
//	// inlining the js plugin since it's much more efficient here
//	var queue = [], inFlightCount = 0;
//	_define('curl/plugin/js', {
//
//		'load': function (name, require, promise, ctx) {
//
//			var wait, prefetch, def;
//
//			wait = name.indexOf('!wait') >= 0;
//			name = wait ? name.substr(0, name.indexOf('!')) : name;
//			prefetch = 'jsPrefetch' in ctx ? ctx.jsPrefetch : true;
//			def = {
//				name: name,
//				url: require.toUrl(name),
//				ctx: ctx
//			};
//
//			function fetch (def, promise) {
//
//				loadScript(def,
//					function (el) {
//						var next;
//						inFlightCount--;
//						// if we've loaded all of the non-blocked scripts
//						if (inFlightCount == 0 && queue.length > 0) {
//							// grab next queued script
//							next = queue.shift();
//							// go get it (from cache hopefully)
//							inFlightCount++;
//							fetch.apply(null, next);
//						}
//						promise.resolve(el);
//					},
//					function (ex) {
//						inFlightCount--;
//						promise.reject(ex);
//					}
//				);
//
//			}
//
//			// if this script has to wait for another
//			if (wait && inFlightCount > 0) {
//				// push before fetch in case IE has file cached
//				queue.push([def, promise]);
//				// if we're prefetching
//				if (prefetch) {
//					// go get the file under an unknown mime type
//					var fakeDef = beget(def);
//					fakeDef.mimetype = 'text/cache';
//					loadScript(fakeDef,
//						// remove the fake script when loaded
//						function (el) { el.parentNode.removeChild(el); },
//						function () {}
//					);
//				}
//			}
//			// otherwise, just go get it
//			else {
//				inFlightCount++;
//				fetch(def, promise);
//			}
//
//		}
//
//	});

}(this, document));

// ==ClosureCompiler==
// @output_file_name curl.min.js
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==
