/**
 * curl (cujo resource loader)
 *
 * (c) copyright 2011, unscriptable.com
 * 
 */

// TODO: code documentation!!!
// TODO: packages
// TODO: commonjs exports and module dependencies
// TODO: finish debug plugin

var curl, require, define;
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
		// current definition about to be loaded (this helps catch when
		// IE loads a script sync from cache)
		activeName,
		// this is the list of scripts that IE is loading. one of these will
		// be the "interactive" script. too bad IE doesn't send a readystatechange
		// event to tell us exactly which one.
		activeScripts = {},
		// this is always handy :)
		op = Object.prototype,
		// and this
		undef,
		aslice = [].slice;

	function forin (obj, lambda) {
		for (var p in obj) {
			if (!(p in op)) {
				lambda(obj[p], p, obj);
			}
		}
	}

	// grab any global configuration info
	var userCfg = global.require || global.curl;
	if (userCfg) {
		// store global config
		forin(userCfg, function (value, p) {
			config[p] = value;
		});
	}

	// TODO: path and baseUrl fixing should happen any time these are specified (e.g. in begetCfg)
	var baseUrl = config.baseUrl;
	if (!baseUrl) {
		// if we don't have a baseUrl (null, undefined, or '')
		// use the document's path as the baseUrl
		config.baseUrl = '';
	//	var url = config.doc.location.href;
	//	config.baseUrl = url.substr(0, url.lastIndexOf('/') + 1);
	}
	else {
		// ensure there's a trailing /
		config.baseUrl = fixEndSlash(baseUrl);
	}

	// ensure all paths end in a '/'
	var paths = config.paths;
	forin(paths, function (path, p) {
		paths[p] = fixEndSlash(path);
		if (p.charAt(p.length - 1) !== '/') {
			paths[p + '/'] = path;
			delete paths[p];
		}
	});
	config.pluginPath = fixEndSlash(config.pluginPath);

	function _isType (obj, type) {
		return op.toString.call(obj) === type;
	}
	function isFunction (obj) {
		return _isType(obj, '[object Function]')
	}

	function isString (obj) {
		return _isType(obj, '[object String]');
	}

	function isArray (obj) {
		return _isType(obj, '[object Array]');
	}

	//function isOpera (obj) {
	//	return _isType(obj, '[object Opera]');
	//}

	function findHead (doc) {
		// find and return the head element
		var el = doc.documentElement.firstChild;
		while (el && el.nodeType !== 1) el = el.nextSibling;
		return el;
	}

	function F () {}
	function beget (ancestor) {
		F.prototype = ancestor;
		var o = new F();
		delete F.prototype;
		return o;
	}

	function begetCtx (oldCtx, name) {
		var ctx = beget(oldCtx);
		if (name) {
			var pos = name.lastIndexOf('/');
			ctx.baseName = name.substr(0, pos + 1);
		}
		ctx.require = function (deps, callback) {
			return require(deps, callback, ctx);
		};
		ctx.require.toUrl = function (name) {
			return fixPath(normalizeName(name, ctx), ctx.baseUrl);
		};
		if (ctx.doc && !ctx.head) {
			ctx.head = findHead(ctx.doc);
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
			while (cb = which[i++]) { cb(arg); }
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

	var pathRe = /[^\/]*(?:\/|$)/g,
		baseUrlRe = /^\/\/|^[^:]*:\/\//;
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
		// TODO: packages
		return fixPath(name, ctx.baseUrl) + (ext ? '.' + ext : '');
	}

	var loadedRe = /^complete$|^interactive$|^loaded$/;
	function loadScript (def, success, failure) {

		// initial script processing
		function process (ev) {
			ev = ev || global.event;
			// script processing rules learned from RequireJS
			var el = this; // ev.currentTarget || ev.srcElement;
			if (ev.type === 'load' || loadedRe.test(el.readyState)) {
				delete activeScripts[def.name];
				// release event listeners
				el.onload = el.onreadystatechange = el.onerror = null;
				success();
			}
		}

		function fail (e) {
			// some browsers send an event, others send a string
			var msg = e.type || e;
			failure(new Error('Script not loaded: ' + def.url + ' (browser says: ' + msg + ')'));
		}

		// insert script
		var el = def.ctx.doc.createElement('script'),
			head  = def.ctx.head;
		// detect when it's done loading
		// using dom0 event handlers instead of wordy w3c/ms
		el.onload = el.onreadystatechange = process;
		el.onerror = fail;
		el.type = 'text/javascript';
		el.charset = 'utf-8';
		el.async = true; // for Firefox
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
			function scriptSuccess () {

				// these are no longer needed
				delete def.doc;
				delete def.head;

				var args = argsNet;
				argsNet = undef; // reset it before we get deps

				// if our resource was not explicitly defined with a name (anonymous)
				// Note: if it did have a name, it will be resolved in the define()
				if (def.useNet !== false) {
					if (!args) {
						// uh oh, nothing was added to the resource net
						def.reject(new Error('define() not found: ' + def.url + '. Syntax error or name mismatch.'));
					}
					else if (args.ex) {
						// the resNet resource was already rejected, but it didn't know
						// its name, so reject this def with better information
						def.reject(new Error(args.ex.replace('${url}', def.url)));
					}
					else {
						// resolve dependencies and execute definition function here
						// because we couldn't get the cfg in the anonymous define()
						getDeps(args.deps, begetCtx(ctx, def.name),
							function depsSuccess (deps) {
								def.resolve(args.res.apply(null, deps));
							},
							function depsFailure (ex) {
								def.reject(ex);
							}
						);
					}
				}

			},

			function scriptFailure (ex) {
				delete def.doc;
				delete def.head;
				def.reject(ex);
			}

		);

		return def;

	}

	function fetchPluginDef (fullName, prefix, name, ctx) {

		// prepend plugin folder path, if it's missing
		var slashPos = fullName.indexOf('/');
		if (slashPos < 0 || slashPos > fullName.indexOf('!')) {
			fullName = config.pluginPath + fullName;
			prefix = config.pluginPath + prefix;
		}
		// the spec is unclear, but we're using the full name (prefix + name) to id resources
		var def = cache[fullName] = new ResourceDef(name, ctx);

		// curl's plugins prefer to receive the back-side of a promise,
		// but to be compatible with commonjs's specification, we have to
		// piggy-back on the callback function parameter:
		var loaded = function (res) { def.resolve(res) };
		loaded.resolve = loaded;
		loaded.reject = function (ex) { def.reject(ex); };

		// go get plugin
		ctx.require([prefix], function (plugin) {

			// create a custom require for RequireJS 0.22 compatibility
			var r = function () { return ctx.require.apply(null, arguments); };
			r.toUrl = function (name) {
				return fixPath(normalizeName(name, ctx), ctx.baseUrl);
			};
			r.nameToUrl = function (name, ext) {
				return toUrl(name, ext.substr(1), ctx);
			};
			r.mixin = function (target, source, force) {
				forin(source, function (value, prop) {
					if ((!(prop in target) || force)) {
						target[prop] = source[prop];
					}
				});
			};

			// ouch! RequireJS's i18n plugin (0.22) uses the global require, not the one passed in
			// TODO: remove. looks like it's fixed in 0.23
			//if (prefix.indexOf('i18n') >= 0) global.require.mixin = r.mixin;

			// load the resource!
			plugin.load(name, r, loaded, ctx);

		});

		return def;

	}

	var normalizeRe = /^\.\//;
	function normalizeName (name, ctx) {
		// if name starts with . then use parent's name as a base
		return name.replace(normalizeRe, ctx.baseName);
	}

	function getDeps (names, ctx, success, failure) {
		// TODO: throw if multiple exports found (and requires?)
		// TODO: supply exports and module

		var deps = [],
			count = names ? names.length : 0,
			len = count,
			completed = false;

		// obtain each dependency
		for (var i = 0; i < len && !completed; i++) (function (i) {
			var dep = names[i];
			if (dep === 'require') {
				deps[i] = ctx.require;
				count--;
			}
			else if (dep === 'exports') {
				throw new Error('exports parameter not supported.');
			}
			else if (dep === 'module') {
				throw new Error('module parameter not supported.');
			}
			else {
				var name, parts, prefix, resName;
				// check for plugin prefix
				if ((parts = dep.split('!')).length > 1) {
					prefix = normalizeName(parts[0], ctx);
					resName = parts[1]; // ignore any suffixes
					name = prefix + '!' + resName;
				}
				else {
					resName = name = normalizeName(names[i], ctx);
				}
				// get resource definition
				var def = cache[name] || (prefix ? fetchPluginDef(name, prefix, resName, ctx) : fetchResDef(resName, ctx));
				// hook into promise callbacks
				def.then(
					function defSuccess (dep) {
						deps[i] = dep;
						if (--count == 0) {
							completed = true;
							success(deps);
						}
					},
					function defFailure (ex) {
						completed = true;
						failure(ex);
					}
				);
			}
		}(i));

		// were there none to fetch and did we not already complete the promise?
		if (count === 0 && !completed) {
			success([]);
		}

	}

	function getCurrentDefName () {
		var def = activeName || null;
		if (!def) {
			for (var d in activeScripts) {
				if (activeScripts[d].readyState === 'interactive') {
					def = d;
					break;
				}
			}
		}
		return def;
	}

	// this is only domReady. it doesn't wait for dependencies
	function domReady (callback) {
		// adds a callback to be executed when the dom is ready

		var cbs = [];

		function loaded () {
			var cb;
			while (cb = cbs.pop()) cb();
			domReady = function (cb) { cb(); };
		}
		function w3cLoaded () {
			global.removeEventListener('DOMContentLoaded', w3cLoaded, false);
			global.removeEventListener('load', w3cLoaded, false);
			loaded();
		}

		if (global.addEventListener) {
			// one of these will work
			global.addEventListener('DOMContentLoaded', w3cLoaded, false);
			global.addEventListener('load', w3cLoaded, false);
		}
		else {
			global.attachEvent('onload', function ieLoaded () {
				global.detachEvent('onload', ieLoaded);
				loaded();
			});
		}

		(domReady = function (cb) { cbs.push(cb); })(callback);

	}

	function require (deps, callback, ctx) {
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
			function reqResolved (deps) {
				// Note: deps are passed to a promise as an array, not as individual arguments
				callback.resolve ? callback.resolve(deps) : callback.apply(null, deps);
			},
			function reqRejected (ex) {
				if (callback.reject) callback.reject(ex);
				else throw ex;
			}
		);

	}

	function curl (/* various */) {

		var len = arguments.length,
			args;

		if (len === 3) {
			// local configuration
			forin(arguments[0], function (value, p) {
				config[p] = value;
			});
		}

		var ctx = begetCtx({ doc: config.doc, baseUrl: config.baseUrl, require: require }, '');
		// extract config, if it's there
		args = fixArgs(len === 3 ? aslice.call(arguments, 1) : arguments, true);

		// check if we should return a promise
		// TODO: move commonjs behavior out to an extension (if !isString(args.deps) require() returns a resource)
		if (!isString(args.deps)) {
			var callback = args.res,
				promise = args.res = new Promise(),
				api = {};
			// return the dependencies as arguments, not an array
			api.then = function (resolved, rejected) {
				promise.then(
					function (deps) { resolved.apply(null, deps) },
					function (ex) { rejected(beget(ex)); }
				);
				return api;
			};
			// ready will call the callback when both the document and the dependencies are ready
			api.ready = function (cb) {
				promise.then(function () { domReady(cb) });
				return api;
			};
			if (callback) api.then(callback);
		}

		var result = ctx.require(args.deps, args.res, ctx);
		return api || result;

	}

	function define (/* various */) {

		var args = fixArgs(arguments, false),
			name = args.name;

		if (name == null) {
			if (argsNet !== undef) {
				argsNet = {ex: 'Multiple anonymous defines found in ${url}.'};
			}
			else if (!(name = getCurrentDefName())) {
				// anonymous define(), defer processing until after script loads
				argsNet = args;
			}
		}
		if (name != null) {
			// named define()
			var def = cache[name],
				ctx = begetCtx(def.ctx, name);
			def.useNet = false;
			// resolve dependencies
			getDeps(args.deps, ctx,
				function defResolved (deps) { def.resolve(args.res.apply(null, deps)); },
				function defRejected (ex) { def.reject(ex); }
			);
		}

	}

	global.require = global.curl = curl;
	global.define = curl.define = define;
	curl.domReady = domReady;

	// this is to comply with the AMD CommonJS proposal:
	define.amd = {};

}(this, document));




