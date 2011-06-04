curl (Cujo Resource Loader)
=====================

version 0.4.3

What's New?

* Fixed !order option for js! plugin in non-Firefox browsers (0.4.3)
* Fixed the compiled version in 0.4.2 (dist/ folder)
* Several fixes to path and package mapping were made in 0.4.1
* CommonJS Modules 1.1
* CommonJS Packages 1.1
* dojo 1.6 support (dojo relies on non-standard RequireJS features)
* node.js support (when module is wrapped in a define())
* require(dep) as an RValue (needed or dojo and node)
* !noexec suffix for js! plugin (load, but don't execute)
* !wait suffix was renamed to !order (and semantics were changed)
* async=false

TODO:

* finish i18n plugin (eta: 2011-04-21)
* move the dojo 1.6 shim code into it's own module (dojo16Compat.js)
  (in progress)
* notes about using JSONP (it works for objects, arrays, functions, numbers
  and strings! use ?callback=define)
* use CommonJS file structure (lib/ instead of src/)

----------------------------------------

What is curl.js?
================

curl.js is a small, but very fast AMD-compliant asynchronous loader.
Size: 4.5KB (2.2KB gzipped) using Google's Closure Compiler.

If you'd like to use curl.js for non-AMD modules (ordinary javascript files),
you'll want to  use the version with the js! plugin built in.  You may also
want to build-in the domReady module.  The combined curl+js+domReady loader
is still only 6.0KB (2.7KB gzipped).

What the heck is "cujo"?  cujo.js is a web app development platform.
See the bottom of this file for more info.

----------------------------------------

Features at a glance:
=====================

* Loads CommonJS AMD-formatted javascript modules in parallel (fast!)
* Loads CommonJS Modules (v1.1 when wrapped in a `define()`) (fast!)
* Loads CommonJS Packages (v1.1 modules wrapped in a `define()`) (fast!)
* Loads non-AMD javascript files in parallel, too (fast! via js! plugin)
* Loads CSS files and text files in parallel (fast! via plugins)
* Waits for dependencies (js, css, text, etc) before executing javascript
* Waits for domReady, if/when desired
* Allows for virtually limitless combinations of files and dependencies
* Tested with Chrome, FF3+, Safari 3.2+, IE6-8, Opera 9.5+

Oh, did we mention?  It's fast!

----------------------------------------

API at a glance
===============

**Note: "curl" and "require" are synonyms. You may use them interchangeably.**

	curl(['dep1', 'dep2', 'dep3' /* etc */], callback);
	require(['dep1', 'dep2', 'dep3' /* etc */], callback);

Loads dependencies and the executes callback.

* ['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files
* callback: Function to receive modules or resources. This is where you'd
  typically start up your app.

---------
	curl(['dep1', 'dep2', 'dep3' /* etc */])
		.then(callback, errorback);
	require(['dep1', 'dep2', 'dep3' /* etc */])
		.then(callback, errorback);

Promises-based API for executing callbacks.

* ['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files
* callback: Function to receive modules or resources
* errorback: Function to call if an exception occurred while loading

---------
	curl(config, ['dep1', 'dep2', 'dep3' /* etc */], callback);
	require(config, ['dep1', 'dep2', 'dep3' /* etc */], callback);

Specify configuration options, load dependencies, and execute callback.

* config: Object containing curl configuration options (paths, etc.)
* ['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files
* callback: Function to receive modules or resources

---------
	curl(['domReady', 'dep2', 'dep3' /* etc */])
		.then(
			callback,
			errorback
		);
	curl(['dep1', 'dep2', 'domReady' /* etc */], function (dep1, dep2) {
		// do something here
	});

Executes the callback when the dom is ready for manipulation AND
all dependencies have loaded.

* callback: No parameters except the domReady object
* errorback: Function to call if an exception occurred while loading

---------
	curl(['domReady', 'js!nonAMD.js!order', 'js!another.js!order']), function (domReady) {
		/* do something cool here */
	});

Executes the function when the non-AMD javascript files are loaded and
the dom is ready. The another.js file will wait for the nonAMD.js file
before executing.

---------
	curl(['js!nonAMD.js'])
		.next(['dep1', 'dep2', 'dep3'], function (dep1, dep2, dep3) {
			// do something before the dom is ready
		})
		.next(['domReady'])
		.then(
			function () {
				// do something after the dom is ready
			},
			function (ex) {
				// show an error to the user
			}
		);

Executes callbacks in stages using `.next(deps, callback)`.

---------

	curl = {
		baseUrl: '/path/to/my/js',
		pluginPath: 'for/some/reason/plugins/r/here',
		paths: {
			curl: 'curl/src/curl',
			cssx: 'cssx/src/cssx'
			my: '../../my-lib/'
		},
		apiName: 'someOtherName'
	};

If called before the `<script>` that loads curl.js, configures curl.js.  All of
the configuration parameters are optional. curl.js tries to do something sensible
in their absence. :)

* baseUrl: the root folder to find all modules, default is the document's folder
* paths: a mapping of module paths to relative paths (from baseUrl)
* pluginPath: the place to find plugins when they are specified without a path
(e.g. "css!myCssFile" vs. "cssx/css!myCssFile") and there is no paths
mapping that applies.
* apiName: an alternate name to `curl` and `require` for curl.js's global
  variable

---------

	define(['dep1', 'dep2', 'dep3' /* etc */], definition);
	define(['dep1', 'dep2', 'dep3' /* etc */], module);
	define(['dep1', 'dep2', 'dep3' /* etc */], promise);
	define(module);
	define(promise);
	define(name, ['dep1', 'dep2', 'dep3' /* etc */], definition);
	define(name, ['dep1', 'dep2', 'dep3' /* etc */], module);
	define(name, ['dep1', 'dep2', 'dep3' /* etc */], promise);
	define(name, module);
	define(name, promise);

Defines a module per the CommonJS AMD proposed specification.

* ['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files.
Dependencies may be named 'require', 'exports', or 'module' and will behave
as defined in the CommonJS Modules 1.1 proposal.
* definition: Function called to define the module
* module: Any javascript object, function, constructor, or primitive
* promise: Object compatible with CommonJS Promises/A. Useful for further
deferring resolution of the module.
* name: String used to name a module (not necessary nor recommended)

----------------------------------------

Very Simple Example
===================

	<script>

		// configure curl
		curl = {
			paths: {
				cssx: 'cssx/src/cssx/',
				stuff: 'my/stuff/
			}
		};

	</script>
	<script src="../js/curl.js" type="text/javascript"></script>
	<script type="text/javascript">

		curl(
			// fetch all of these resources ("dependencies")
			[
				'stuff/three', // an AMD module
				'cssx/css!stuff/base', // a css file
				'i18n!stuff/nls/strings', // a translation file
				'text!stuff/template.html', // an html template
				'curl/domReady'
			]
		)
		// when they are loaded
		.then(
			// execute this callback, passing all dependencies as params
			function (three, link, strings, template) {
				var body = document.body;
				if (body) {
					body.appendChild(document.createTextNode('three == ' + three.toString() + ' '));
					body.appendChild(document.createElement('br'));
					body.appendChild(document.createTextNode(strings.hello));
					body.appendChild(document.createElement('div')).innerHTML = template;
				}
			},
			// execute this callback if there was a problem
			function (ex) {
				var msg = 'OH SNAP: ' + ex.message;
				alert(msg);
			}
		);

	</script>

The file structure for this example would look as follows:

	js/
		curl/
			plugin/
				i18n.js
				text.js
			domReady.js
		cssx/
			src/
				cssx/
					css.js
		my/
			stuff/
				nls/
					strings.js
				base.css
				template.html
				three.js
		curl.js

----------------------------------------

Diagnosing errors
===============================

curl.js throws five errors.  The first four are likely problems with your code, the latter is likely a problem within curl.js itself.  If you think you've discovered a bug in curl.js, please report it at [https://github.com/unscriptable/curl/issues/](https://github.com/unscriptable/curl/issues/).

"Syntax error or http error: http://some/file.js" or "define() not found in http://some/file.js"
----------

These errors are thrown when curl.js is unable to find a define() call to match the module that was requested.  Specifically, curl.js looks for either an anonymous define() -- a define without the initial name parameter and the preferred way to specify a module -- or a named module which has the same name as the one requested by the previous call to require() or define().

Check that you have exactly one anonymous define() in your module file (or are certain that there's a named define() that matches the requested module.  If you've verified this, it's likely you've got a syntax error in your module file.  Check your browser's console.  (Note: Firefox sometimes only logs syntax errors to it's internal console even if Firebug is running.  Be sure to check both.)

"Multiple anonymous defines found in http://some/file.js"
----------

It's impossible for curl.js to figure out which anonymous define() you want to match up with a request for your module file.  You should almost always be packaging exactly one module per file.  It's the job of a compiler/optimizer to combine modules into a single file (at which time, it will name them).  If you have an edge case which forces you to combine multiple modules into one file, then you, too, will have to name them.  

"Module is not already resolved: some/module"
----------

This can occur if you use the `var module = require("some/module");` version of the require() function and you haven't ensured that the module is pre-loaded.  curl.js will not synchronously load a module.  Therefore, you have to ensure that it is already loaded.  The best way to do this is to add the module to the list of dependencies in the define() call:

    define(['require', 'exports', 'module', 'some/module'], function (require, exports, module) {
        var module = require("some/module"); 
        // do something with module
    });

"Promise already completed."
----------

(curl.js should never throw this exception.  In our tests, we haven't seen this exception since before version 0.4.)

If you see this exception, it's an internal error of some sort.  However, it could have been initiated by your code.  Before throwing up your hands, first scroll up in your browser's error console(s) to see if it was caused by one of the other errors above and proceed to fix your code.  Please tell us if you see this error and -- as with any bug report -- provide a simple use case that can reproduce the bug so we can fix it.

----------------------------------------

What is an asynchronous loader?
===============================

Web apps, especially large ones, require many modules and resources. Most of
these modules and resources need to be loaded at page load, but some may be
loaded later, either in the background or "just in time". They also need to be
loaded as quickly as possible.

The traditional way to load javascript modules is via a `<SCRIPT>` element in
an HTML page. Similarly, CSS files are loaded via a `<LINK>` element, and
text resources are either loaded in the page or via XHR calls.

The problem with `<SCRIPT>` and `<LINK>` elements is that a browser must execute
them sequentially since it has no idea if one may depend on another. It just
assumes the developer has placed them in the correct order and that there are
dependencies. (The term "synchronous loading" is used to describe this process
since the elements are executed in a single timeline.)

If there are no dependencies between two files, loading them sequentially is
a waste of time. These files could be loaded and executed in parallel (i.e
at the same time).

An asynchronous loader does just that: it loads javascript files (and 
other types of files) in parallel whenever possible.

curl.js has lots of company. Other async loaders include LABjs, Steal.js,
yepnope.js, $script.js, the Backdraft loader (bdLoad), and RequireJS.

[(a more complete list)](https://spreadsheets.google.com/ccc?key=0Aqln2akPWiMIdERkY3J2OXdOUVJDTkNSQ2ZsV3hoWVE&hl=en#gid=2)

----------------------------------------

What is AMD?
============

Asynchronous Module Definition is the CommonJS proposed standard for
javascript modules that can be loaded by asynchronous loaders. It defines 
a simple API that developers can use to write their javascript modules so 
that they may be loaded by any AMD-compliant loader.

[CommonJS AMD Proposal](http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition)

The AMD proposal follows the [CommonJS Modules](http://wiki.commonjs.org/wiki/Modules/1.1)
proposal as much as possible.  Because of the way browsers load and
evaluate scripts, AMD can't follow it completely without causing significant
processing overhead.  Instead, AMD allows us to place a lightweight wrapper
around javascript modules to help work around the shortcomings.

Ultimately, both proposals (AMD and Modules 1.1) are in preparation for an
official [javascript modules](http://wiki.ecmascript.org/doku.php?id=harmony:modules)
specification and eventual implementation in browsers.

If you don't want to wait for official javascript modules, then don't.  The future 
is now.  AMD works now -- and it's awesome.

AMD's API focuses on two globally-available functions: require() and define().
require() specifies a list of dependent modules or resources that must be
loaded before running a set of code. This code resides in a callback function
that is executed asynchronously, i.e. it runs later, not in the current
"thread".  Specifically, it executes when all of the dependencies are loaded
and ready.  

Actually, the proposal says that the require() function could have a different 
name -- or could even be implemented differently.  To keep with convention -- 
and to better integrate with non-AMD CommonJS modules -- we're using
require(), but curl() is also an alias to require().

It's more important that the define() method be consistent.  This is the method
that tells the loader what modules have been loaded by a script. define() also
specifies a list of dependencies and a callback function that defines and/or
creates the resource when the dependencies are ready.  Optionally, define()
also takes a name parameter, but this is mainly for build tools and optimizers.

AMD's API also helps code reuse by providing compatibility with CommonJS
server modules. AMD-compliant loaders support the same require() syntax and
argument signatures as server-side javascript (ssjs) modules.

Not all async loaders are AMD-compliant. Of the list above, only the following
are AMD-compliant:

curl.js <http://github.com/unscriptable/curl>

RequireJS <http://requirejs.org/>

backdraft loader <http://bdframework.org/bdLoad>

The beauty of AMD loaders is their ability to remove the drudgery of manually
managing dependencies.  Since all dependencies are listed within the 
modules, the loader will ensure that everything is loaded into the browser -- 
and in the right order.

----------------------------------------

What makes curl different from other AMD loaders?
=================================================

curl.js is much smaller than other AMD loaders. Less than 1/2 the size of the
others in the list above. It's able to achieve this via a Promises-based
design. (Promises are another [CommonJS proposed standard](http://wiki.commonjs.org/wiki/Promises).)

curl.js communicates with it's plugins via Promises, rather than a simple
callback function. This allows proactive error handling, rather than detecting
problems via a timeout, which can be tricky to set correctly. curl does this in
a backwards-compatible way so AMD-compliant plugins will still work in curl.

curl.js will also return a promise from require() calls. This allows you to
write code like this:

	require(
		[
			'myApp/moduleA',
			'myApp/moduleB'
		],
	).then(
		function success (A, B) {
			// load myApp here!
		},
		function failure (ex) {
			alert('myApp didn't load. reason: ' + ex.message);
		}
	);

(When using `require` as a dependency, it does not return a promise.
This is so that 100% CommonJS compliance is assured inside modules.)

----------------------------------------

Can curl.js work with non-AMD javascript files?
===============================================

Yes, but why would you?  Once you start using AMD, you'll never go back! :)

You may use non-AMD javascript files by specifying the js! plugin prefix
like this:

	require(
		[
			'js!plainOldJsFile1.js!order',
			'js!anotherPlainOldJsFile.js!order'
		]
	).then(
		function () {
			/* do something with your plain, boring javascript files */
		},
		function () {
			/* do something if any fail to load */
		}
	);

The !order suffix instructs curl.js to wait for previous scripts to execute
before executing the current script. All scripts download in parallel, though,
unless you specify jsPrefetch:false in the config.  Be sure to have proper
cache headers set if you plan to use jsPrefetch:true or scripts will get
downloaded twice in browsers that don't support async=false (only Firefox 4
supports it so far).

----------------------------------------

Can curl.js load non-javascript files?
=======================

Yes, curl.js follows the CommonJS Loader Plugin specification, so you can use
any compatible plugin. The following plugins are included:

js! -- loads non-AMD javascript files

text! -- loads text files

You can also load css files by using the AMD plugin at the following repo:
<https://github.com/unscriptable/cssx/blob/master/src/cssx/css.js>

The following plugins are in progress:

i18n! -- loads text strings and other locale-specific constants

cssx! -- loads and automatically shims css files for older browsers

----------------------------------------

How are modules loaded?
=======================

curl.js uses `<script>` element injection rather than XHR.  This allows curl.js to
load cross-domain scripts as well as local scripts.  

To find scripts and other resources, curl uses module names.  A module name
looks just like a file path, but typically without the file extension.  If a
module requires a plugin in order to load correctly, it will have a prefix
delimited by a "!" and will also often have a file extension when a plugin
may load different types of files.

Some examples of module names:

* dojo/store/JsonRest
* my/lib/string/format
* js!my/lib/js/plain-old-js.js
* css!my/styles/reset.css
* http://some-cdn/uber/module

By default, curl.js will look in the same folder as the current document's location.
For instance, if your web page is located at `http://my-domain/apps/myApp.html`,
curl.js will look for the JsonRest module at `http://my-domain/apps/dojo/store/JsonRest.js`.

You can tell curl.js to find modules in other locations by specifying a baseUrl or 
individual paths for each of your libraries.  For example, if you specify a baseUrl of
`/resources/` and the following paths:

	paths: {
		dojo: "third-party/dojo",
		css: "third-party/cssx/css",
		my: "my-cool-app-v1.3",
		"my/lib/js": "old-js-libs"
	}

Then the modules listed above will be sought in the following locations:

* /resources/third-party/dojo/store/JsonRest.js
* /resources/my-cool-app-v1.3/lib/string/format.js
* /resources/old-js-libs/plain-old-js.js
* /resources/my-cool-app-v1.3/styles/reset.css
* http://some-cdn/uber/module.js

Note: you will need to create a path to curl's plugins and other modules if the
curl folder isn't directly under the same folder as your web page. curl.js uses
the same mechanism to find its own modules.

TODO: explain the pluginPath configuration parameter.

----------------------------------------

What are AMD plugins?
=====================

AMD supports the notion of plugins. Plugins are AMD modules that can be used to
load javascript modules -- or other types of resources. curl comes with several
plugins already, including a text plugin (for templates or other text
resources), a css plugin, a sync plugin (for loading modules synchronously),
and a debug plugin (for collecting and logging details of the inner workings of
curl).

Plugins are designated by a prefix on the name of the module or resource to be
loaded. They are delineated by a ! symbol. The following example shows the use
of some plugins:

	define(
		[
			'text!myTemplate.html',
			'css!myCssFile'
		],
		function (templateString, cssLinkNode) {
			// do something with the template and css here
		}
	);

Since plugins are just AMD modules, they would typically be referenced using
their fully-pathed names. curl provides a pluginPath configuration option that
allows you to specify the folder where [most of] your plugins reside so you
don't have to specify their full paths.  This also helps with compatibility
with other AMD loaders that assume that certain plugins are bundled and
internally mapped.

If one or more of your plugins does not reside in the folder specified by the
pluginPath config option, you can use its full path or you can specify a path
for it in curl's paths config object.

	// example of a fully-pathed plugin under the cssx folder
	define(['cssx/cssx!myCssFile'], function (cssxDef) {
		// do some awesome css stuff here
	});

(cssx is the Cujo Style Sheet eXtender AMD plugin that repairs browser css
deficiencies on-the-fly.)

Plugins can also have configuration options. Global options can be specified
on curl's configuration object. Options can also be supplied to plugins via
suffixes. Suffixes are also delineated by the ! symbol. Here's an example of
a plugin using options:

	// don't try to repair IE6-8 opacity issues in my css file
	define(['cssx/cssx!myCssFile!ignore:opacity'], function (cssxDef) {
		// do some awesome css stuff here
	});

----------------------------------------

How do I use curl.js?
=====================

1. Optional: Learn about AMD-formatted javascript modules if you don't already know how.
2. Clone or download curl to your local machine or server.
3. Figure out the baseUrl and paths configuration that makes sense for your project.
4. Check out the "API at a glance" section above to figure out which loading methodology you want to use.
5. Study the "Very Simple Example" and some of the test files.
6. Try it on your own files.

----------------------------------------

Too Many Modules!
=================

I have dozens (or hundreds) of modules. Even with parallel loading, the
performance sucks! What can I do about that?

True! No parallel loader can lessen the latency required to create an HTTP
connection. If you have dozens or hundreds of files to download, it's going to
take time to initiate each of the connections.

However, there are tools to that are designed to fix this problem! There are
builders and compilers. dojo users are probably already familiar with dojo's
build tool and optimizer. RequireJS comes with a build tool and Google's
Closure compiler.

The build tool is used to concatenate several modules (and/or resources)
into just a few files. It does this by following the dependency chain
specified in the define() and require() calls. You can specify which top-level
modules or resources are in each file and the build tool finds the rest.

After the build tool creates the concatenated files, the files can be passed
into a compiler (also called a shrinker or compressor).

We're writing curl to be compatible with RequireJS's build tool, but there's
also another cujo project in the pipeline: cram. Cram is the Cujo Resource
Assembler. cram will be ready by mid 2011, so use another build tool or a
custom shell script in the mean time.

----------------------------------------

CommonJS Package Support
========================

cujo.js supports the CommonJS Packages 1.1 specification.  Packages are
defined in the packages configuration parameter:

	cujo = {
		baseUrl: 'path/to/js',
		packages: {
			'my-package': {
				path: 'path/to/my-package',
				main: 'main/main-module-file',
				lib: 'location/of/other/modules'
			}
		}
	};

The path property describes where to find the package in relation to the
baseUrl parameter.  The main and lib properties describe where to find modules
inside the package.  The main property gives the relative path to the pacage's
main module.  The lib property reflects the path to all other modules in the
package.

The main module is always executed before any other modules are executed in
the package.  Essentially, the main module becomes an automatic dependency.

In the example above, the main module of the package can be obtained as follows

	require(['my-package'], callback);

and will be fetched from the following path:

path/to/js/path/to/my-package/main/main-module-file.js

Some other file in the package would be obtained as follows:

	require(['my-package/other-module'], callback);

and will be fetched from the following path:

path/to/js/path/to/my-package/location/of/other/modules/other-module.js

----------------------------------------

What is cujo?
=====================

cujo.js is a web app development platform.  It employs MVC, IOC, AMD
and lots of other TLAs. :)  curl.js is one of the many micro-libs we're pulling
out of cujo.js.  Our goal is to make the advanced concepts in cujo.js more
palatable by breaking them down into easier-to-grok chunks.  Other cujo.js
libs include:

[canhaz](https://github.com/briancavalier/canhaz): a project and code bootstrapping tool that will save you tons of typing.
[wire](https://github.com/briancavalier/wire): an application bootstrap, configuration, and assembly tool based on the principles of Inversion of Control, and Dependency Injection.
[cssx](https://github.com/unscriptable/cssx): library for extending css in older browsers
[cram](https://github.com/unscriptable/cram): a [forthcoming] javascript compressor, concatenator, and optimizer meant to be used with curl.js

Kudos
=================

Many thanks to Bryan Forbes ([@bryanforbes](http://www.twitter.com/bryanforbes)) for helping to clean up my code and
for making cujo's domReady much more robust.
More about Bryan: <http://www.reigndropsfall.net/>

Kudos also to James Burke ([@jrburke](http://www.twitter.com/jrburke)) who instigated the CommonJS AMD proposal
and paved the way to create AMD-style loaders.
More about James: <http://tagneto.blogspot.com/>

Shout out to Kris Zyp ([@kriszyp](http://www.twitter.com/kriszyp)) for excellent ideas and feedback and to Kyle
Simpson ([@getify](http://www.twitter.com/getify)) who is inarguably the godfather of javascript loading.
