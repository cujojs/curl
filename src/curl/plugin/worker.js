/** MIT License (c) copyright B Cavalier & J Hann */

/**
 * curl worker! plugin
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */
define(/*=='worker',==*/ function () {

	function nameWithExt (name, defaultExt) {
		return name.lastIndexOf('.') <= name.lastIndexOf('/') ?
			name + '.' + defaultExt : name;
	}

	return {

		'load': function (resourceId, require, callback, config) {
			var worker = new Worker(nameWithExt(require['toUrl'](resourceId), 'js'));
			callback(worker);
		}

	}

});
