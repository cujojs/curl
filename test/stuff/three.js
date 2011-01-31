/*
 * stuff/three depends on stuff/one and stuff/two
 */
define(['./one', './two', './zero'], function (one, two) {
	return one + two;
});
