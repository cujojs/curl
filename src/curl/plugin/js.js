/**
 * curl domReady
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licnsed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * usage:
 *  require(['ModuleA', 'js!myNonAMDFile.js', 'js!anotherFile.js!wait], function (ModuleA) {
 * 		var a = new ModuleA();
 * 		document.body.appendChild(a.domNode);
 * 	});
 *
 * Specify the !wait suffix to make curl wait for all other js files before evaluating.
 *
 */
(function (global, doc) {

	var queue = [], inFlightCount = 0;

	// TODO: find a way to reuse the loadScript from curl.js
	function loadScript (def, success, failure) {
		// script processing rules learned from RequireJS

		// insert script
		var el = def.ctx.doc.createElement('script'),
			head  = def.ctx.head;

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
			failure(new Error('Script error: ' + def.url));
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
				promise.resolve(el);
			},
			function (ex) {
				inFlightCount--;
				promise.reject(ex);
			}
		);

	}

	define({
		'load': function (name, require, callback, ctx) {

			var wait, prefetch, def, promise;

			// TODO: start using async=false
			wait = name.indexOf('!wait') >= 0;
			name = wait ? name.substr(0, name.indexOf('!')) : name;
			prefetch = 'jsPrefetch' in ctx ? ctx.jsPrefetch : true;
			def = {
				name: name,
				url: require.toUrl(name),
				ctx: ctx
			};
			promise = callback.resolve ? callback : {
				resolve: function (o) { callback(o); },
				reject: function (ex) { throw ex; }
			};

			// if this script has to wait for another
			if (wait && inFlightCount > 0) {
				// push before fetch in case IE has file cached
				queue.push([def, promise]);
				// if we're prefetching
				if (prefetch) {
					// go get the file under an unknown mime type
					var mimetype = def.mimetype;
					def.mimetype = 'text/cache';
					loadScript(def,
						// remove the fake script when loaded
						function (el) { el.parentNode.removeChild(el); },
						function () {}
					);
					def.mimetype = mimetype;
				}
			}
			// otherwise, just go get it
			else {
				inFlightCount++;
				fetch(def, promise);
			}

		}
	});

}());
