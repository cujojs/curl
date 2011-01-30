/*
 * stuff/three depends on stuff/one and stuff/two
 */
define(['stuff/one.js', 'stuff/two.js', 'stuff/zero.js'], function (one, two) {
	return one + two;
});
