curl.js configuration options
===

These configuration options are used by curl.js and/or cram.js and should not
be used for other purposes.  If you would like to use curl.js's configuration
mechanism to push configuration information into your application, you should
consider using a "namespace" object.  For instance, you could place all of
your configuration information under a config property called "myApp".

Options used by curl.js and cram.js
===

baseUrl
---

`baseUrl` is a string describing where the root of your javascript files resides.
If this is a relative path, it is relative to the page.

paths
---

`paths` is a "hashmap" of path translations. See the Understanding Paths page for
more details.

Note: `paths` is deprecated and soon will be replaced by a simpler `packages`
format.

packages
---

`packages` is an array of package definitions. For more information about
packages, see the Understanding Packages page.

plugins
---

`plugins` is a "hashmap" of plugin names to plugin configuation objects. See the
Plugins page for details.

Note: `plugins` is deprecated and may be removed in curl.js 1.0.

pluginPath
---

`pluginPath` is a string that points to the location of any plugin references
that don't have any path information already ("naked" plugins). See the Plugins
page for details.

preloads
---

`preloads` is an array of modules to load before any other modules. This is
a good way to load browser and language polyfills.

loader
---

`loader` (previously called "moduleLoader") is a string specifying the
alternative (non-AMD) loader to use to load modules. More info is at the
Loaders page.

dontAddFileExt
---

`dontAddFileExt` is a RegExp (or string representation of a RegExp) that is
used to determine if the url of a module should have a .js extension added. If
the RegExp test returns true, the .js extension is not added. The default is to
not add a .js extension if there's a ? in the url. To never add the .js
extension, provide /./ or a blank string. To always add the .js extension,
provide a single space (or other always-failing RegExp).

apiName
---

`apiName` is a string that specifies the name of curl.js's public object. By
default, this is "curl", so curl.js creates a global object: window.curl. Some
devs use this feature to rename curl() to require(), although this is not
recommended unless you absolutely require cross-loader global code and you
have sufficient experience to recognize when you've created a module that
mistakenly omits a reference to a "local require".  (Don't know what this
means?  Then don't rename "curl" to "require". :) )

apiContext
---

`apiContext` is an object on which curl.js will create the public api. By
default, this is the global object (window in a browser, global in CommonJS).
This feature is especially useful for namespacing curl().

defineName
---

`defineName` is a string that renames AMD's global define() function. This can
be handy for creating a third-party script or widget that may be placed on a
page that uses an AMD loader. Note: until curl.js 0.8, your modules must use the
same name! You can also use cram.js (or r.js?) to transform calls to define()
to your custom name.

defineContext
---

`defineContext` is an object on which to place the AMD define() function. Like
defineName, this is a vital feature for creating third-party scripts/widgets.

cram.js options
===

The following options are used by cram.js, not by curl.js.  These are included
here to help you avoid name conflicts when using curl.js's configuration
mechanism to configure your application.

Please see the cram.js documentation for the most recent list.

* `includes`
* `excludes`
* `scripts`
* `output`
* `appRoot`
