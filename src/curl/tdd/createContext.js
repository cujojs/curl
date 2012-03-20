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
 * @example 1
 * curl(['curl/tdd/createContext', 'require'], function (createContext, require) {
 *  	var testContext = createContext();
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

	var cache, Promise, queue, undef;

	cache = priv['cache'];

	Promise = priv['core'].Promise;

	/*	var context = createContext(require);
	 *	context.config({
	 *		moduleId: 'pkg/moduleToTest',
	 *		setup: function (require, define) {
	 *			define('mock1', function () {});
	 *			require(['mock2', 'mock3']);
	 *			require(['supportModule'], function (support) {
	 *				define('mock4', function () { return support.foo(42); });
	 *			});
	 *		},
	 *		run: function (moduleToTest, doneCallback) {
	 *			// insert tests here
	 *		}
	 *	});
	 *	// you have to call run()
	 *	context.run();
	 */

	function when (promiseOrValue, callback) {
		if (promiseOrValue instanceof Promise) {
			promiseOrValue.then(callback);
		}
		else {
			callback();
		}
	}

	/**
	 * Creates a test context that has `define`, `undefine`, and `release`
	 * methods.
	 * @param require {Function}
	 */
	function createContext (require) {
		var moduleIds, context, promise;

		if (!require) require = curl;

		moduleIds = [];
		context = {};
		promise = new Promise();

		promise.then(release, release);

		function saveConfig (config) {
			context = config;
			// TODO: assert config is correct
			if (!isFunction(config.setup) || config.setup.length == 0) {
				throw new Error('createContext: config.setup should be function (require, define) {}');
			}
			if (!isFunction(config.run) || config.run.length == 0) {
				throw new Error('createContext: config.run should be function (moduleToTest, doneCallback) {}');
			}
//			if (config.queued !== false) {
				scheduleTests();
//			}
			return this;
		}

		function scheduleTests () {
			// when the queue is empty
			when(queue, function () {
				// set up resources/modules
				when(setup(), function () {
					// get module to test
					_require(context.module, function (module) {
						// run tests
						context.run(module, function () {
							// resolve when done with tests
							promise.resolve();
						});
						// if tests are sync, resolve now
						if (context.run.length < 2) {
							promise.resolve();
						}
					});
				});
			});
			queue = promise;
			return promise;
		}

		function setup () {
			var countdown, promise;
			// count requires and then release to caller
			countdown = 0;
			promise = new Promise();
			function trackedRequire (idOrArray, callback) {
				var result, cb;
				if (isArray(idOrArray)) {
					countdown++;
					cb = function () {
						callback.apply(this, arguments);
						if (--countdown == 0) promise.resolve();
					};
				}
				result = _require(idOrArray, cb);
			}
			context.setup(trackedRequire, _define);
			if (countdown == 0) promise.resolve();
		}

		function _define (id) {

			// throw if dev didn't name module
			if (!isString(id) || arguments.length == 1) {
				throw new Error('createContext: attempt to define an inline module without a module id: ' + arguments);
			}

			// throw if this id is already in the cache
			if (id in cache) {
				throw new Error('createContext: attempt to define a module that is already defined: ' + id);
			}

			// save name for later release
			moduleIds.push(id);

			// define module the usual way
			define.apply(undef, arguments);
		}

		function _require (idOrArray, callback) {
			var arr, id;

			// throw if dev didn't name modules
			if (!isString(idOrArray) || !isArray(idOrArray)) {
				throw new Error('createContext: require() needs an array or a string: ' + arguments);
			}

			// save module ids for later release if they're not already cached
			// modules may be pre-cached to prevent repeated fetches
			arr = [].concat(idOrArray);
			while ((id = arr.pop())) {
				if (!(id in cache)) {
					moduleIds.push(id);
				}
			}

			return require(idOrArray, callback);
		}

		function release () {
			var id;
			while ((id = moduleIds.pop())) {
				delete cache[id];
			}
		}

		/***** return API *****/

		return {
			config: saveConfig,
			run: scheduleTests
		};

		/***** other functions *****/

		function toString (obj) {
			return Object.prototype.toString.call(obj);
		}

		function isArray (obj) {
			return toString(obj) == '[object Array]';
		}

		function isFunction (obj) {
			return toString(obj) == '[object Function]';
		}

		function isString (obj) {
			return toString(obj) == '[object String]';
		}

	}

	return createContext;

});
