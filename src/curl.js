/*
 * curl (cujo resource loader)
 *
 * (c) copyright 2011, unscriptable.com
 * 
 */

// TODO: support define(obj);
// TODO: plugins
// TODO: finish paths and toUrl
// TODO: debugging info / error handling

(function (global) {

/*
 * Overall operation:
 * When a dependency is encountered and it already exists, it's returned.
 * If it doesn't already exist, it is created and the dependency's script
 * is loaded. If there is a define call in the loaded script with an id,
 * it is resolved asap (i.e. as soon as the depedency's dependencies are
 * resolved). If there was a (single) define call with no id (anonymous),
 * the resource in the resNet is resolved after the script's onload fires.
 */


var
	// local cache of resource definitions (lightweight promises)
	cache = {},
	// default configuration
	config = {
		doc: global.document,
		baseUrl: null, // auto-detect
		paths: {},
		debug: false // TODO: do more with this
	},
	// net to catch anonymous define calls' arguments
	argsNet,
	// this is always handy :)
	op = Object.prototype,
	// and this
	undef;

// grab any global configuration info
if (global.require) {
	// store global config
	for (var p in global.require) {
		config[p] = global.require[p];
	}
}

// if we don't have a baseUrl (null, undefined, or '')
if (!config.baseUrl) {
	// use the document's path as the baseUrl
	var url = config.doc.location.href;
	config.baseUrl = url.substr(0, url.lastIndexOf('/') + 1);
}

function isFunction (obj) {
	return typeof obj === 'function';
}

function isArray (obj) {
	return op.toString.call(obj) === '[object Array]';
}

function findHead (doc) {
	// find and return the head element
	var el = doc.firstChild;
	while (el && el.nodeType !== 1) el = el.nextSibling;
	return el;
}

function F () {}
function begetCfg (ancestor, overrides) {
	F.prototype = ancestor;
	var cfg = new F();
	delete F.prototype;
	for (var p in overrides) {
		cfg[p] = overrides[p];
	}
	if (cfg.doc && !cfg.head) {
		cfg.head = findHead(cfg.doc);
	}
	return cfg;
}

function ResourceDef (name, cfg) {
	// TODO: replace the resStates concept with something simpler/smaller
	this.name = name;
	this.cfg = cfg;
	this._callbacks = [];
}

ResourceDef.prototype = {

	then: function then (resolved, rejected) {
		this._callbacks.push({cb: resolved, eb: rejected});
	},

	resolve: function resolve (res) {
		this.then = function then (resolved, rejected) { resolved(res); };
		var cbo;
		while (cbo = this._callbacks.pop()) {
			cbo.cb && cbo.cb(res);
		}
		this._cleanup();
	},

	reject: function reject (ex) {
		this.then = function then (resolved, rejected) { rejected(ex); };
		var cbo;
		while (cbo = this._callbacks.pop()) {
			cbo.eb && cbo.eb(ex);
		}
		this._cleanup();
	},

	_cleanup: function () {
		if (!this.cfg.debug) {
			// remove unnecessary properties
			delete this.cfg;
			delete this.url;
			delete this._callbacks;
		}
	}

};

function loadScript (def, success, failure) {
	// initial script processing
	function process (ev) {
		// script processing rules learned from require.js
		var el = ev.currentTarget || ev.srcElement;
		if (ev.type === 'load' || /^(complete|loaded)$/.test(el.readyState)) {
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
	var el = def.cfg.doc.createElement('script');
	// detect when it's done loading
	// using dom0 event handlers instead of wordy w3c/ms
	el.onload = el.onreadystatechange = process;
	el.onerror = fail;
	el.type = 'text/javascript';
	el.charset = 'utf-8';
	el.async = true; // for Firefox
	el.src = def.url;
	def.cfg.head.appendChild(el);
}

function fixArgs (args) {
	// resolve args
	var a0 = args[0], a1 = args[1], a2 = args[2];
	var fixed = {id: a0, deps: a1, f: a2};
	if (isFunction(a0)) {
		fixed.df = a0;
		fixed.deps = [];
		fixed.id = null;
	}
	else if (isFunction(a1)) {
		fixed.df = a1;
		if (isArray(a0)) {
			fixed.deps = a0;
			fixed.id = null;
		}
		else {
			fixed.deps = [];
		}
	}
	return fixed;
}

function fetchResDef (name, cfg) {
//	cfg = begetCfg(cfg, {}); // TODO
	var def = cache[name] = new ResourceDef(name, cfg);
	// TODO: normalize url
	def.url = name;
	loadScript(def,
		function scriptSuccess () {
			delete def.doc;
			delete def.head;
			if (def.anon !== false) {
				// our resource was not explicitly defined with a name (anonymous)
				// Note: if it did have a name, it will be resolved in the define()
				var args = argsNet;
				argsNet = void 0; // reset it before we get deps
				if (!args) {
					// uh oh, nothing was added to the resource net
					def.reject(new Error('define() not found in ' + url));
				}
				else if (args.ex) {
					// the resNet resource was already rejected, but it didn't know
					// its name, so reject this def with better information
					def.reject(new Error(args.ex.replace('${url}', url)));
				}
				else {
					// resolve dependencies and execute definition function here
					// because we couldn't get the cfg in the anonymous define()
					getDeps(args.deps, cfg,
						function depsSuccess (deps) {
							def.resolve(args.df.apply(null, deps));
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
	// TODO: if name starts with . then use parent's name as a base
	return name;
}

function getDeps (names, cfg, success, failure) {
	// TODO: throw if multiple exports found (and requires?)
	// TODO: supply exports and require
	var deps = [],
		count = names.length,
		failed = false;

	if (count === 0) {
		success([]);
	}
	else {
		// obtain each dependency
		for (var i = 0; i < count && !failed; i++) (function (i) {
			// TODO: normalize name (./ or ../)
			var def = cache[names[i]] || fetchResDef(names[i], cfg);
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

function getRes (df, deps) {
	// TODO: support exports
	if (isFunction(df)) {
		return df.apply(deps);
	}
	else {
		return df;
	}
}

global.require = function (/* various */) {

	if (arguments.length === 1) {

		// return resource
		var name = arguments[0],
			def = cache[name],
			res;
		if (def) {
			// this is a silly, convoluted way to get a value out of a resolved promise
			def.then(function (r) { res = r; });
		}
		if (res === undef) {
			throw new Error('Required resource (' + name + ') is not already resolved.');
		}
		return res;

	}
	else {

		var args = fixArgs(arguments),
			cfg = config;

		// grab config, if specified (i.e. args.id is actually a config object)
		if (!isArray(args.id)) {
			// local configuration
			cfg = begetCfg(cfg, args.id);
		}

		// resolve dependencies
		getDeps(args.deps, cfg,
			function reqResolved (deps) {
				getRes(args.df, deps);
			},
			function reqRejected (ex) {
				// TODO: abort everything
				throw ex;
			}
		);

	}

};

global.define = function (/* various */) {

	var args = fixArgs(arguments);

	if (args.id == null) {
		if (argsNet !== undef) {
			argsNet = {ex: 'Multiple anonymous defines found in ${url}.'};
		}
		else {
			// anonymous define(), defer processing until after script loads
			argsNet = args;
		}
	}
	else {
		// named define()
		var def = cache[args.id];
		def.anon = false;
		var cfg = def.cfg;
		// resolve dependencies
		getDeps(args.deps, cfg,
			function defResolved (deps) {
				def.resolve(getRes(args.df, deps));
			},
			function defRejected (ex) {
				def.reject(ex);
			}
		);
	}

};

// this is to comply with the AMD CommonJS proposal:
global.define.amd = {};

}(window));
















//function forIn (obj, lambda) {
//	if (obj) {
//		for (var p in obj) {
//			if (!(p in op)) {
//				lambda(obj[p], p, obj);
//			}
//		}
//	}
//}
//
//// crockford-style object inheritance
//function F () {}
//function beget (obj) {
//	F.prototype = obj;
//	var child = new F();
//	delete F.prototype;
//	return child;
//}
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


//function hasProtocol (url) {
//	return /:\/\//.test(url);
//}

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



