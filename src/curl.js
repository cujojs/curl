/*
 * curl (cujo resource loader)
 *
 * (c) copyright 2011, unscriptable.com
 * 
 */

// TODO: plugins
// TODO: finish paths and toUrl
// TODO: debugging info / error handling
// TODO: get resource sync if it's not already loaded (configurable)

(function (global) {

/* local vars */

var resources = {},
	rootId = 0,
	config = {
		doc: global.document,
		finderRx: /curl\.js$/,
		waitSeconds: 7,
		baseUrl: null, // auto-detect
		paths: {}
	},
	op = Object.prototype,
	// net to catch anonymous define calls
	// TODO: does this really need to be "global"?
	defNet;

/* some utility functions */

function isArray (obj) {
	return op.toString.call(obj) === '[object Array]';
}

function isFunction (obj) {
	return typeof obj === 'function';
}

function forIn (obj, lambda) {
	if (obj) {
		for (var p in obj) {
			if (!(p in op)) {
				lambda(obj[p], p, obj);
			}
		}
	}
}

// crockford-style object inheritance
function F () {}
function beget (obj) {
	F.prototype = obj;
	var child = new F();
	delete F.prototype;
	return child;
}

// cancellable timeout, returns the canceller function
function timeout (ms, cb) {
	var h = setTimeout(cb, ms);
	return function () { clearTimeout(h); };
}

function findScript (doc, rxOrName) {
	var scripts = doc.getElementsByTagName('script'),
		rx = typeof rxOrName === 'string' ? new RegExp(rxOrName + '$') : rxOrName,
		i = scripts.length, me;
	while ((me = scripts[--i]) && !rx.test(me.src)) {}
	return me;
}

/* initialization */

if (global.require) {
	// store global config
	forIn(global.require, function (val, p) {
		config[p] = val;
	});
}

// if we don't have a baseUrl
if (!config.baseUrl) {
	// find the curl.js script
	var src = findScript(config.doc, config.finderRx).src;
	// save baseUrl of the scriptEl
	config.baseUrl = src.substr(0, src.lastIndexOf('/') + 1);
}

function Loader (cfg) {
	this.cfg = cfg;
}

Loader.prototype = {

	head: function  () {
		// find and return the head element
		var el = this.cfg.doc.firstChild;
		while (el && el.nodeType !== 1) el = el.nextSibling;
		this.head = function () { return el; };
		return el;
	},

	loadScript: function (id, url, cb, eb) {
		var self = this;
		// initial script processing
		function process (ev) {
			// script processing rules learned from require.js
			var el = ev.currentTarget || ev.srcElement;
			if (ev.type === 'load' || /^(complete|loaded)$/.test(el.readyState)) {
				// release event listeners
				el.onload = el.onreadystatechange = el.onerror = null;
//				if (script.removeEventListener) {
//					script.removeEventListener('load', process, false);
//					script.removeEventListener('error', eb, false);
//				}
//				else {
//					script.detachEvent('onreadystatechange', process);
//					script.detachEvent('onerror', eb);
//				}
				cb();
			}
		}
		// insert script
		var script = this.cfg.doc.createElement('script');
		// detect when it's done loading
		// trying dom0 event handlers instead of wordy w3c/ms
		script.onload = script.onreadystatechange = process;
		script.onerror = eb;
//		if (script.addEventListener) {
//			script.addEventListener('load', process, false);
//			script.addEventListener('error', eb, false);
//		}
//		else {
//			script.attachEvent('onreadystatechange', process);
//			script.attachEvent('onerror', eb);
//		}
		script.type = 'text/javascript';
		script.charset = 'utf-8';
		script.async = true; // for Firefox
		script.src = url;
		this.head().appendChild(script);
	},

	idToUrl: function (id) {
		// TODO: handle relative ids
		return id + '.js';
	},

	load: function (id, cb, eb) {
		// TODO: handle plugins here?
		var url = this.idToUrl(id);
		var def = resources[id];
		// this id wasn't encountered yet
		if (!def) {
			// save callback
			def = resources[id] = {cb: cb};
			// prepare callbacks and errbacks
			var clear = timeout(this.cfg.waitSeconds * 1000, function () {
					delete def.cb;
					error(new Error('Timed out waiting for ' + id));
				});
			function success () {
				// return anonymously-define()d resource from defNet
				// or the named resource from resources{}
				// Note: defNet.r will be undefined if the resource has dependencies
				
				if (!('r' in def)) def.r = defNet.r;
				defNet = void 0;
				clear();
				cb();
			}
			function error (ex) {
				def.ex = new Error('Unable to find or load ' + id);
				clear();
				eb(ex);
			}
			this.loadScript(id, url, success, error);
		}
		// this id is for a resource currently being fetched
		else if (!('r' in def)) {
			// chain callback
			// TODO: if debugging, log calls to these callbacks and count them
			var prevCb = def.cb;
			def.cb = function (r) {
				prevCb && prevCb(r);
				cb(r);
			};
		}
		// this id is for a loaded resource
		else { //} if (def.r) {
			cb(def.r);
		}
//		else {
//			throw new Error('Internal loader error: resource ' + id + ' not found.');
//		}
	},

	loadMany: function (ids, cb, eb) {
		var count = ids.length,
			loaded = 0;
		function checkLoaded () {
			if (++loaded === count) {
				cb();
			}
		}
		for (var i = 0; i < count; i++) {
			this.load(ids[i], checkLoaded, eb);
		}
	}

};

function fixArgs (one, two, three) {
	// TODO: simplify this?
	// resolve args
	var args = {id: one, deps: two, f: three};
	if (isFunction(one)) {
		args.df = one;
		args.deps = [];
		args.id = null;
	}
	else if (isFunction(two)) {
		args.df = two;
		if (isArray(one)) {
			args.deps = one;
			args.id = null;
		}
		else {
			args.deps = [];
		}
	}
	return args;
}

function hasProtocol (url) {
	return /:\/\//.test(url);
}

function CommonJsLoader (cfg) {
	// TODO: handle or throw when paths don't end in "/"
	this.cfg = cfg;
	cfg.fullPaths = {};
	forIn(cfg.paths, function (path, p) {
		cfg.fullPaths[p] = hasProtocol(path) ? path : cfg.baseUrl + path;
	});
}

var cjsProto = CommonJsLoader.prototype = new Loader();

cjsProto.toUrl = function (relUrl) {
	// TODO: compare against paths
	return this.cfg.baseUrl + relUrl;
};

cjsProto.createDepList = function (ids) {
	// this should be called on resources that are already known to be loaded
	var deps = [],
		i = 0,
		id, r;
	while ((id = ids[i++])) {
		if (id === 'require') {
			// supply a scoped require function, if requested
			var self = this;
			r = beget(global.require);
			r.toUrl = function (relUrl) { return self.toUrl(relUrl); };
		}
		else if (id === ' exports') {
			// supply a new exports object, if requested
			if (deps.exports) throw new Error('"exports" may only be specified once. ' + id);
			deps.push(deps.exports = {});
		}
		else {
			r = resources[id].r;
		}
		deps.push(r);
	}
	return deps;
};

cjsProto.evalResource = function (deps, resource) {
	var res = resource;
	if (isFunction(res)) {
		var params = this.createDepList(deps);
		res = res.apply(null, params);
		// pull out and return the exports, if using that variant of AMD
		if (params.exports) {
			res = params.exports;
		}
	}
	return res;
};

//cjsProto.stashResource = function (id, resource) {
//	if (id != null) {
//		resources[id] = {r: resource};
//	}
//	else if (defNet != null) {
//		throw new Error('Multiple anonymous defines found while loading ' + id);
//	}
//	else {
//		defNet = resource;
//	}
//};


function createCfg (overrides) {
	// use global config
	var cfg = beget(config);
	// mix-in overrides
	forIn(overrides, function (val, p) {
		cfg[p] = val;
	});
	return cfg;
}

global.define = function (/* various */) {

	var args = fixArgs(arguments[0], arguments[1], arguments[2]),
		ldr = new CommonJsLoader(createCfg({}));

	function loaded () {
		// evaluate and save the resource
//		resources[args.id] = {r: ldr.evalResource(args.deps, args.df)};
//		ldr.stashResource(args.id, ldr.evalResource(args.deps, args.df));
	}

	function failed (ex) {
		throw ex;
	}

	if (args.id == null && typeof defNet !== 'undefined') {
		failed(new Error('Multiple anonymous defines found while loading ' + args.id));
	}
	else if (args.deps.length > 0) {
		if (!resources[args.id]) {
			// this define was not in direct response to a required dependency,
			// so we need to indicate that it's being loaded. just create a stub.
			resources[args.id] = {};
		}
		// save definition
		defNet = {};
		// start loading deps
		ldr.loadMany(args.deps, function () {
			var cb = defNet.cb;
			defNet = {r: ldr.evalResource(args.deps, args.df)};
			if (cb) cb();
		}, failed);
	}
	else if (args.id != null) {
		resources[args.id] = {r: ldr.evalResource(args.deps, args.df)};
	}
	else {
		defNet = {r: ldr.evalResource(args.deps, args.df)};
	}

};

global.require = function (/* various */) {
	// supports 3-argument variant in which the first param is a local configuration
	// supports 2-argument variant which loads deps and then calls a callback
	// also supports 1-argument variant which loads a resource sync (CommonJS syntax)
	
	var a0 = arguments[0],
		a1 = arguments[1],
		a2 = arguments[2],
		res, id, args,
		cfg = {};

	if (arguments.length === 1) {

		// return resource
		// TODO: get resource sync, if it's not already loaded (configurable)
		id = a0;
		var def = resources[id];
		if (!def || !('r' in def)) throw new Error('Required resource (' + id + ') is not already loaded.');
		res = def.r;

	}
	else {

		if (!isArray(a0)) {
			// local configuration
			cfg = a0;
			a0 = id = '_root_' + rootId++;
		}
		
		args = fixArgs(a0, a1, a2);
		var ldr = new CommonJsLoader(createCfg(cfg));

		function loaded () {
			ldr.evalResource(args.deps, args.df);
		}

		function failed (ex) {
			throw ex;
		}

		ldr.loadMany(args.deps, loaded, failed);

	}

	return res;

};

// this is to comply with the AMD CommonJS proposal:
global.define.amd = {};

}(window));
