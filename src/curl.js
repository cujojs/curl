/**
 * curl (cujo resource loader)
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licnsed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

(function (global, doc, userCfg) {

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
		version = '0.3.3',
		head = doc['head'] || doc.getElementsByTagName('head')[0],
		// configuration information
		baseUrl,
		pluginPath,
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
		pathRe = /(?:\/|^)[^\/$]*/g, // /(?:\/|^).*(?:\/|$)/g,
		absUrlRe = /^\/|^[^:]*:\/\//,
		normalizeRe = /^\.\//,
		findCurlRe = /(.*\/curl)\.js$/,
		readyStates = { 'loaded': 1, 'interactive': 1, 'complete': 1 },
		// reused strings
		errorSuffix = '. Syntax error or name mismatch.' ;

	function isType (obj, type) {
		return toString.call(obj).indexOf('[object ' + type) == 0;
	}

	function extractCfg (cfg) {

		baseUrl = cfg['baseUrl'] || '';

		// fix all paths
		var cfgPaths = cfg['paths'];
		for (var p in cfgPaths) {
			paths[p] = removeEndSlash(cfgPaths[p]);
			if (p.charAt(p.length - 1) == '/') {
				paths[removeEndSlash(p)] = paths[p];
				delete paths[p];
			}
		}

		if (!('curl' in paths)) {
			// find path to curl. search backwards since we're likely the most recent
			var scripts, match;
			scripts = doc.getElementsByTagName('script');
			for (var i = scripts.length - 1; i >= 0 && !match ; i--) {
				match = scripts[i].src.match(findCurlRe);
			}
			paths['curl'] = match[1];
		}

		pluginPath = cfg['pluginPath'] || joinPath(paths['curl'], 'plugin');

	}

	function begetCtx (name) {
		var ctx = {};
		ctx.baseName = name.substr(0, name.lastIndexOf('/') + 1);
		// CommonJS Modules 1.1.1 compliance
		ctx.require = function (deps, callback) {
			return _require(deps, callback, ctx);
		};
		// using bracket property notation to closure won't clobber name
		function toUrl (n) {
			return resolvePath(normalizeName(n, ctx), baseUrl);
		}
		ctx.require['toUrl'] = toUrl;
		ctx.exports = {};
		ctx.module = {
			'id': normalizeName(name, ctx),
			'uri': toUrl(name)
		};
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

	function endsWithSlash (str) {
		return str.charAt(str.length - 1) == '/';
	}

	function joinPath (path, file) {
		return (!path || endsWithSlash(path) ? path : path + '/') + file;
	}

	function removeEndSlash (path) {
		return endsWithSlash(path) ? path.substr(0, path.length - 1) : path;
	}

	function resolvePath (name, baseUrl) {
		// takes a resource name (w/o ext!) and resolves it to a url
		var part = '',
			prefix = '',
			path = paths[name];
		pathRe.lastIndex = 0; // literal regexes are cached globally, so always reset this
		// pull off a folder in the path
		// does it match an entry in paths?
		//		if so, grab it as a prefix and go back
		// using part != prefix to detect if the regex is stuck
		while ((part += pathRe.exec(name)) && paths[part] && part != prefix) {
			prefix = part;
		}
		path = (paths[prefix] || '') + name.substr(prefix.length);
		// prepend baseUrl if we didn't find an absolute url
		if (!absUrlRe.test(path)) path = joinPath(baseUrl, path);
		// append name
		return path;
	}

	function loadScript (def, success, failure) {
		// script processing rules learned from RequireJS

		// insert script
		var el = doc.createElement('script');

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
		el.type = 'text/javascript';
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
		function toFunc (res) {
			return isType(res, 'Function') ? res : function () { return res; };
		}
		var name, deps, res, len = args.length;
		if (len === 3) {
			name = args[0];
			deps = args[1];
			res = toFunc(args[2]);
		}
		else if (len == 2) {
			if (isType(args[0], 'String')) {
				name = args[0];
			}
			else {
				deps = args[0];
			}
			res = toFunc(args[1]);
		}
		else /*if (len == 1)*/ {
			// TODO: document this: if a require(array) is encountered , it assumes the array is a list of dependencies so that we can return a promise, define(array) assumes the array is the resource
			if (isType(args[0], 'String') || (isType(args[0], 'Array') && isRequire)) {
				deps = args[0];
			}
			else {
				res = toFunc(args[0]);
			}
		}
		return {
			name: name,
			deps: deps,
			res: res
		};
	}

	function resolveResDef (def, args, ctx) {

		function success (res) {
			def.resolve(res);
		}

		function failure (ex) {
			def.reject(ex);
		}

		// get the dependencies and then resolve/reject
		// even if there are no dependencies, we're still taking
		// this path to simplify the code
		var childCtx = begetCtx(def.name);
		getDeps(args.deps, childCtx,
			function (deps) {
				// CommonJS Modules 1.1 says `this` === exports
				// anything returned overrides exports?
				var res = args.res.apply(childCtx.exports, deps) || childCtx.exports;
				if (res && isType(res['then'], 'Function')) {
					// oooooh lookee! we got a promise!
					// chain it
					res['then'](success, failure);
				}
				else {
					success(res);
				}
			},
			failure
		);

	}

	function fetchResDef (name, ctx) {

		var def = cache[name] = new ResourceDef(name, ctx);
		// TODO: should this be using ctx.toUrl()??????
		def.url = resolvePath(name, baseUrl) + '.js';

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
						// its name, so reject this def now with better information
						def.reject(new Error(args.ex.replace('${url}', def.url)));
					}
					else {
						resolveResDef(def, args, ctx);
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

		// prepend plugin folder path, if it's missing and path isn't in paths
		var prev = prefix;
		prefix = resolvePath(prefix, '');
		var slashPos = prefix.indexOf('/');
		if (slashPos < 0 && prefix == prev) {
			fullName = joinPath(pluginPath, fullName);
			prefix = joinPath(pluginPath, prefix);
		}
		// the spec is unclear, but we're using the full name (prefix + name) to id resources
		var def = cache[fullName] = new ResourceDef(name, ctx);

		// curl's plugins prefer to receive the back-side of a promise,
		// but to be compatible with commonjs's specification, we have to
		// piggy-back on the callback function parameter:
		var loaded = function (res) { def.resolve(res); };
		// using bracket property notation so closure won't clobber name
		loaded['resolve'] = loaded;
		loaded['reject'] = function (ex) { def.reject(ex); };
		loaded['then'] = function (resolved, rejected) { def.then(resolved, rejected); };

		// go get plugin
		ctx.require([prefix], function (plugin) {
			// load the resource!
			plugin.load(name, begetCtx(name).require, loaded, userCfg);

		});

		return def;

	}

	function normalizeName (name, ctx) {
		// if name starts with . then use parent's name as a base
		return name.replace(normalizeRe, ctx.baseName);
	}

	function getDeps (names, ctx, success, failure) {

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
			else if (depName == 'exports') {
				deps[index] = ctx.exports;
				count--;
			}
			else if (depName == 'module') {
				deps[index] = ctx.module;
				count--;
			}
			else {
				var name, /*parts, */delPos, prefix, suffixes, resName;
				// check for plugin prefix
				delPos = depName.indexOf('!');
				//if (parts.length > 1) {
				if (delPos >= 0) {
					// hm, this normalizeName allows plugins to be relative to
					// the parent module. is this a feature?
					prefix = normalizeName(depName.substr(0, delPos), ctx);
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
		if (count == 0 && !completed) {
			success(deps);
		}

	}

	function getCurrentDefName () {
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

	function _require (deps, callback, ctx) {
		// Note: callback could be a promise

		// sync require
		// TODO: move this to a CommonJS extension
		if (isType(deps, 'String')) {
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

		// extract config, if it's specified
		if (len === 3) {
			extractCfg(arguments[0]);
		}

		var ctx = begetCtx('');
		args = fixArgs(len === 3 ? aslice.call(arguments, 1) : arguments, true);

		// check if we should return a promise
		if (!isType(args.deps, 'String')) {
			var callback = args.res,
				promise = args.res = new Promise(),
				api = {};
			// return the dependencies as arguments, not an array
			// using bracket property notation so closure won't clobber name
			api['then'] = function (resolved, rejected) {
				promise.then(
					function (deps) { if (resolved) resolved.apply(null, deps); },
					function (ex) { if (rejected) rejected(ex); else throw ex; }
				);
				return api;
			};
			// promise chaining
			api['next'] = function (deps, cb) {
				var origPromise = promise;
				promise = new Promise();
				origPromise.then(
					// get dependencies and then resolve the previous promise
					function () { ctx.require(deps, promise, ctx); }
				);
				// execute this callback after dependencies
				if (cb) {
					promise.then(cb);
				}
				return api;
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
				def = cache[name] = new ResourceDef(name, begetCtx(name));
			}
			def.useNet = false;
			resolveResDef(def, args, def.ctx);
		}

	}

	/***** grab any global configuration info *****/

	// if userCfg is a function, assume require() exists already
	// go into "conflict mode"
	var conflict = isType(userCfg, 'Function');
	if (!conflict) {
		extractCfg(userCfg);
	}

	/***** define public API *****/

	// allow curl / require to be renamed
	if (userCfg['apiName']) {
		global[userCfg['apiName']] = _curl;
	}
	else {
		global['require'] = global['curl'] = _curl;
	}

	// using bracket property notation so closure won't clobber name
	_curl['require'] = _curl;
	global['define'] = _curl['define'] = _define;
	_curl['version'] = version;

	// this is to comply with the AMD CommonJS proposal:
	_define['amd'] = {};

}(
	this,
	document,
	// grab configuration
	this['curl'] || this['require'] || {}
));

// ==ClosureCompiler==
// @output_file_name curl.js
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==
