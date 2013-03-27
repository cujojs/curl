(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, core, config, define, Deferred;

	curl = require('curl');
	core = curl.get('curl/core');
	config = curl.get('curl/config');
	define = curl.get('curl/define');
	Deferred = curl.get('curl/Deferred');
	curl.restore();

	buster.testCase('define', {
		'should call defineAmdModule with the results of fixDefineArgs': function () {
			// this is a bit silly, but it's all that the public `define` does
			var marker1 = {}, marker2 = {}, marker3 = {}, defineAmdModule;
			this.stub(core, 'fixDefineArgs').returnsArg(0);
			defineAmdModule = this.stub(core, 'defineAmdModule');
			assert(typeof define == 'function', 'define is a function');
			define(marker1, marker2, marker3);
			assert.calledOnceWith(defineAmdModule, marker1, marker1, marker3);
		}
	});

	buster.testCase('curl', {
		'should have useful properties': function () {
			assert(typeof curl == 'function', 'curl is a function');
			assert(typeof curl.config == 'function', 'curl.config is a function');
			assert(typeof curl.version == 'string', 'curl.version is a string');
		},
		'should call config() when given an object': function () {
			var stub, input, result;
			stub = this.stub(config, 'set');
			input = {};
			result = curl(input);
			assert.calledWith(stub, input);
			assert(result && typeof result.then == 'function', 'return a promise');
		},
		'should return CurlApi when called with array': function () {
			var result;

			this.stub(core, 'createModuleContext').returns({});
			this.stub(core, 'createFactoryExporter');
			this.stub(core, 'resolveDeps').returns(new Deferred().promise);
			this.stub(config, 'set');

			result = curl([]);
			assert.defined(result, 'curl returned something');
			assert(typeof result.then == 'function', 'then function');
			assert(typeof result.next == 'function', 'next function');
			assert(typeof result.config == 'function', 'config function');
			assert(isThenable(result.then(noop)), 'then function returns a promise');
			assert(isThenable(result.next([])), 'next function returns a promise');
			assert(isThenable(result.config({})), 'config function returns a promise');
		}
	});

	buster.testCase('curl.get', {
		'should call sync when given a string': function () {
			var stub = this.stub(core, 'isModuleContext').returns(false);
			refute.exception(function () {
				curl.get('curl');
			});
			assert(!!curl.get('curl'), 'curl.get returns a known cached module');
			assert.exception(function () {
				curl.get('curl/foo/bar');
			});
		}
	});

	function noop (val) { return val; }

	function isThenable (it) {
		return it && typeof it.then == 'function';
	}

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));