/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

(function() {
define(function() {

	var defaultExtensions = {
		'.html': 'text',
		'.htm': 'text',
		'.txt': 'text',
		'.css': 'css',
		'.json': 'json',
		'.locale': 'i18n',
		'.locale.js': 'i18n'
	};

	return {
		'load': function(resourceId, require, loaded, config) {
			var type;

			if(config.extensions) {
				type = findType(resourceId, config.extensions);
			}

			if(!type) {
				type = findType(resourceId, defaultExtensions);
			}

			require([applyTransform(type, resourceId)], loaded, loaded.error);
		}
	};

	function applyTransform(type, id) {
		return type ? type + '!' + id : id;
	}

	function findType(resourceId, transforms) {
		var ext;

		for(ext in transforms) {
			if(resourceId.slice(-ext.length).toLowerCase() === ext) {
				return transforms[ext];
			}
		}
	}

});
}());