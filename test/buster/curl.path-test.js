(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, path;

	curl = require('curl');
	path = curl.get('curl/path');
	curl.restore();

	buster.testCase('path.isAbsUrl', {
		'should return true for absolute urls': function () {
			assert(path.isAbsUrl('/foo/bar'), 'starts with a slash');
			assert(path.isAbsUrl('foo://foo/bar'), 'starts with a protocol');
			assert(path.isAbsUrl('//foo/bar'), 'starts with a double slash');
		},
		'should return false for relative urls': function () {
			refute(path.isAbsUrl('./foo/bar'), 'starts with a dot');
			refute(path.isAbsUrl('../foo/bar'), 'starts with a double-dot');
			refute(path.isAbsUrl('foo/bar'), 'starts with a letter');
		}
	});

	buster.testCase('path.isRelPath', {
		'should return true for relative ids': function () {
			assert(path.isRelPath('./foo/bar'), 'starts with a dot');
			assert(path.isRelPath('../foo/bar'), 'starts with a double-dot');
		},
		'should return false for absolute ids': function () {
			refute(path.isRelPath('/foo/bar'), 'starts with a slash (is actually a url)');
			refute(path.isRelPath('foo/bar'), 'starts with a dot');
			refute(path.isRelPath('bar'), 'starts with a double-dot');
		}
	});

	buster.testCase('path.joinPaths', {
		'should join paths': function () {
			assert('foo/bar', path.joinPaths('foo', 'bar'), 'simple join');
			assert('foo/bar', path.joinPaths('foo/', 'bar'), 'trailing slash');
			assert('foo/bar.js', path.joinPaths('foo/', 'bar.js'), 'with extension');
			assert('gak/foo/bar/baz', path.joinPaths('gak/foo/', 'bar/baz'), 'with many slashes');
		}
	});

	buster.testCase('path.removeEndSlash', {
		'should remove a slash': function () {
			assert.equals('foo/bar', path.removeEndSlash('foo/bar/'), 'remove ending slash');
			assert.equals('baz', path.removeEndSlash('baz/'), 'remove ending slash 2');
			assert.equals('/foo/bar/baz', path.removeEndSlash('/foo/bar/baz/'), 'remove ending slash 3');
			assert.equals('foo/bar', path.removeEndSlash('foo/bar'), 'remove nothing if no slash at end');
		}
	});

	buster.testCase('path.reduceLeadingDots', {
		'should remove leading dots': function () {
			assert.equals('', path.reduceLeadingDots('.', ''), 'base url');
			assert.equals('..', path.reduceLeadingDots('..', ''), 'one level above base url');
			assert.equals('../..', path.reduceLeadingDots('../..', ''), 'two levels above base url');
			assert.equals('foo', path.reduceLeadingDots('.', 'foo/bar'), 'identity');
			assert.equals('foo', path.reduceLeadingDots('..', 'foo/bar/gak'), 'parent');
			assert.equals('foo/bar', path.reduceLeadingDots('foo/bar', 'gak'), 'no leading dots');
			assert.equals('foo/bar', path.reduceLeadingDots('./bar', 'foo/gak'), 'peer');
			assert.equals('bar', path.reduceLeadingDots('./bar', 'foo'), 'peer 2');
			assert.equals('foo/bar', path.reduceLeadingDots('../bar', 'foo/gak/goo'), 'up one level');
		},
		'should fail to navigate above or to a peer of a package': function () {
			refute.equals('bar', path.reduceLeadingDots('../bar', 'foo'), 'up to root');
			refute.equals('foo/bar', path.reduceLeadingDots('../foo/bar', 'gak'), 'up to root 2');
			refute.equals('foo/bar', path.reduceLeadingDots('../../foo/bar', 'gak'), 'above root');
		}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));