define(function () {

	return function configureAsserts (success, failure) {

		function assert (val, msg) {
			(val === true ? success : failure)(msg);
		}

		assert.equal = function equal (expected, val, msg) {
			if (val !== expected) {
				failure(msg + ' (expected: ' + expected + '. got: ' + val + ')');
			}
			else {
				success(msg);
			}
		};

		return assert;
	};

});