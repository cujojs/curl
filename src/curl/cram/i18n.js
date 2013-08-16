/** MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl i18n! cram plugin
 */
define(['../plugin/i18n', '../plugin/locale'], function (i18n, getLocale) {

	var tos, stringifiers, beenThereFlag;

	tos = Object.prototype.toString;
	stringifiers = {
		Array: arrayAsString,
		Boolean: asString,
		Date: dateAsString,
		Function: asString,
		Null: nullAsString,
		Number: asString,
		Object: objectAsString,
		RegExp: asString,
		String: stringAsString,
		Undefined: undefinedAsString
	};
	beenThereFlag = '__cram_i18n_flag__';

	function bundleToString (thing) {
		return thingToString(thing);
	}

	bundleToString.compile = function (pluginId, resId, req, io, config) {
		var i18nId, localeId, locales, output, count, toId;
		
		config = config.plugins['curl/plugin/i18n'];
		i18nId = pluginId + '!' + resId;
		localeId = 'locale!' + resId;
		locales = config.locales || [];
		locales.push(''); // default bundle
		output = [];
		count = locales.length;
		toId = config['localeToModuleId'] || getLocale.toModuleId;

		// use the load method of the run-time plugin, capturing bundles.
		locales.forEach(function (locale, i) {
			var i18nIdLocale = i18nId;
			if (locale) i18nIdLocale += '/' + locale;
			
			loaded.error = stop;
			i18n.load(i18nIdLocale, req, loaded, config);

			function loaded (bundle) {
				// each bundle captured is output as a locale!id module, e.g.:
				// define("locale!foo/en-us", function () {
				//   return {/*...*/};
				// });
				output[i] = amdDefine(
					toId(localeId, locale), '', '', bundleToString(bundle)
				);
				if (--count == 0) done();
			}
		});

		if (!locales.length) done();

		function stop (ex) {
			count = 0; // prevents done() from executing
			io.error(ex);
		}

		function done () {
			// add the default i18n bundle module which uses the locale!
			// plugin to require() or fetch the correct bundle. e.g.
			// define("i18n!foo/en", ["locale!foo/en"], function (bundle) {
			//   return bundle;
			// });
			output.push(amdDefine(i18nId, [localeId], ['bundle'], 'bundle'));
			io.write(output.join(''));
		}

	};

	return bundleToString;

	function thingToString (thing) {
		var t, stringifier;

		t = type(thing);
		stringifier = stringifiers[t];

		if (!stringifier) throw new Error('Can\'t encode i18n item of type ' + t);

		return stringifier(thing);
	}

	function asString (thing) {
		return thing.toString();
	}

	function nullAsString () {
		return 'null';
	}

	function stringAsString (s) {
		return '"' + s + '"';
	}

	function undefinedAsString () {
		return 'undefined';
	}

	function dateAsString (date) {
		return 'new Date("' + date + '")';
	}

	function arrayAsString (arr) {
		var i, len, items, item;
		arr[beenThereFlag] = true;
		items = [];
		for (i = 0, len = arr.length; i < len; i++) {
			item = arr[i];
			if (typeof item == 'object' && beenThereFlag in item) {
				throw new Error('Recursive object graphs not supported in i18n bundles.');
			}
			items.push(thingToString(item));
		}
		delete arr[beenThereFlag];
		return '[' + items.join(',') + ']';
	}

	function objectAsString (obj) {
		var p, items, item;
		obj[beenThereFlag] = true;
		items = [];
		for (p in obj) {
			if (p != beenThereFlag) {
				item = obj[p];
				if (typeof item == 'object' && beenThereFlag in item) {
					throw new Error('Recursive object graphs not supported in i18n bundles.');
				}
				items.push('"' + p + '":' + thingToString(item));
			}
		}
		delete obj[beenThereFlag];
		return '{' + items.join(',') + '}';
	}

	function type (thing) {
		return tos.call(thing).slice(8, -1);
	}

	function amdDefine (id, deps, args, exports) {
		return 'define("' + id + '", '
			+ (deps && deps.length ? arrayAsString(deps) + ', ' : '')
			+ 'function (' + (args && args.join(',')) + ') {\nreturn '
			+ exports
			+ ';\n});\n';
	}

});
