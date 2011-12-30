/**
 @license (c) copyright 2011 unscriptable.com / John Hann
 */
/**
 * @experimental
 */
define(function () {


	// TODO: is this too restrictive? should we also search for async require()?
	var findRequiresRx, globalEval, myId;

	findRequiresRx = /require\s*\(\s*['"](\w+)['"]\s*\)/,

	// evaluate in global context.
	// see http://perfectionkills.com/global-eval-what-are-the-options/
	globalEval = eval;

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
	 * 	 module and collects them. If removeRequires is true, it also replaces
	 * 	 them with a unique variable name. All unique require()'d module ids
	 * 	 are assigned a unique variable name to be used in the define(deps)
	 * 	 that will be constructed to wrap the cjs module.
	 * @param source - source code of cjs module
	 * @param moduleIds - hashMap (object) to receive pairs of moduleId /
	 *   unique variable name
	 * @param removeRequires - if truthy, replaces all require() instances with
	 *   a unique variable
	 * @return - source code of cjs module, possibly with require()s replaced
	 */
	function parseDepModuleIds (source, moduleIds, removeRequires) {
		var index = 0;
		// fast parse
		source = source.replace(findRequiresRx, function (match, id) {
			if (!moduleIds[id]) {
				moduleIds[id] = nextId(index++);
				moduleIds.push(id);
			}
			return removeRequires ? moduleIds[id] : match;
		});
		return source;
	}

	function wrapSource (source, resourceId, moduleIds) {
		var depsString = '', argsList = [], argsString = '';
		if (moduleIds.length > 0) {
			depsString = ", '" + moduleIds.join("', '") + "'";
		}
		for (var i = 0, len = moduleIds.length; i < len; i++) {
			// pull out variable name from hashmap part of moduleIds
			argsList.push(moduleIds[moduleIds[i]]);
		}
		if (argsList.length > 0) {
			argsString = ', ' + argsList.join(', ');
		}
		return "define('" + resourceId + "'," +
			"['require','exports','module'" +
			depsString + "],function(require,exports,module" +
			argsString + "){" + source + "\n});\n";
	}

	function injectScript (source) {
		var doc = document, el = doc.createElement('script');
		el.appendChild(doc.createTextNode(source));
		doc.body.appendChild(el);
	}

	return {
		'load': function (resourceId, require, loaded, config) {
			// TODO: extract xhr from text! plugin and use that instead?
			require(['text!' + resourceId + '.js', curl/_privileged], function (source, priv) {
				var moduleMap = []; // array and hashmap

				// find (and replace?) dependencies
				//TODO: moduleMap = priv.core.extractCjsDeps(source);
				source = parseDepModuleIds(source, moduleMap, config.replaceRequires);

				// wrap source in a define
				source = wrapSource(source, resourceId, moduleMap);

				if (config.injectScript) {
					injectScript(source);
				}
				else {
					globalEval(source);
				}

				// call loaded when the module is defined. this will work, but
				// will cause infinite recursion so we need to catch that:
				require([resourceId], function (cjsModule) {
					loaded(cjsModule);
				})
			});
		}
	};

});
