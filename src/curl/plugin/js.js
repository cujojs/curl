/**
 * curl js plugin
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licnsed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * usage:
 *  require(['ModuleA', 'js!myNonAMDFile.js!order', 'js!anotherFile.js!order], function (ModuleA) {
 * 		var a = new ModuleA();
 * 		document.body.appendChild(a.domNode);
 * 	});
 *
 * Specify the !order suffix for files that must be evaluated in order.
 *
 * Async=false rules learned from @getify's LABjs!
 * http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
 *
 */
(function (global, doc) {

	var queue = [],
		inFlightCount = 0,
		supportsAsyncFalse = doc.createElement('script').async === true,
		readyStates = { 'loaded': 1, 'interactive': 1, 'complete': 1 },
		head = doc['head'] || doc.getElementsByTagName('head')[0];

	// TODO: find a way to reuse the loadScript from curl.js
	function loadScript (def, success, failure) {
		// script processing rules learned from RequireJS

		// insert script
		var el = doc.createElement('script');

		// initial script processing
		function process (ev) {
			ev = ev || global.event;
			// detect when it's done loading
			if (ev.type == 'load' || readyStates[this.readyState]) {
				// release event listeners
				this.onload = this.onreadystatechange = this.onerror = null;
				success(el);
			}
		}

		function fail (e) {
			// some browsers send an event, others send a string,
			// but none of them send anything useful, so just say we failed:
			if (failure) {
				failure(new Error('Script error: ' + def.url));
			}
		}

		// set type first since setting other properties could
		// prevent us from setting this later
		el.type = def.mimetype || 'text/javascript';
		// using dom0 event handlers instead of wordy w3c/ms
		el.onload = el.onreadystatechange = process;
		el.onerror = fail;
		el.charset = def.charset || 'utf-8';
		el.async = def.async;
		el.src = def.url;

		// use insertBefore to keep IE from throwing Operation Aborted (thx Bryan Forbes!)
		head.insertBefore(el, head.firstChild);

	}

	function fetch (def, promise) {

		loadScript(def,
			function (el) {
				var next;
				inFlightCount--;
				// if we've loaded all of the non-blocked scripts
				if (inFlightCount == 0 && queue.length > 0) {
					// grab next queued script
					next = queue.shift();
					// go get it (from cache hopefully)
					inFlightCount++;
					fetch.apply(null, next);
				}
				promise['resolve'](el);
			},
			function (ex) {
				inFlightCount--;
				promise['reject'](ex);
			}
		);

	}

	define({
		'load': function (name, require, callback, config) {

			var order, noexec, prefetch, def, promise;

			order = name.indexOf('!order') >= 0;
			noexec = name.indexOf('!noexec') >= 0;
			prefetch = 'jsPrefetch' in config ? config['jsPrefetch'] : true;
			name = order || noexec ? name.substr(0, name.indexOf('!')) : name;
			def = {
				name: name,
				url: require['toUrl'](name),
				async: true,
				order: order
			};
			promise = callback['resolve'] ? callback : {
				'resolve': function (o) { callback(o); },
				'reject': function (ex) { throw ex; }
			};

			// if this script has to wait for another
			// or if we're loading, but not executing it
			if (noexec || (order && inFlightCount > 0)) {
				if (supportsAsyncFalse && !noexec) {
					// specify that we want to wait before executing
					def.async = false;
					inFlightCount++;
					fetch(def, promise);
				}
				else {
					// push onto the stack of scripts that will be fetched
					// from cache unless we're not executing it. do this
					// before fetch in case IE has file cached.
					if (!noexec) {
						queue.push([def, promise]);
					}
					// if we're prefetching
					if (prefetch) {
						// go get the file under an unknown mime type
						def.mimetype = 'text/cache';
						loadScript(def,
							// remove the fake script when loaded
							function (el) { el.parentNode.removeChild(el); }
						);
						def.mimetype = '';
					}
				}
			}
			// otherwise, just go get it
			else {
				inFlightCount++;
				fetch(def, promise);
			}

		}
	});

}(this, document));

// ==ClosureCompiler==
// @output_file_name js.js
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==
