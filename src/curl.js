/**
 * curl (cujo resource loader)
 *
 * (c) copyright 2011, unscriptable.com
 * 
 */

// TODO: plugins
// TODO: packages
// TODO: commonjs exports and require dependencies
// TODO: debugging module that is an implicit initial dependency 

(function (global) {

/*
 * Overall operation:
 * When a dependency is encountered and it already exists, it's returned.
 * If it doesn't already exist, it is created and the dependency's script
 * is loaded. If there is a define call in the loaded script with an name,
 * it is resolved asap (i.e. as soon as the depedency's dependencies are
 * resolved). If there was a (single) define call with no name (anonymous),
 * the resource in the resNet is resolved after the script's onload fires.
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
else if (baseUrl.charAt(baseUrl.length - 1) !== '/') {
	// ensure there's a trailing /
	config.baseUrl += '/';
}

// ensure all paths end in a '/'
var paths = config.paths;
for (var p in paths) {
	if (paths[p].charAt(paths[p].length - 1) !== '/') {
		paths[p] += '/';
	}
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

function begetCfg (oldCfg, name) {
	var cfg = beget(oldCfg);
	if (name) {
		var pos = name.lastIndexOf('/');
		cfg.baseName = name.substr(0, pos + 1);
	}
	if (cfg.doc && !cfg.head) {
		cfg.head = findHead(cfg.doc);
	}
	return cfg;
}

function ResourceDef (name, cfg) {
	this.name = name;
	this.cfg = cfg;
	this._callbacks = [];
}

ResourceDef.prototype = {

	then: function then (resolved, rejected) {
		this._callbacks.push({cb: resolved, eb: rejected});
	},

	resolve: function resolve (res) {
		//console.log('DEBUG: resolve ' + this.name + ':', res);
		this.then = function then (resolved, rejected) { resolved(res); };
		var cbo;
		while (cbo = this._callbacks.pop()) {
			cbo.cb && cbo.cb(res);
		}
		this._cleanup();
	},

	reject: function reject (ex) {
		//console.log('DEBUG: reject ' + this.name + ':', ex);
		this.then = function then (resolved, rejected) { rejected(ex); };
		var cbo;
		while (cbo = this._callbacks.pop()) {
			cbo.eb && cbo.eb(ex);
		}
		this._cleanup();
	},

	_cleanup: function () {
		// ignore any further resolve or reject calls
		this.resolve = this.reject = function () {};
//		if (!this.cfg.debug) {
			// remove unnecessary properties
			delete this.cfg;
			delete this.url;
			delete this._callbacks;
//		}
	}

};

function fixPath (name, cfg) {
	var re = /[^\/]*(?:\/|$)/g,
		paths = cfg.paths,
		part = '',
		prefix = '';
	re.lastIndex = 0; // re is reused by browsers, so always reset it
	while ((part += re.exec(name)) && paths[part]) {
		prefix = part;
	}
	return cfg.baseUrl + (paths[prefix] || '') + name.substr(prefix.length);
}

function toUrl (name, cfg) {
	// TODO: packages
	return fixPath(name, cfg);
}

function nameToUrl (name, ext, cfg) {
	return toUrl(name + '.' + ext, cfg);
}

function loadScript (def, success, failure) {

	// initial script processing
	function process (ev) {
		ev = ev || global.event;
		// script processing rules learned from require.js
		var el = this; // ev.currentTarget || ev.srcElement;
		//console.log('EVENT event:' + ev.type, 'def:' + def.url, 'readyState:' + el.readyState);
		if (ev.type === 'load' || /^(complete|loaded)$/.test(el.readyState)) {
			//console.log('DEBUG: loaded', def, def.url);
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

	console.log('DEBUG: loading', def, def.url);
	// insert script
	var el = def.cfg.doc.createElement('script');
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
	def.cfg.head.appendChild(el);

}

function fixArgs (args, isDefine) {
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
	// TODO: check invalid argument combos here?
	return fixed;
}

function fetchResDef (name, cfg) {
	var def = cache[name] = new ResourceDef(name, cfg);
	// TODO: plugins
	def.url = nameToUrl(name, 'js', cfg);
	loadScript(def,
		function scriptSuccess () {
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
					getDeps(args.deps, begetCfg(cfg, def.name),
						function depsSuccess (deps) {
							def.resolve(getRes(args, deps));
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

function normalizeName (name, cfg) {
	// if name starts with . then use parent's name as a base
	return name.replace(/^\.\//, cfg.baseName);
}

function getDeps (names, cfg, success, failure) {
	// TODO: throw if multiple exports found (and requires?)
	// TODO: supply exports and require
	var deps = [],
		count = names ? names.length : 0,
		failed = false;

	if (count === 0) {
		success([]);
	}
	else {
		// obtain each dependency
		for (var i = 0; i < count && !failed; i++) (function (i) {
			var name = normalizeName(names[i], cfg),
				def = cache[name] || fetchResDef(name, cfg);
			def.then(
				function defSuccess (dep) {
					deps[i] = dep;
					if (--count == 0) {
						success(deps);
					}
				},
				function defFailure (ex) {
					failed = true;
					failure(ex);
				}
			);
		}(i));
	}
}

function getRes (def, deps) {
	// TODO: support exports
	if (def.module) {
		return def.module;
	}
	else {
		return def.func.apply(null, deps);
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
//console.log('getCurrentDef', def)
	return def;
}

global.require = function (/* various */) {

	var args = fixArgs(arguments, false);

	if (args.sync) {

		// return resource
		var def = cache[args.sync],
			res;
		if (def) {
			// this is a silly, convoluted way to get a value out of a resolved promise
			def.then(function (r) { res = r; });
		}
		if (res === undef) {
			throw new Error('Required resource (' + args.sync + ') is not already resolved.');
		}
		return res;

	}
	else {

		var cfg = begetCfg(config);

		// grab config, if specified
		if (args.cfg) {
			// local configuration
			for (var p in args.cfg) {
				cfg[p] = args.cfg[p];
			}
		}

		// resolve dependencies
		getDeps(args.deps, cfg,
			function reqResolved (deps) {
				getRes(args, deps);
			},
			function reqRejected (ex) {
				throw ex;
			}
		);

	}

};

global.define = function (/* various */) {

	var args = fixArgs(arguments, true),
		name = args.name;
//console.log('define:', args.name, args.deps, args.func, args.module);
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
			cfg = begetCfg(def.cfg, name);
		def.useNet = false;
		// resolve dependencies
		getDeps(args.deps, cfg,
			function defResolved (deps) {
				def.resolve(getRes(args, deps));
			},
			function defRejected (ex) {
				def.reject(ex);
			}
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