//
//function findScript (doc, rxOrName) {
//	var scripts = doc.getElementsByTagName('script'),
//		rx = typeof rxOrName === 'string' ? new RegExp(rxOrName + '$') : rxOrName,
//		i = scripts.length, me;
//	while ((me = scripts[--i]) && !rx.test(me.src)) {}
//	return me;
//}
//
///* initialization */
//


//cjsProto.createDepList = function (ids) {
//	// this should be called on resources that are already known to be loaded
//	var deps = [],
//		i = 0,
//		id, r;
//	while ((id = ids[i++])) {
//		if (id === 'require') {
//			// supply a scoped require function, if requested
//			var self = this;
//			r = beget(global.require);
//			r.toUrl = function (relUrl) { return self.toUrl(relUrl); };
//		}
//		else if (id === ' exports') {
//			// supply a new exports object, if requested
//			if (deps.exports) throw new Error('"exports" may only be specified once. ' + id);
//			deps.push(deps.exports = {});
//		}
//		else {
//			r = resources[id].r;
//		}
//		deps.push(r);
//	}
//	return deps;
//};
//

//cjsProto.evalResource = function (deps, resource) {
//	var res = resource;
//	if (isFunction(res)) {
//		var params = this.createDepList(deps);
//		res = res.apply(null, params);
//		// pull out and return the exports, if using that variant of AMD
//		if (params.exports) {
//			res = params.exports;
//		}
//	}
//	return res;
//};
//



