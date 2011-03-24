curl (CUjo Resource Loader)
=====================

version 0.3.1

TODO:

* i18n plugin
* finish core extensions (debug, commonjs, etc)
* commonjs extension: Modules 1.1 and packages
* start using markdown for this README

----------------------------------------

What is curl.js?
================

curl.js is a small, but very fast AMD-compliant asynchronous loader.
Current size: 4.5KB (2.1KB gzipped) using Google's Closure Compiler.

If you'd like to use curl.js for non-AMD modules, you'll want to  use the
version with the js! plugin built in.  You may also want to build-in the
domReady module.  The combined curl+js+domReady loader is still only
6.1KB (2.7KB gzipped).

What's new?
----------
* The API has changed a bit. The .ready() and .domReady() methods are gone,
  replaced by the domReady module.  See the "API at a glance" section.
* The domReady module now returns a promise. This makes the API a bit cleaner.
* The js! plugin has been moved out into it's own file and now supports
  the !wait suffix which will load, but not execute, the file until
  all previous non-AMD files are executed.

If you're already familiar with CommonJS AMD loaders, skip down to the section
"**How do I use curl.js?**"

----------------------------------------

Features at a glance:
=====================

* Loads CommonJS AMD-formatted javascript modules
* Loads non-AMD javascript files, too (via embedded plugin)
* Loads CSS files and text files (via plugins)
* Waits for dependencies (js, css, text, etc) before executing javascript
* Waits for domReady --OR-- waits for all dependencies and domReady
* Tested with Chrome, FF3+, Safari 3.2+, IE6-8, Opera 9.5+

----------------------------------------

API at a glance
===============

**"curl" and "require" are synonyms. You may use them interchangeably.**

	curl(['dep1', 'dep2', 'dep3' /* etc */], callback);
	require(['dep1', 'dep2', 'dep3' /* etc */], callback);

Loads dependencies and the executes callback.
['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files
callback: Function to receive modules or resources


	curl(['dep1', 'dep2', 'dep3' /* etc */])
		.then(callback, errorback);
	require(['dep1', 'dep2', 'dep3' /* etc */])
		.then(callback, errorback);

Promises-based API for executing callbacks.
['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files
callback: Function to receive modules or resources
errorback: Function to call if an exception occurred while loading


	curl(config, ['dep1', 'dep2', 'dep3' /* etc */], callback);
	require(config, ['dep1', 'dep2', 'dep3' /* etc */], callback);

Specify configuration options, load dependencies, and execute callback.
config: Object containing curl configuration options (paths, etc.)
['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files
callback: Function to receive modules or resources


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
callback: No parameters except the domReady object
errorback: Function to call if an exception occurred while loading


	curl(['domReady', 'js!nonAMD.js', 'js!another.js!wait']), function (domReady) {
		/* do something cool here */
	});

Executes the function when the non-AMD javascript files are loaded and
the dom is ready. The another.js file will wait for the nonAMD.js file
before executing.


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

Executes callbacks is stages using `.next(deps, callback)`.


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
['dep1', 'dep2', 'dep3']: Module names or plugin-prefixed resource files
definition: Function called to define the module
module: Any javascript object, function, constructor, or primitive
promise: Object compatible with CommonJS Promises/A. Useful for further
deferring resolution of the module.
name: String used to name a module (not necessary nor recommended)

----------------------------------------

Very Simple Example
===================

	<script>

		// configure curl
		curl = {
			paths: {
				cssx: 'cssx/src/cssx/',
				stuff: 'path/to/stuff/folder/
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

----------------------------------------

What is AMD?
============

Asynchronous Module Definition is the CommonJS proposed standard for
asynchronous loaders. It defines a simple API that developers can use to
write their javascript modules so that they may be loaded by any compliant
loader.

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

backdraft loader <http://http://bdframework.org/bdLoad>

The beauty of AMD loaders is their ability to remove the drudgery of manually
managing dependencies.  Since all dependencies are listed within the 
modules, the loader will ensure that everything is loaded into the browser -- 
and in the right order.

----------------------------------------

What makes curl different from other AMD loaders?
=================================================

curl.js is much smaller than other loaders. Less than 1/2 the size of the
others in the list above. It's able to achieve this via a Promises-based
design. (Promises are another CommonJS proposed standard.) curl also requires 
the use of AMD-compliant javascript files, rather than provide backwards
compatibility with non-AMD files. This eliminated dozens of lines of code.

curl.js will load non-AMD modules with a forthcoming plugin.

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

(When using CommonJS sync syntax `var res = require('resName');`, a promise
isn't returned since the resource is returned synchronously. duh)

----------------------------------------

Can curl.js work with non-AMD javascript files?
===============================================

Yes, but why would you?  Once you start using AMD, you'll never go back! :)

You may use non-AMD javascript files by specifying the js! plugin prefix
like this:

	require(
		[
			'js!plainOldJsFile1.js',
			'js!anotherPlainOldJsFile.js!wait'
		]
	).then(
		function () {
			/* do something with your plain, boring javascript files */
		},
		function () {
			/* do something if any fail to load */
		}
	);

The !wait suffix instructs curl.js to wait for previous scripts to execute
before executing. It downloads in parallel with the previous scripts, though,
unless you specify jsPrefetch:false in the config.  Be sure to have proper
cache headers set if you plan to use jsPrefetch:true or scripts will get
downloaded twice.

----------------------------------------

Can curl.js load non-javascript files?
=======================

Yes, curl.js follows the CommonJS Loader Plugin specification, so you can use
any compatible plugin. The following plugins are included:

js! -- loads non-AMD javascript files

text! -- loads text files

You can also load css files by using the AMD plugin at the following repo:
<https://github.com/unscriptable/cssx/blob/master/src/cssx/css.js>

The following plugins are planned:

i18n! -- loads text strings and other locale-specific constants

cssx! -- loads and automatically shims css files for older browsers

----------------------------------------

----------------------------------------

How are modules loaded?
=======================

TODO: overview, baseUrl, paths

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

TODO: step-by-step instructions

(take a look at the test files for some example code)

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
AsseMbler. cram will be ready by mid 2011, so use another build tool or a
custom shell script in the mean time.

----------------------------------------

Many thanks to Bryan Forbes (@bryanforbes) for helping to clean up my code and
for making cujo's domReady much more robust.
More about Bryan: <http://www.reigndropsfall.net/>

Kudos also to James Burke (@jrburke) who instigated the CommonJS AMD proposal
and paved the way to create AMD-style loaders.
More about James: <http://tagneto.blogspot.com/>

Shout out to Kris Zyp (@kriszyp) for excellent ideas and feedback and Kyle
Simpson (@getify) who is inarguably the godfather of javascript loading.
