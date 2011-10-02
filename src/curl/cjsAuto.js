/**
 @license
 (c) copyright 2011 unscriptable.com / John Hann
 */
(function () {

	// TODO: is this too restrictive? should we also search for async require()?
	var findRequiresRx = /require\s*\(\s*['"](\w+)['"]\s*\)/;

	function nextId (index) {
		var varname = '', part;
		do {
			part = index % 26;
			varname += String.fromCharCode(part + 65);
			index -= part;
		}
		while (index > 0);
		return 'curl$' + varname;
	}

	/**
	 * @description Finds the require() instances in the source text of a cjs
	 * 	 module and collects them. If replaceRequires is true, it also replaces
	 * 	 them with a unique variable name. All unique require()'d module ids
	 * 	 are assigned a unique variable name to be used in the define(deps)
	 * 	 that will be constructed to wrap the cjs module.
	 * @param source - source code of cjs module
	 * @param moduleIds - hashMap (object) to receive pairs of moduleId /
	 *   unique variable name
	 * @param replaceRequires - if truthy, replaces all require() instances with
	 *   a unique variable
	 * @return - source code of cjs module, possibly with require()s replaced
	 */
	function parseDepModuleIds (source, moduleIds, replaceRequires) {
		var index = 0;
		// fast parse
		source = source.replace(findRequiresRx, function (match, id) {
			if (!moduleIds[id]) {
				moduleIds[id] = nextId(index++);
				moduleIds.push(id);
			}
			return replaceRequires ? moduleIds[id] : match;
		});
		return source;
	}

	function wrapSource (source, resourceId, moduleIds) {
		var depsString, argsList = [];
		depsString = "['" + moduleIds.join("','") + "']";
		for (var i = 0, len = moduleIds.length; i < len; i++) {
			// pull out variable name from hashmap part of moduleIds
			argsList.push(moduleIds[moduleIds[i]]);
		}
		return "define(" + resourceId +
			"['require', 'exports', 'module', '" +
			depsString + "'], function (require, exports, module, " +
			argsList.join(',') + ") {" + source + "})";
	}

	function injectScript (source) {
		var doc = document, el = doc.createElement('script');
		el.appendChild(doc.createTextNode(source));
		doc.body.appendChild(el);
	}

define({

	'load': function (resourceId, require, loaded, config) {
		// TODO: extract xhr from text! plugin and use that instead?
		require('text!' + resourceId, function (source) {
			var globalEval = eval, moduleMap = []; // array and hashmap
			// find (and replace?) dependencies
			source = parseDepModuleIds(source, moduleMap, config.replaceRequires);
			// wrap source in a define
			source = wrapSource(source, resourceId, moduleMap);
			// evaluate in global context.
			// see http://perfectionkills.com/global-eval-what-are-the-options/
			if (config.injectScript) {
				injectScript(source);
			}
			else {
				globalEval(source);
			}
			// don't call loaded since the injected define(id, deps, func)
			// will have resolved promise when it executed
		});
	}

});

}());

/*
define(<resourceId>, [<deps>], function (<args>) {
	<source>
});
 */
