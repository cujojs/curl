/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl createContext module
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

/**
 * TODO: rewrite this!
 * Adds the ability to define temporary mocks and stubs. Devs can create
 * a test context on which they define named modules and then release
 * them so that the next set of tests has a clean environment and can
 * re-define other mocks or actual modules.
 *
 * Note: the global `define` and `curl` as well as the local `require`
 * are not modified so mocks and stubs must be defined as named, inline
 * modules.
 *
 * The define function returned still uses the global cache.
 * Any pre-existing modules in the cache are available.  Be careful not
 * to have concurrent test contexts since they also share the global cache.
 *
 * Modules may be pre-cached to prevent repeated fetches.
 *
 * TODO: fix examples
 * @example 1
 * curl(['curl/tdd/createContext', 'require'], function (createContext, require) {
 *  	var testContext = createContext(require);
 *
 *  	testcontext.isolate(function () {
 *  		// after `isolate()` is done, any modules are removed from cache
 *
 *
 *  	}
 *
 *  	// define mocks under this test context
 *  	testContext.define('mock1', { methodA: function () {} });
 *  	testContext.define('mock2', { method2: function () {} });
 *  	testContext.define('mock3', { propA: 'foo' });
 *  	testContext.define('mock4', { propC: 'bar' });
 *
 *  	// require and test modules using mocks here...
 *
 *  	// undefine a few mocks
 *  	testContext.undefine('mock1', 'mock2');
 *
 *  	// redefine a mock
 *  	testContext.redefine('mock3', { propA: 'bar' });
 *
 *  	// more testing here...
 *
 *  	// release all mocks and stubs
 *  	testContext.release();
 * 	});
 *
 */
define(['curl', 'curl/_privileged'], function (curl, priv) {
"use strict";

	var cache, Promise, defineResource, queue, undef;

	cache = priv['cache'];
	Promise = priv['core'].Promise;
	defineResource = priv['core'].defineResource;

	/*	var context = createContext(require);
	 *	context.setup(
	 *		function (require, complete) {
	 *			define('mock1', function () {});
	 *			require(['mock2', 'mock3']);
	 *			require(['supportModule'], function (support) {
	 *				define('mock4', function () { return support.foo(42); });
	 *			});
	 *		}
	 *	).teardown(
	 *		function (require, complete) {
	 *			// clean up any globals, etc
	 *		}
	 *	).run(
	 *		function (require, complete) {
	 *			// insert tests here
	 *		}
	 *	});
	 */

	function when (promiseOrValue, callback, errback) {
		var promise;

		promise = new Promise();

		if (promiseOrValue instanceof Promise) {
			promiseOrValue
				.then(callback, errback)
				.then(promise.resolve, promise.reject);
		}
		else {
			try {
				callback();
				promise.resolve();
			}
			catch (ex) {
				promise.reject(ex);
			}
		}

		return promise;
	}

	function sequenceReturnedPromises (functions) {
		var promise;

		promise = new Promise();

		function nextFunc (func) {
			when(func(), function () {
				var next = functions.unshift();
				if (next) nextFunc(next);
				else promise.resolve();
			}, promise.reject);
		}

		nextFunc(functions.unshift());

		return promise;
	}

	function listenForNewModules (callback) {
		var listeners;
		// add to listeners
		listeners = listenForNewModules.listeners;
		listeners.push(callback);
		// return a function to remove from listeners
		return function unlisten () {
			var i = listeners.length;
			while (i >= 0 && callback != listeners[--i]) {}
			if (i >= 0) {
				listeners.splice(i, 1);
			}
		};
	}
	listenForNewModules.listeners = [];

	priv['core'].defineResource = function (def) {
		var i, listener;
		// notify listeners
		i = 0;
		while ((listener = listenForNewModules.listeners[i++])) {
			listener(def.id);
		}
		// do the usual thing
		return defineResource.apply(this, arguments);
	};

	/**
	 * Creates a test context.
	 * @param require {Function|Undefined}
	 * @param setup {Function}
	 * @param teardown {Function}
	 */
	function createContext (require, setup, teardown) {
		var context;

		if (!require) require = curl;

		context = {};

		function createTrackedRequire (require, devUsedRequire, modulesAllFetched) {
			var callCount = 0;
			return function trackedRequire (idOrArray, callback) {
				var cb;

				callCount++;

				cb = function () {
					callback.apply(this, arguments);
					// if this is the last require
					if (--callCount == 0) modulesAllFetched();
				};

				trackedRequire.notAsync = function () { return callCount == 0; };

				// preserve AMD API
				trackedRequire.toUrl = require.toUrl;

				return require(idOrArray, cb);
			}
		}

		function waitForTestFunc (func) {
			var dfdR, dfdC, trackedRequire, promise;

			function needToWaitForComplete () { dfdC = dfdC || new Promise(); }
			function needToWaitForRequires () { dfdR = dfdR || new Promise(); }
			function funcIsComplete () { dfdC && dfdC.resolve(); }
			function requiresAreComplete () { dfdR && dfdR.resolve(); }

			promise = new Promise();

			// if dev didn't specify they wanted the funcIsComplete callback,
			// there's no need for the second deferred.
			if (func.length == 2) needToWaitForComplete();

			trackedRequire = createTrackedRequire(
				require,
				needToWaitForRequires,
				requiresAreComplete
			);

			// run test function
			func(trackedRequire, funcIsComplete);

			// wait for deferreds
			when(dfdR, function () {
				when(dfdC, promise.resolve());
			});

			return promise;
		}

		/***** API *****/

		context.run = function runTests (run) {
			var promise;

			queue = promise = when(queue, function () {
				var unlisten, moduleIds;

				moduleIds = {};

				function discoveredNewModule (id) {
					moduleIds[id] = true;
				}

				function releaseModules () {
					for (var id in moduleIds) {
						delete cache[id];
					}
					moduleIds = {};
				}

				function allDone () {
					releaseModules();
					unlisten();
					promise.resolve();
				}

				unlisten = listenForNewModules(discoveredNewModule);

				sequenceReturnedPromises([
					waitForTestFunc(setup),
					waitForTestFunc(run),
					waitForTestFunc(teardown)
				]).then(allDone, allDone);

			});
		};

		return context;


	}

	return createContext;

});
