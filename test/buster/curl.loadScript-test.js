(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, loadScript;

	curl = require('curl');
	loadScript = curl('curl/loadScript');

	buster.testCase('loadScript.extractDataAttrConfig', {
		'should get the data-curl-run attribute': function () {
			var input, output, getAttr, setAttr;

			// set up stubs
			getAttr = this.stub().returns('bundle,main');
			setAttr = this.stub();
			this.stub(loadScript, 'findScript', function (predicate) {
					var script = {
						getAttribute: getAttr,
						setAttribute: setAttr
					};
					predicate(script);
					return script;
				}
			);

			input = {};
			output = loadScript.extractDataAttrConfig(input);
			assert.equals('bundle,main', output.main, 'main was set');
			assert.calledOnce(getAttr);
			assert.alwaysCalledWith(getAttr, 'data-curl-run');
			assert.alwaysCalledWith(setAttr, 'data-curl-run', '');
		}
	});

	buster.testCase('loadScript.findScript', {
		'// should should be tested somehow (uses document)': function () {}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));