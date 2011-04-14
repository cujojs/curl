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
		version = '0.4',
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
		//isDescriptorRx = /\.(js|json)$/,
		// script ready states that signify it's loaded
		readyStates = { 'loaded': 1, 'interactive': 1, 'complete': 1 },
		// reused strings
		errorSuffix = '. Syntax error or name mismatch.',
		// the defaults for a typical package descriptor
		defaultDescriptor = {
			main: 'main',
			lib: './lib'
		};

	function isType (obj, type) {
		return toString.call(obj).indexOf('[object ' + type) == 0;
	}

	function normalizePkgDescriptor (descriptor, name) {
		var folders, lib, main;

		// check for string shortcuts
		if (isType(descriptor, 'String')) {
			folders = removeEndSlash(descriptor.split('/'));
			descriptor = {
				'name': folders[folders.length - 1]
			};
		}

		// fill in defaults
		// we need to do it this way to account for google closure
		main = 'main' in descriptor ? descriptor['main'] : defaultDescriptor.main;
		lib = 'lib' in descriptor ? descriptor['lib'] : defaultDescriptor.lib;
		descriptor.name = descriptor['name'] || name;
		descriptor.main = joinPath(lib, main);
		descriptor.lib = removeEndSlash(lib);

		return descriptor;
	}

	function extractCfg (cfg) {

		baseUrl = cfg['baseUrl'] || '';

		// fix all paths
		var pStrip, cfgPaths = cfg['paths'];
		for (var p in cfgPaths) {
			pStrip = removeEndSlash(p);
			paths[pStrip] = removeEndSlash(cfgPaths[p]);
		}

		var cfgPackages = cfg['packages'];
		for (var p in cfgPackages) {
			pStrip = removeEndSlash(p);
			paths[pStrip] = normalizePkgDescriptor(cfgPackages[p], pStrip);
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
		// using bracket property notation so closure won't clobber name
		function toUrl (n) {
			return resolvePath(normalizeName(n, ctx), baseUrl).path;
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

	// TODO: add resolution chaining to see if it simplifies the rest of the code
	Promise.prototype = {

		then: function (resolved, rejected) {
			// capture calls to callbacks
			resolved && this._resolves.push(resolved);
			rejected && this._rejects.push(rejected);
			return this;
		},

		resolve: function (val) { this._complete(this._resolves, val); },

		reject: function (ex) { this._complete(this._rejects, ex); },

		_complete: function (which, arg) {
			// switch over to sync then()
			this.then = which === this._resolves ?
				function (resolve, reject) { resolve(arg); return this; } :
				function (resolve, reject) { reject(arg); return this; };
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

	function ResourceDef (name) {
		Promise.call(this);
		this.name = name;
	}

	ResourceDef.prototype = new Promise();

	function PackageDef (pkg) {
		Promise.call(this);
		this.pkg = pkg;
	}

	PackageDef.prototype = new Promise();

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
		// if we can't resolve the resource name because it's part of a
		// package for which we haven't fetched the descriptor, then
		// return a promise.
		var part = '', match = '', pathInfo;

		// pull off a folder in the name
		// does it match an entry in paths?
		//		if so, grab it as a match and repeat with another path appended
		// using part != match to detect if the regex is stuck
		while ((part += pathRe.exec(name)) && paths[part] && part != match) {
			match = part;
		}

		// literal regexes are cached globally, so always reset this
		pathRe.lastIndex = 0;

		pathInfo = paths[match] || '';

		if (pathInfo.name) {
			var libFolder = pathInfo.lib,
				// append main module if only the package name was specified
				libPath = name.substr(match.length + 1) || pathInfo.main,
				path = joinPath(libFolder, libPath);
			// prepend baseUrl if we didn't find an absolute url
			if (baseUrl && !absUrlRe.test(path)) {
				path = joinPath(baseUrl, path);
			}
			pathInfo.path = path;
		}
		else {
			var path = pathInfo;
			path += name.substr(match.length);
			// prepend baseUrl if we didn't find an absolute url
			if (baseUrl && !absUrlRe.test(path)) path = joinPath(baseUrl, path);
			pathInfo = { path: path };
		}

		return pathInfo;
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
		// TODO: just use el.async = true; since we're not reusing this for the js! plugin any more
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
		var name, deps, res, isDefFunc, len = args.length;

		function toFunc (res) {
			isDefFunc = isType(res, 'Function'); // intentional side-effect
			return isDefFunc ? res : function () { return res; };
		}

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

		// mimic RequireJS's assumption that a definition function with zero
		// dependencies is a wrapped CommonJS module
		if (!isRequire && deps && deps.length == 0 && isDefFunc) {
			deps = ['require', 'exports', 'module'];
		}

		return {
			name: name,
			deps: deps || [],
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

		if (def.main) {
			// be sure to run a package's main module before loading a module within the package
			// we do this by appending the main module as a dependency
			args.deps.push(def.main);
		}

		var childCtx = begetCtx(def.name);

		// get the dependencies and then resolve/reject
		getDeps(args.deps, childCtx,
			function (deps) {
				// remove def.main off deps
				if (def.main) {
					deps.pop();
				}
				// node.js assumes `this` === exports
				// anything returned overrides exports
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

	function fetchResDef (def, ctx) {

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

			// TODO: just use def.reject
			function (ex) {
				def.reject(ex);
			}

		);

		return def;

	}

	function normalizeName (name, ctx) {
		// if name starts with . then use parent's name as a base
		return name.replace(normalizeRe, ctx.baseName);
	}

	function resolvePluginDef (def, plugin, ctx) {
		// curl's plugins prefer to receive the back-side of a promise,
		// but to be compatible with commonjs's specification, we have to
		// piggy-back on the callback function parameter:
		var loaded = function (val) { def.resolve(val); };
		// using bracket property notation so closure won't clobber name
		loaded['resolve'] = loaded;
		loaded['reject'] = function (ex) { def.reject(ex); };
		// load the resource!
		plugin.load(def.name, ctx.require, loaded, userCfg);
	}

	function fetchDep (depName, ctx) {
		var name, delPos, prefix, resName;

		// check for plugin prefix
		delPos = depName.indexOf('!');
		if (delPos >= 0) {

			// hm, this normalizeName allows plugins to be relative to
			// the parent module. is this a feature?
			prefix = normalizeName(depName.substr(0, delPos), ctx);
			resName = depName.substr(delPos + 1);
			name = prefix + '!' + resName;

			var prev = prefix;
			// prepend plugin folder path, if it's missing and path isn't in paths
			var slashPos = prefix.indexOf('/');
			if (slashPos < 0 && prefix == prev) {
				name = joinPath(pluginPath, name);
				prefix = joinPath(pluginPath, prefix);
			}
			// null means don't append baseUrl
			var prefixInfo = resolvePath(prefix, null);

			// the spec is unclear, so we're using the full name (prefix + name) to id resources
			var def = cache[name];
			if (!def) {
				def = cache[name] = new ResourceDef(resName);
				var pluginDef = cache[prefix];
				if (!pluginDef) {
					pluginDef = cache[prefix] = new ResourceDef(prefix);
					pluginDef.url = prefixInfo.path + '.js';
					pluginDef.main = prefixInfo.main;
					fetchResDef(pluginDef, ctx)
				}
				pluginDef.then(
					function (plugin) {

						resolvePluginDef(def, plugin, ctx);
					},
					function (ex) { def.reject(ex); }
				);
			}

		}
		else {
			resName = name = normalizeName(depName, ctx);

			var def = cache[resName];
			if (!def) {
				def = cache[resName] = new ResourceDef(resName);
				// TODO: should this be using ctx.toUrl()??????
				var pathInfo = resolvePath(resName, baseUrl);
				def.url = pathInfo.path + '.js';
				def.main = pathInfo.main;
				fetchResDef(def, ctx);
			}

		}

		return def;
	}

	function getDeps (names, ctx, success, failure) {

		var deps = [],
			count = names.length,
			len = count,
			completed = false;

		// obtain each dependency
		// Note: IE may have obtained the dependencies sync (stooooopid!) thus the completed flag
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
				// hook into promise callbacks
				fetchDep(depName, ctx).then(
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
				def = cache[name] = new ResourceDef(name);
			}
			def.useNet = false;
			resolveResDef(def, args, begetCtx(name));
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
	_define['amd'] = { plugins: true };

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
