(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, core;

	curl = require('curl');
	core = curl('curl/core');

	buster.testCase('core.createModuleContext', {
		'should create a module context': function () {
			var realm, mctx;
			realm = {};
			mctx = new core.createModuleContext('foo', realm);
			assert(typeof mctx == 'object', 'context is an object');
			assert.equals('foo', mctx.id, 'context has an id property');
			assert.equals(realm, mctx.parentRealm, 'context has a parentRealm property');
			assert.equals(realm, mctx.realm, 'context has a realm property');
		}
	});

	buster.testCase('core.isModuleContext', {
		'should detect a module context': function () {
			var realm, mctx;
			realm = {};
			mctx = new core.createModuleContext('foo', realm);
			assert(core.isModuleContext(mctx), 'context is a ModuleContext');
			refute(core.isModuleContext({}), 'non-context is not a ModuleContext');
		}
	});

	buster.testCase('core.initModuleContext', {
		'should initialize a module context': function () {
			var realm, mctx;
			realm = {
				idToUrl: function (id) { return 'bar'; }
			};
			mctx = new core.createModuleContext('foo', realm);
			mctx = core.initModuleContext(mctx);
			assert.equals(mctx.url, 'bar');
		}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));