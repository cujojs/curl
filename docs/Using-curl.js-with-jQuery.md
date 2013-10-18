As of jQuery 1.7.1, curl.js and jQuery get along great!

However, if you're not experienced with modular programming, there are a
few important things to know:

You must map the path to jquery.js when configuring curl.js.
---

jQuery registers itself as an *named module*.  curl.js (as well as
any other AMD loader) ensures that the correct module got loaded by comparing
the id of the requested module with the module that was actually loaded.  Since
jQuery registers itself with the name, "jquery", all modules that list
jQuery as a dependency must also refer to it by the exact same name.  Trying
to refer to jQuery as any of the following module ids will fail:

* "js/vendor/jQuery/jquery" *(BAD: path is included)*
* "jQuery" *(BAD: capitalization is different)*
* "jquery.1.7.1.min" *(BAD: extra filename bits)*

The best way to ensure all code can correctly refer to jQuery as "jquery", you
should add the following path mapping to curl.js's config:

	paths: {
		"jquery": "js/vendor/jQuery/jquery.1.7.1.min"
	}

Path mappings allow modules to find dependencies without knowing their exact
locations or file names.

Here's a full example:

	curl(
		{
			baseUrl: "myApp",
			paths: {
				"jquery": "../jQuery1.7.1/jquery.min"
			}
		},
		["jquery", "main"],
		function ($, main) {
			main.init();
			$('html').removeClass('loading');
		}
	);

`$` and `jQuery` are still available as global variables.
---

The jQuery folks decided to keep the global `$` and `jQuery` variables even if jQuery
is loaded as an AMD module.  This was probably done to help developers migrate
to modules.  However, it means that you'll still need to use `jQuery.noConflict()`
if your code maybe running in an environment in which multiple versions of
jQuery could exist or multiple libraries may try to claim the global `$`.

If your code -- or third-party code -- relies on the `$` or `jQuery` global
variables, they won't fail, but consider this "feature" to be a work-around.
You're also just delaying the inevitable anyways:

> The javascript community is embracing modules. Your global hackfest must come to an end.

The easiest way to convert your global hackfest to be module-ish is to
wrap each non-module file in a `define()` call:

	define(['jquery'], function ($) {
		// your not-very-modular code goes here
		// return something useful to code that depends on this code
	});

If you were already using the "module pattern" (which is only somewhat modular)
or were wrapping your code in closures in order to limit the leakage of
variables into the global scope, then your code will end up looking more like
this:

	(function (global) {

		// you can put code here that could run before the dom is ready

		define(['jquery'], function ($) {
			// most of your code goes here
			// return something useful!
		});

		// don't put code down here unless it is totally unrelated to
		// whatever you returned from the define(). dependent modules could be
		// executed before this code runs!

	}(this));

It's fairly easy to wrap most third-party plugins this way, too. However, most
jQuery plugin creators are planning to wrap their modules already.  Check with
your plugin creators to find out when they plan to support AMD and/or
compatible [UMD](https://github.com/umdjs) module formats.

curl.js does not prevent conflicts with third-party scripts that may load other versions of jQuery as an AMD module.
---

There is no equivalent to $.noConflict() when jQuery is loaded as an AMD module.
Whichever version is loaded *most recently* is the version that is used by your module.
