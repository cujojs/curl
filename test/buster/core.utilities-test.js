(function (buster, define) {

var assert, refute, fail;

assert = buster.assert;
refute = buster.refute;
//fail = buster.assertions.fail;

define(function (require) {

	var curl, core,
		stubContext1, stubContext2;

	curl = require('curl');
	core = curl('curl/core');

	stubContext1 = {
		require: function () {},
		exports: {},
		id: 'stubContext1',
		url: 'file://subContext1',
		realm: { cfg: {} }
	};

	stubContext2 = {
		require: function () {}
	};

	buster.testCase('core.cjsFreeVars', {
		'core.cjsFreeVars.require should return this.require function': function () {
			assert.same(core.cjsFreeVars.require.call(stubContext1), stubContext1.require);
		},
		'core.cjsFreeVars.exports should return this.exports object': function () {
			assert.same(core.cjsFreeVars.exports.call(stubContext1), stubContext1.exports);
		},
		'core.cjsFreeVars.exports should auto-create this.exports object': function () {
			assert.equals(core.cjsFreeVars.exports.call(stubContext2), {});
		},
		'core.cjsFreeVars.module should auto-create this.module object': function () {
			var module = core.cjsFreeVars.module.call(stubContext1);
			assert.equals(module.id, stubContext1.id);
			assert.equals(module.uri, stubContext1.url);
			assert.equals(module.exports, stubContext1.exports);
			assert.equals(module.config(), stubContext1.realm.cfg);
		}
	});

	buster.testCase('core.extractCjsDeps', {
		'should find valid r-val require() calls': function () {
			var ids = core.extractCjsDeps(testFactory1);
			assert.contains(ids, 'one');
			assert.contains(ids, 'two');
			assert.contains(ids, 'three');
			assert.contains(ids, 'four');
			refute.contains(ids, 'foo1');
			refute.contains(ids, 'foo2');
			refute.contains(ids, 'foo3');
			refute.contains(ids, 'foo4');
			refute.contains(ids, 'foo6');
		}
	});

	function testFactory1 () {
		// require('foo1'); inside a line comment
		/*
		 require('foo2'); inside a block comment
		*/
		var foolMeOnce = ' require("foo3"); in a string';
		var foolMeTwice = " require('foo4'); in a string";
		var foolMeThrice = " // require(\"foo5\"); in a comment in a string";
		var ohYoureKidding = " /* require(\"foo6\"); in a b0rked comment in a string";

		var findMePlz = require('one');

		require('two');

		return '//' + require('three') + '/*' + require('four');
	}

	buster.testCase('core.isAbsUrl', {
		'should return true for absolute urls': function () {
			assert(core.isAbsUrl('/foo/bar'), 'starts with a slash');
			assert(core.isAbsUrl('foo://foo/bar'), 'starts with a protocol');
			assert(core.isAbsUrl('//foo/bar'), 'starts with a double slash');
		},
		'should return false for relative urls': function () {
			refute(core.isAbsUrl('./foo/bar'), 'starts with a dot');
			refute(core.isAbsUrl('../foo/bar'), 'starts with a double-dot');
			refute(core.isAbsUrl('foo/bar'), 'starts with a letter');
		}
	});

	buster.testCase('core.isRelPath', {
		'should return true for relative ids': function () {
			assert(core.isRelPath('./foo/bar'), 'starts with a dot');
			assert(core.isRelPath('../foo/bar'), 'starts with a double-dot');
		},
		'should return false for absolute ids': function () {
			refute(core.isRelPath('/foo/bar'), 'starts with a slash (is actually a url)');
			refute(core.isRelPath('foo/bar'), 'starts with a dot');
			refute(core.isRelPath('bar'), 'starts with a double-dot');
		}
	});

	buster.testCase('core.removeEndSlash', {
		'should remove a slash': function () {
			assert.equals('foo/bar', core.removeEndSlash('foo/bar/'), 'remove ending slash');
			assert.equals('baz', core.removeEndSlash('baz/'), 'remove ending slash 2');
			assert.equals('/foo/bar/baz', core.removeEndSlash('/foo/bar/baz/'), 'remove ending slash 3');
			assert.equals('foo/bar', core.removeEndSlash('foo/bar'), 'remove nothing if no slash at end');
		}
	});

	buster.testCase('core.reduceLeadingDots', {
		'should remove leading dots': function () {
			assert.equals('foo/bar', core.reduceLeadingDots('foo/bar', 'gak'), 'no leading dots');
			assert.equals('foo/bar', core.reduceLeadingDots('./bar', 'foo/gak'), 'peer');
			assert.equals('bar', core.reduceLeadingDots('./bar', 'foo'), 'peer 2');
			assert.equals('foo/bar', core.reduceLeadingDots('../bar', 'foo/gak/goo'), 'up one level');
		},
		'should fail to navigate above or to a peer of a package': function () {
			refute.equals('bar', core.reduceLeadingDots('../bar', 'foo'), 'up to root');
			refute.equals('foo/bar', core.reduceLeadingDots('../foo/bar', 'gak'), 'up to root 2');
			refute.equals('foo/bar', core.reduceLeadingDots('../../foo/bar', 'gak'), 'above root');
		}
	});

	buster.testCase('core.isType', {
		'should detect built-in types': function () {
			assert(core.isType('', 'String'));
			assert(core.isType([], 'Array'));
			assert(core.isType({}, 'Object'));
			assert(core.isType(new Date, 'Date'));
			assert(core.isType(new RegExp, 'RegExp'));
		}
	});

	buster.testCase('core.beget', {
		'should inherit properties but not be same object': function () {
			var obj = {
				foo: 42,
				bar: {}
			};
			assert.match(obj, core.beget(obj), 'matches');
			refute.same(obj, core.beget(obj), 'not same');
		},
		'should mixin properties': function () {
			var obj, mixin, child;
			obj = {
				foo: 42
			};
			mixin = {
				foo: 27,
				bar: 'bar'
			};
			child = core.beget(obj, mixin);
			assert.match({ foo: 27, bar: 'bar' }, child, 'mixins override');
			delete child.foo;
			assert.match({ foo: 42, bar: 'bar' }, child, 'inherited still exists');
		}
	});

	buster.testCase('core.nextTurn', {
		'should execute function in next turn': function (done) {
			var val, l8r;
			val = 0;
			l8r = function () {
				assert(true, 'async code executed');
				done();
			};
			core.nextTurn(l8r);
			assert.equals(val, 0, 'inline code');
		}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));