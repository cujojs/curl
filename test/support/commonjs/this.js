define(function (require, exports, module) {
"use strict";
	var messages = require('./folder/messages'),
		mod = require('./module');
	this.testMessage = messages.itWorks;
	this._module = module;
});
