(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, core, define, Deferred;

	curl = require('curl');
	core = curl('curl/core');
	define = curl('curl/define');
	Deferred = curl('curl/Deferred');

	buster.testCase('define', {
		'should call defineAmdModule with the results of fixDefineArgs': function () {
			// this is a bit silly, but it's all that the public `define` does
			var marker1 = {}, marker2 = {}, marker3 = {}, result, restore;
			restore = mockCoreFunctions({
				fixDefineArgs: function (args) { return args; },
				defineAmdModule: function () { result = arguments; }
			});
			try {
				assert(typeof define == 'function', 'define is a function');
				define(marker1, marker2, marker3);
				assert.equals([marker1, marker1, marker3], result);
			}
			finally {
				restore();
			}
		}
	});

	buster.testCase('curl', {
		'should have useful properties': function () {
			assert(typeof curl == 'function', 'curl is a function');
			assert(typeof curl.config == 'function', 'curl.config is a function');
			assert(typeof curl.version == 'string', 'curl.version is a string');
		},
		'should call sync when given a string': function () {
			var restore, marker;
			restore = mockCoreFunctions({
				createPipeline: function () { return function () { return marker; } }
			});
			try {
				marker = {};
				core.defineAmdModule('curl/test/one', [], function () {}, {});
				assert.same(marker, curl('curl/test/one'));
				assert.exception(function () {
					curl('curl/foo/bar');
				});
			}
			finally {
				restore();
			}
		},
		'should call config() when given an object': function () {
			var restore, input, output, result;
			restore = mockCoreFunctions({
				config: function (cfg) { output = cfg; }
			});
			input = {};
			try {
				result = curl(input);
				assert.same(input, output, 'call config() with first param');
				assert(result && typeof result.then == 'function', 'return a promise');
			}
			finally {
				restore();
			}
		},
		'should return CurlApi when called with non-string': function () {
			var restore, result;
			restore = mockCoreFunctions({
				createModuleContext: function () { return {}; },
				createFactoryExporter: function () {},
				resolveDeps: function () { return new Deferred().promise; },
				config: function () {}
			});
			try {
				result = curl([]);
				assert.defined(result, 'curl returned something');
				assert(typeof result.then == 'function', 'then function');
				assert(typeof result.next == 'function', 'next function');
				assert(typeof result.config == 'function', 'config function');
				assert(isThenable(result.then(noop)), 'then function returns a promise');
				assert(isThenable(result.next([])), 'next function returns a promise');
				assert(isThenable(result.config({})), 'config function returns a promise');
			}
			finally {
				restore();
			}
		}
	});

	buster.testCase('blah', {
		'// should do something': function () {
			assert(false);
		}
	});

	function noop (val) { return val; }

	function isThenable (it) {
		return it && typeof it.then == 'function';
	}

	function mockCoreFunctions (map) {
		var restore = {};
		for (var p in map) {
			restore[p] = core[p];
			core[p] = map[p];
		}
		return function () {
			for (var p in restore) {
				core[p] = restore[p];
			}
		}
	}

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));