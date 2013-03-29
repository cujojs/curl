(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, script;

	curl = require('curl');
	script = curl.get('curl/script');
	curl.restore();

	buster.testCase('script.extractDataAttrConfig', {
		'should get the data-curl-run attribute': function () {
			var input, output, getAttr, setAttr;

			// set up stubs
			getAttr = this.stub().returns('bundle,main');
			setAttr = this.stub();
			this.stub(script, 'findScript', function (predicate) {
					var el = {
						getAttribute: getAttr,
						setAttribute: setAttr
					};
					predicate(el);
					return el;
				}
			);

			input = {};
			output = script.extractDataAttrConfig(input);
			assert.equals('bundle,main', output.main, 'main was set');
			assert.calledOnce(getAttr);
			assert.alwaysCalledWith(getAttr, 'data-curl-run');
			assert.alwaysCalledWith(setAttr, 'data-curl-run', '');
		}
	});

	buster.testCase('script.findScript', {
		'// should should be tested somehow (uses document)': function () {}
	});

	buster.testCase('script.getCurrentModuleId', {
		'// should should be tested somehow (uses document)': function () {}
	});

	buster.testCase('script', {
		'// should be tested somehow (uses document)': function () {}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));