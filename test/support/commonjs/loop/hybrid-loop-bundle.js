define('loop/hybrid-loop1', function (require, exports, module) {

	// implements multiply(), but delegates add() and subtract()
	var loop2 = require('./hybrid-loop2');
	var loop3 = require('./hybrid-loop3');
	exports.multiply = function (a, b) {
		return a * b;
	};
	exports.add = function (a, b) {
		return loop2.add(a, b);
	};
	exports.subtract = function (a, b) {
		return loop3.subtract(a, b);
	};

});

define('loop/hybrid-loop2', function (require, exports, module) {

	// implements add(), but delegates multiply() and subtract()
	var loop1 = require('./hybrid-loop1');
	var loop3 = require('./hybrid-loop3');
	exports.add = function (a, b) {
		return a + b;
	};
	exports.multiply = function (a, b) {
		return loop1.multiply(a, b);
	}
	exports.subtract = function (a, b) {
		return loop3.subtract(a, b);
	}

});

define('loop/hybrid-loop3', function (require, exports, module) {

	// implements subtract(), but delegates multiply() and add()
	var loop1 = require('./hybrid-loop1');
	var loop2 = require('./hybrid-loop2');
	exports.multiply = function (a, b) {
		return loop1.multiply(a, b);
	};
	exports.add = function (a, b) {
		return loop2.add(a, b);
	};
	exports.subtract = function (a, b) {
		return a - b;
	};

});

// classic AMD will force unraveling of exports
define('loop/hybrid-loop-bundle', ['loop/hybrid-loop1'], function (loop1) {
	return loop1;
});
