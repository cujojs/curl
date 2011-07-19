/*
	(c) copyright 2011, unscriptable.com / John M. Hann

	async plugin takes another module as it's resource and defers callback
	until that module is complete.  the module must return a promise-like
	object (i.e. has a then method)

*/
define(function () {

	return {

		'load': function (resourceId, require, callback, config) {
			require(resourceId, function (module) {
				if (typeof module.then == 'function') {
					module.then(function (resolved) {
						callback(arguments.length > 0 ? resolved : module);
					});
				}
				else {
					// TODO: should we throw here instead?
					callback(module);
				}
			});
		},

		'analyze': function (resourceId, api, addDep) {
			addDep(resourceId);
		}

	}

});
