(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, core;

	curl = require('curl');
	core = curl.get('curl/core');
	curl.restore();

	buster.testCase('core.createModuleContext', {
		'should create a module context': function () {
			var pctx, mctx;
			pctx = { realm: {} };
			mctx = new core.createModuleContext('foo', pctx);
			assert(typeof mctx == 'object', 'context is an object');
			assert.equals('foo', mctx.id, 'context has an id property');
			assert.equals(pctx, mctx.parentCtx, 'context has a parentCtx property');
			assert.equals(pctx.realm, mctx.realm, 'context has a realm property');
		}
	});

	buster.testCase('core.isModuleContext', {
		'should detect a module context': function () {
			var pctx, mctx;
			pctx = { realm: {} };
			mctx = new core.createModuleContext('foo', pctx);
			assert(core.isModuleContext(mctx), 'context is a ModuleContext');
			refute(core.isModuleContext({}), 'non-context is not a ModuleContext');
		}
	});

	buster.testCase('core.initModuleContext', {
		'should initialize a module context': function () {
			var pctx, mctx;
			pctx = { realm: {} };
			mctx = new core.createModuleContext('foo', pctx);
			mctx = core.initModuleContext(mctx);
			assert.equals(mctx.realm, pctx.realm);
		}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));