/*
 * stuff/three depends on stuff/one and stuff/two
 */
define(['stuff/one', 'stuff/two'], function (one, two) {
	return one + two;
});
