(function() {

exports.node = {
	environment: 'node',
	rootPath: '../',
	tests: [
		'test/buster/**/*-test.js'
	]
};

exports.browser = {
	environment: 'browser',
	autoRun: false,
	rootPath: '../',
	resources: [
		//'**', ** is busted in buster
		'*.js'
	],
	libs: [
//		'test/curl-config.js',
//		'node_modules/curl/src/curl.js'
	],
	sources: [
		// loaded as resources
	],
	tests: [
		'test/buster/**/*-test.js',
		'test/run.js'
	]
};

})();