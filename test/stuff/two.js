/*
 * stuff/two depends on stuff/one
 */
define(['stuff/one'], function (one) {
	return one + 1;
});
