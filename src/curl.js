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

(function (global) {

/*
 * Overall operation:
 * When a dependency is encountered and it already exists, it's returned.
 * If it doesn't already exist, it is created and the dependency's script
 * is loaded. If there is a define call in the loaded script with an name,
 * it is resolved asap (i.e. as soon as the depedency's dependencies are
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
		doc: global.document,
		baseUrl: null, // auto-detect
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
	undef;

// grab any global configuration info
var userCfg = global.require || global.curl;
if (userCfg) {
	// store global config
	for (var p in userCfg) {
		config[p] = userCfg[p];
	}
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
for (var p in paths) {
	paths[p] = fixEndSlash(paths[p]);
	if (p.charAt(p.length - 1) !== '/') {
		paths[p + '/'] = paths[p];
		delete paths[p];
	}
}

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

function isObject (obj) {
	return _isType(obj, '[object Object]');
}

function findHead (doc) {
	// find and return the head element
	var el = doc.documentElement.firstChild;
	while (el && el.nodeType !== 1) el = el.nextSibling;
	return el;
}

function F () {}
function beget (ancestor) {
	F.prototype = ancestor;
	var cfg = new F();
	delete F.prototype;
	return cfg;
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

function ResourceDef (name, ctx) {
	this.name = name;
	this.ctx = ctx;
	this._resolves = [];
	this._rejects = [];
}

ResourceDef.prototype = {

	then: function then (resolved, rejected) {
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
		delete this.ctx;
		delete this.url;
	}

};


function fixEndSlash (path) {
	return path.charAt(path.length - 1) === '/' ? path : path + '/';
}

function fixPath (name, baseUrl) {
	// TODO: stop appending a '/' to all cfg.paths properties to see if it simplifies this routine
	// takes a resource name (w/o ext!) and resolves it to a url
	var re = /[^\/]*(?:\/|$)/g,
		paths = config.paths,
		part = '',
		prefix = '',
		key = fixEndSlash(name),
		path = paths[key];
	// we didn't have an exact match so find the longest match in config.paths.
	if (path === undef) {
		re.lastIndex = 0; // literal regexes are cached globally, so always reset this
		while ((part += re.exec(key)) && paths[part]) {
			prefix = part;
		}
		path = paths[prefix] || ''
	}
	// prepend baseUrl if we didn't find an absolute url
	if (!/^\/\/|^[^:]*:\/\//.test(path)) path = baseUrl + path;
	// append name 
	return path + name.substr(prefix.length);
}

function toUrl (name, ext, ctx) {
	// TODO: packages
	return fixPath(name, ctx.baseUrl) + (ext ? '.' + ext : '');
}

function loadScript (def, success, failure) {

	// initial script processing
	function process (ev) {
		ev = ev || global.event;
		// script processing rules learned from RequireJS
		var el = this; // ev.currentTarget || ev.srcElement;
		if (ev.type === 'load' || /^(complete|loaded)$/.test(el.readyState)) {
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
	var el = def.ctx.doc.createElement('script');
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
	def.ctx.head.appendChild(el);

}

function fixArgs (args) {
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
	var len = args.length;
	if (len === 3) {
		return { name: args[0], deps: args[1], res: toFunc(args[2]) };
	}
	else if (len == 2 && isString(args[0])) {
		return { name: args[0], res: toFunc(args[1]) };
	}
	else if (len == 2) {
		return { deps: args[0], res: toFunc(args[1]) };
	}
	else if (isString(args[0])) {
		return { deps: args[0] };
	}
	else {
		return { res: toFunc(args[0]) };
	}

/*
	var len = args.length,
		fixed = {},
		pos = 0;
	if (len === 1) {
		fixed[isDefine ? (isFunction(args[0]) ? 'func' : 'module') : 'sync'] = args[0];
	}
	else {
		if (!isDefine && isObject(args[pos])) {
			fixed.cfg = args[pos++];
		}
		if (isString(args[pos])) {
			fixed.name = args[pos++];
		}
		if (isArray(args[pos])) {
			fixed.deps = args[pos++];
		}
		if (isFunction(args[pos])) {
			fixed.func = args[pos++];
		}
		if (pos < len) {
			fixed.module = args[pos++];
		}
	}
	return fixed;
*/
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
					def.reject(new Error('define() not found in ' + def.url + '. Possible syntax error or name mismatch.'));
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

	// the spec is unclear, but we're using the full name (prefix + name) to id resources
	var def = cache[fullName] = new ResourceDef(name, ctx);

	// curl's plugins prefer to receive the back-side of a promise,
	// but to be compatible with commonjs's specification, we have to
	// piggy-back on the its callback function parameter:
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
			for (var prop in source) {
				if (!(prop in op) && (!(prop in target) || force)) {
					target[prop] = source[prop];
				}
			}
		};

		// ouch! RequireJS's i18n plugin (0.22) uses the global require, not the one passed in
		if (prefix.indexOf('i18n') >= 0) global.require.mixin = r.mixin;

		// load the resource!
		plugin.load(name, r, loaded, ctx);

	});

	return def;

}

function normalizeName (name, ctx) {
	// if name starts with . then use parent's name as a base
	return name.replace(/^\.\//, ctx.baseName);
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
			throw new Error('CommonJS exports parameter not supported, yet.');
		}
		else if (dep === 'module') {
			throw new Error('CommonJS module parameter not supported, yet.');
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

function require (deps, callback, ctx) {

	// sync require
	// TODO: move this to a CommonJS extensions
	if (isString(deps)) {
		// return resource
		var def = normalizeName(cache[deps], ctx),
			res;
		if (def) {
			// this is a silly, convoluted way to get a value out of a resolved promise
			def.then(function (r) { res = r; });
		}
		if (res === undef) {
			throw new Error('Required resource (' + deps + ') is not already resolved.');
		}
		return res;
	}

	// resolve dependencies
	getDeps(deps, ctx,
		function reqResolved (deps) { callback.apply(null, deps); },
		function reqRejected (ex) { throw ex; }
	);

}

global.require = function globalRequire (/* various */) {

	var len = arguments.length,
		args;

	if (len === 3) {
		// local configuration
		for (var p in arguments[0]) {
			config[p] = arguments[0][p];
		}
	}

	var ctx = begetCtx({ doc: config.doc, baseUrl: config.baseUrl, require: require }, '');
	// extract config, if it's there
	args = fixArgs(len === 3 ? Array.prototype.slice.call(arguments, 1) : arguments);

	ctx.require(args.deps, args.res, ctx);

};

global.define = function define (/* various */) {

	var args = fixArgs(arguments, true),
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

};

var curl = global.define.curl = global.require.curl = {
	version: '0.1'
};
// this is to comply with the AMD CommonJS proposal:
global.define.amd = { curl: curl };

}(window));




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



