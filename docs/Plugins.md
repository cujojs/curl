The AMD specification allows loading of non-module javascript or other resources
such as html templates, css files, and json files.  It does this via plugins.
Plugin dependencies are delineated by an exclamation character ("!") as follows
(without the spaces):

`plugin-id ! resource-id`

"resource-id" typically looks very module-like and the loader will interpret it
as a module id (unless the plugin tells the loader it shouldn't).  Some typical
plugin references:

	text!mylib/page-template.html
	wire!mylib/page-spec.js // check out the awesome [wire.js](https://github.com/cujojs/wire)!
	link!mylib/css/reset.css
	css!http://ajax.googleapis.com/ajax/libs/dojo/1.6/dojo/resources/dojo.css

curl.js <3 plugins!
---

curl.js supports the AMD specification for plugins.  This means you can use any
compatible plugin module and use it with curl.js.  curl.js also comes with its
own collection of excellent plugins.  The following plugins are included with
curl.js 0.6 and more are *in the works*:

* **[[js!|js]]** - loads non-AMD javascript files (non-blocking!)
	- supports ordering of javascript files
	- can prefetch, but not execute a file for later execution
* **link!** - loads css files using a LINK element (non-blocking!)
	- ultra-fast and light
* **text!** - loads text files using XHR (non-blocking!)
	- for cross-domain text resouces, consider using JSON-P
* **domReady!** - waits for the dom to be ready for manipulation
	- there is also a "curl/domReady" module if you prefer to receive a callback directly
* **async!** - defers resolution of an AMD module that returns a promise
	- module does not have to be a true promise: any module that returns a `then(callback, errback)` method will work
* **css!** - a more flexible css loader
	- allows css to be built into javascript (when using cram)
	- avoids 31-stylesheet limit in IE6-8
	- waits for css files to be active before proceeding (option)

A very simple example of a module using plugins:

```javascript
define(
	['mylib/BaseView', 'text!mylib/CoolView.html', 'css!mylib/CoolView.css'],
	function (BaseView, template) {
		// This is our custom view controller, CoolView, that extends BaseView
		// It comes with it's own stylesheet (CoolView.css) and
		// template (CoolView.html).  Note: we don't need to include the
		// css resource in the function signature above if we don't
		// want to access it directly.
		function CoolView (domNode) {
			// attach our template to the view controller
			this.template = template;
			// call the inherited constructor
			BaseView.apply(this, domNode);
		}
	}
);
```

Plugins may also be used during the bootstrap phase of your web app:

```javascript
curl({ baseUrl: '/js/' })
	// load our non-module javascript and css
	.next(['js!libs/jQuery1.6/jQuery.js!order', 'js!libs/jQueryUI1.3/jQueryUI.js!order', 'link!css/screen.css'])
	// load our bootstrap module and wait for dom-ready
	.next(['mylib/boot', 'domReady!'], function (boot) {
		// go!
		boot.init();
	});
```

> Notice that the css and domReady dependencies aren't referenced in the callback
function.  This is typical with css resources and domReady.  It's unusual to
need a reference to a stylesheet. domReady! simply waits for the document
to be ready and then returns nothing (empty object).
Therefore, these can be safely omitted from the dependency list.

Plugin options
---

Some plugins have optional features.  These may be applied where the plugin
resource is defined or may be defined globally.  Global options are specified in
a "plugins" property of the curl config object as follows:

```javascript
curl({
	plugins: {
		// js! plugin global options
		js: {
			prefetch: false
		},
		// css! plugin global options
		css: {
			nowait: true
		}
	},
	baseUrl: '/path/to/myapp/'
});
```

Please refer to each plugin for information about its options.

Also, see the [[Undersanding Paths]] document for more information about
specifying special paths for plugin-based resources.

Build your own plugins!
---

It's incredibly easy to create your own plugins.  Depending on the complexity of
your plugin and whether you want it to build resources into the compiled
javascript files, you'll only need to implement up to 4 API methods.

TODO: page about creating plugins

Plugin namespacing
---

Plugins are just regular AMD modules that expose a handful of standard methods.
However, in the examples above, the plugins aren't namespaced even though
the plugins reside in curl's folder hierarchy at `curl/plugin/`.  So why
don't we have to reference plugins using their full namespace like in
the following `define()`?

```javascript
define(['curl/plugin/text!mylib/CoolView.html'], function (template) {});
```

This is because curl.js has a convenience config property, `pluginPath`, that
defaults to "curl/plugin/".  All "naked" plugins (un-namespaced) are assumed to
be located in the pluginPath folder.  Not only is this convenient, but it also
provides an implmentation-agnostic method for referencing plugins.

> Not all AMD loaders that support plugins will have a "pluginPath" config
property.  They should, however, have a way to support un-namespaced plugins.

You cannot mix the `pluginPath` property with plugins that reside at the
root of your application.  The reason for this restriction is that
modules at the top level of your application look "naked". curl.js will
assume that references to the top-level plugin should be prefixed with
`pluginPath`.

Therefore, if you create your own plugins (or use some from other sources)
and want to reference them "naked", you have several options:

1. place your plugin in the same folder as curl.js's plugins, or
2. change "pluginPath" to point at your plugins folder (and move curl.js's
plugins there if you use them), or
3. use the "paths" config property to translate plugin paths like this:

```javascript
curl({
	paths: {
		myplugin: 'mylib/plugins/myplugin'
	}
}, ['myplugin!path/to/cool/resource'], bootFunc);
```

4. place your plugins' modules at the root of your application (i.e. where
baseUrl points) and place a "noop" paths reference to them like this:

```javascript
curl({
	paths: {
		myplugin: 'myplugin' // noop
	}
}, ['myplugin!path/to/cool/resource'], bootFunc);
```
