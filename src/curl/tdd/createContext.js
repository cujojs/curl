/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl createContext module
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */

/**
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

	var cache, undef;

	cache = priv['cache'];

	/**
	 * Creates a test context that has `define`, `undefine`, and `release`
	 * methods.
	 * @param require {Function}
	 */
	function createContext (require) {
		var moduleIds;

		if (!require) require = curl;

		moduleIds = [];

		function _define (id) {

			// throw if dev didn't name module
			if (typeof id != 'string' || arguments.length == 1) {
				throw new Error('Attempt to define an inline module without a module id: ' + arguments);
			}

			// throw if this id is already in the cache
			if (id in cache) {
				throw new Error('Attempt to define a module that is already defined: ' + id);
			}

			// save name for later release
			moduleIds.push(id);

			// define module the usual way
			define.apply(undef, arguments);
		}

		function _release (ids) {
			var id;
			while ((id = ids.pop())) {
				delete cache[id];
			}
		}

		function _require (idOrArray, callback) {
			moduleIds.concat(idOrArray);
			return require(idOrArray, callback);
		}

		return {

			/**
			 * Defines a named module that can be removed from the cache
			 * by a subsequent call to this test context's `undefine` or
			 * `release` methods.
			 * @param id {String} absolute id of the mock or stub module
			 * @param [deps] {Array} array of modules that this mock or stub
			 *   requires. These modules will be fetched in the usual way if
			 *   they are not also defined as stubs beforehand.
			 * @param [func] {Function|Object} factory function or object
			 *   that defines the mock or stub.
			 */
			define: function () { _define.apply(undef, arguments); },

			/**
			 * Removes the mocks or stubs from the cache for the next set
			 * of tests.  List one or more ids as parameters.
			 * @param idOrArray {String|Array} id of module to remove from
			 *   cache or an array of ids.
			 * @param [id2...] {String} if id is a string, the remaining
			 *   arguments are assumed to be ids of other modules to remove.
			 */
			undefine: function (idOrArray) {
				if (typeof idOrArray == 'string') {
					_release([].slice.call(arguments));
				}
				else {
					_release(idOrArray);
				}
			},

			/**
			 * Redefines a named module by removing it from the cache and
			 * then defining it again.  Just a convenient way to call
			 * `ctx.undefine(id); ctx.define(id, stub);`.
			 * @param id {String} absolute id of the mock or stub module
			 * @param [deps] {Array} array of modules that this mock or stub
			 *   requires. These modules will be fetched in the usual way if
			 *   they are not also defined as stubs beforehand.
			 * @param [func] {Function|Object} factory function or object
			 *   that defines the mock or stub.
			 */
			redefine: function () {
				_release([arguments[0]]);
				_define.apply(undef, arguments);
			},

			/**
			 * Requires a module or modules in the usual way, but allows
			 * it/them to be removed from the cache by calling `undefine`.
			 * @param idOrArray {String|Array} a module id if using `require`
			 *   as an R-Value or an array if using `require` in async
			 *   mode.
			 * @param [callback] {Function} the function to call when using
			 * `require` asynchronously.
			 */
			require: function (idOrArray) {
				return _require(idOrArray, arguments[1]);
			},

			/**
			 * Undefines a module or modules and then requires a module
			 * or modules in the usual way, but allows it/them to be
			 * removed from the cache by calling `undefine`.
			 * @param idOrArray {String|Array} a module id if using `require`
			 *   as an R-Value or an array if using `require` in async
			 *   mode.
			 * @param [callback] {Function} the function to call when using
			 * `require` asynchronously.
			 */
			rerequire: function (idOrArray) {
				if (typeof idOrArray == 'string') {
					_release([].slice.call(arguments));
				}
				else {
					_release(idOrArray);
				}
				return _require(idOrArray, arguments[1]);
			},

			/**
			 * Removes all mocks and stubs defined by this test context.
			 */
			release: function () { _release(moduleIds); }
		};

	}

	return createContext;

});
