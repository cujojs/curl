/**
 * Copyright (c) 2010 unscriptable.com
 */

(function (global) {
"use strict";

/*
 * curl link! plugin
 * This plugin will load css files as <link> elements.  It does not wait for
 * css file to finish loading or evaluating before executing dependent modules.
 * This plugin also does not handle IE's 31-stylesheet limit.
 * If you need any of the above behavior, use curl's css! plugin instead.
 *
 * All this plugin does is insert <link> elements in a non-blocking manner.
 *
 * usage:
 * 		// load myproj/comp.css and myproj/css2.css
 *      require(['link!myproj/comp,myproj/css2']);
 *      // load some/folder/file.css
 *      define(['css!some/folder/file'], {});
 *
 * Tested in:
 *      Firefox 1.5, 2.0, 3.0, 3.5, 3.6, and 4.0b6
 *      Safari 3.0.4, 3.2.1, 5.0
 *      Chrome 7+
 *      Opera 9.52, 10.63, and Opera 11.00
 *      IE 6, 7, and 8
 *      Netscape 7.2 (WTF? SRSLY!)
 * Does not work in Safari 2.x :(
*/


	var
		// compressibility shortcuts
		onreadystatechange = 'onreadystatechange',
		onload = 'onload',
		createElement = 'createElement',
		// doc will be undefined during a build
		doc = global.document,
		// find the head element and set it to it's standard property if nec.
		head;

	if (doc) {
		head = doc.head || (doc.head = doc.getElementsByTagName('head')[0]);
	}

/***** load-detection functions *****/

	function nameWithExt (name, defaultExt) {
		return name.lastIndexOf('.') <= name.lastIndexOf('/') ?
			name + '.' + defaultExt : name;
	}

/***** style element functions *****/

	function createLink (doc, optHref) {
		var link = doc[createElement]('link');
		link.rel = "stylesheet";
		link.type = "text/css";
		if (optHref) {
			link.href = optHref;
		}
		return link;
	}

	function createSheetProxy (sheet) {
		var insertRule, deleteRule;

		insertRule = function (text, index) {
			if (sheet.insertRule) {
				// W3C
				insertRule = function (text, index) {
					return sheet.insertRule(text, index);
				};
			}
			else {
				// IE
				insertRule = function (text, index) {
					var parts = text.split(/\{|\}/g);
					sheet.addRule(parts[0], parts[1], index);
					return index;
				};
			}
			return insertRule(text, index);
		};

		deleteRule = function (index) {
			if (sheet.deleteRule) {
				// W3C
				deleteRule = function (index) {
					return sheet.deleteRule(index);
				};
			}
			else {
				// IE
				deleteRule = function (index) {
					sheet.removeRule(index);
					return index;
				}
			}
			return deleteRule(index);
		};

		return {
			insertRule: insertRule,
			deleteRule: deleteRule,
			cssRules: function () {
				return sheet.cssRules || sheet.rules;
			},
			sheet: function () {
				return sheet;
			}
		};
	}

/***** finally! the actual plugin *****/

	define(/*=='link',==*/ {

		'load': function (resourceId, require, callback, config) {
			var resources, i;

			resources = (resourceId || '').split(",");

			for (i = resources.length - 1; i >= 0; i--) {
				var name, url, link;

				name = resources[i];
				url = require['toUrl'](nameWithExt(name, 'css'));
				link = createLink(doc);

				link.href = url;
				head.appendChild(link);

				callback(createSheetProxy(link.sheet || link.styleSheet));

			}

		}

	});

})(this);
