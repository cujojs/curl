/*
 * stuff/two depends on stuff/one
 */
define(['stuff/one.js'], function (one) {
	return one + 1;
});
