/**
 *
 * debug extension
 *
 * Specify debug:true in the curl configuration to load this extension and
 * start debugging your module loading.
 *
 * (c) copyright 2011, unscriptable.com
 *
 */

// TODO: pass a debug output node to the config debugOutputNode: <some node id or reference>


/*
 * how this will work:
 * 1) wrap require() and define() in functions that log all arguments and returns
 * 2) have curl.js expose a few additional methods in the curl object when debug:true
 * 3) wrap the additional methods, too
 * 4) add a console object if it's missing
 * 5) have curl.js load this file as an implicit dependency before any other modules are loaded (how?)
 * 
 */




//if (!global.console) {
//	global.console = {
//		log: function () {
//			function string (o) { return o === null ? 'null' : o === undef ? 'undefined' : o.toString(); }
//			var doc = config.doc,
//				a = arguments,
//				s = string(a[0]);
//			for (var i = 1; i < a.length; i++) {
//				s += ', ' + string(a[i]);
//			}
//			// remove setTimeout and use ready()
//			//setTimeout(function () {
//				doc.body.appendChild(doc.createElement('div')).innerHTML = s + '<br/>';
//			//}, 1000);
//		}
//	};
//}

//// add debugging code if we're debugging
//if (config.debug === 'full') {
//	// log all arguments and results of the following methods
//	var methods = {
//			'define': global,
//			'require': global,
//			'then': ResourceDef.prototype,
//			'resolve': ResourceDef.prototype,
//			'reject': ResourceDef.prototype,
//			'_cleanup': ResourceDef.prototype
//		};
//	for (var m in methods) {
//		methods[m][m] = (function (f, n) {
//			return function () {
//				console.log('DEBUG: ' + n + ' args:', arguments);
//				var r = f.apply(this, arguments);
//				console.log('DEBUG: ' + n + ' result:', r);
//				return r;
//			};
//		}(methods[m][m], m));
//	}
//}
