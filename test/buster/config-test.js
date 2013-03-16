(function (buster, define) {

var assert, refute, fail;

assert = buster.assert;
refute = buster.refute;
//fail = buster.assertions.fail;

define(function (require) {

	var curl, core,
		pkgDescriptor1, pkgDescriptor2, pkgDescriptor3, pkgDescriptor4,
		normalized1, normalized2, normalized3, normalized4;

	curl = require('curl');
	core = curl('curl/core');

	pkgDescriptor1 = {
		name: 'name',
		location: 'lib/name/lib',
		main: './index'
	};

	pkgDescriptor2 = {
		name: 'foo',
		location: 'lib/foo/' // trailing slash
		// no main
	};

	pkgDescriptor3 = {
		name: 'foo/bar', // extra specificity
		location: 'lib/foo/bar',
		main: 'foo'
	};

	// string descriptor (like paths config)
	pkgDescriptor4 = 'lib/jquery/jquery1.8.min';

	normalized1 = core.normalizePkgDescriptor(pkgDescriptor1, null, true);
	normalized2 = core.normalizePkgDescriptor(pkgDescriptor2, null, true);
	normalized3 = core.normalizePkgDescriptor(pkgDescriptor3, null, true);
	normalized4 = core.normalizePkgDescriptor(pkgDescriptor4, 'jquery', false);

	buster.testCase('curl normalizePkgDescriptor', {
		'should beget original descriptor': function () {
			var orig = { name: 'foo', other: 42 }, desc;
			desc = core.normalizePkgDescriptor(orig);
			refute.same(orig, desc, 'beget');
			assert.equals(orig.name, desc.name, 'inherited standard props');
			assert.equals(orig.other, desc.other, 'inherited other props');
		},
		'should normalize properties': function () {
			assert.equals(normalized1.main, 'name/index', 'explicit relative main');
			assert.equals(normalized3.main, 'foo/bar/foo', 'implcit relative main');
			assert.equals(normalized1.path, pkgDescriptor1.location, 'location-->path');
			assert.equals(normalized1.path, 'lib/name/lib', 'remove trailing slash');
		},
		'should add standard properties': function () {
			assert.equals(normalized2.main, 'foo/main', 'missing main');
			assert.equals(normalized3.specificity, 2, 'specificity');
			assert.equals(normalized4.name, 'jquery', 'missing main');
			assert.equals(normalized4.path, 'lib/jquery/jquery1.8.min', 'missing path');
			assert.equals(normalized4.specificity, 1, 'specificity');
		},
		'should not turn paths descriptors into packages': function () {
			refute(!!normalized4.main, 'added main property');
		}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));