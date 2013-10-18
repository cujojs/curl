Configuring curl.js
===

There are two ways to configure curl.js.  The first method is useful for
specifying the configuration *before* curl.js is loaded.  The other is used
only after curl.js is loaded.

curl.js can now be configured multiple times.  Call `curl(myConfigObject)`
at any time to augment curl.js's configuration.  This can be useful for
mashup-type pages that consume modules from many sub-projects run by
disparate teams.

Note: configuring curl.js after a module has been loaded does not change the
configuration for that module.  Every module gets a snapshot of the
configuration at the time it's factory function executes.  Therefore,
CommonJS-wrapped modules that use `module.config()` will always get the same
configuration object no matter when `module.config()` is called.

Configuring curl.js before curl.js is loaded
---

To configure curl before it has been loaded, just declare a global variable
named `curl`:

```html
<script>
curl = {
	baseUrl: 'js',
	paths: {
		curl: 'curl-0.6/curl'
	}
};
</script>
<script src="js/curl-0.6/curl/src/curl.js"><script>
```

Configuring curl.js after curl.js is loaded
---

To configure curl after it has been loaded, pass the configuration
object to `curl()` when it is *first* used:

```html
<script src="js/curl-0.6/curl/src/curl.js"><script>
<script>
curl({
	baseUrl: 'js',
	paths: {
		curl: 'curl-0.6/curl'
	}
});
</script>
```

You may also load modules in the same call to `curl()`:

```html
<script src="js/curl-0.6/curl/src/curl.js"><script>
<script>
var cfg = {
	baseUrl: 'js',
	paths: {
		curl: 'curl-0.6/curl'
	}
}
curl(cfg, ['myapp/main']).then(function (main) {
	main.init();
});
</script>
```

There is also a `curl.config()` function to just configure curl:

```html
<script>
curl.config({
	baseUrl: 'js',
	paths: {
		curl: 'curl-0.6/curl'
	}
});
</script>
```

curl.js's common configuration options
---

curl.js has some common configuration options.  There are also plugin-specific
options that are described in the documentation for those plugins.

baseUrl: a string describing where the root of your javascript files resides.
If this is a relative path, it is relative to the page.

paths: a "hashmap" of path translations. See the [[Understanding Paths]] page
for more details.

packages: an array of package definitions.  For more information about packages,
see the [[Understanding Packages]] page.

plugins: a "hashmap" of plugin names to plugin configuation objects.  See the
[[Plugins]] page for details.

pluginPath: a string that points to the location of any plugin references
that don't have any path information already ("naked" plugins). See the
[[Plugins]] page for details.

preloads: an array of modules to load before any other modules.  This is a
good way to load shims or non-AMD modules that your modules may depend upon.

loader: (previously called "moduleLoader") a string specifying the
alternative (non-AMD) loader to use to load modules.  More info is at the
[[Loaders]] page.

dontAddFileExt: a RegExp (or string representation of a RegExp) that is used to
determine if the url of a module should have a .js extension added. If
the RegExp test returns true, the .js extension is *not* added.  The default
is to *not* add a .js extension if there's a ? in the url.  To never, ever
add the .js extension, provide `/./` or a blank string.  To always add the
.js extension, provide a single space (or other always-failing RegExp).

apiName: a string that specifies the name of curl.js's public object. By
default, this is "curl", so curl.js creates a global object: `window.curl`.
Some devs use this feature to rename `curl()` to `require()`, although this
is *not recommended* unless you absolutely require cross-loader global code
and **you have sufficient experience to recognize when you've created a
module that mistakenly omits a reference to a "local require"**.

apiContext: an object on which curl.js will create the public api. By default,
this is the global object (`window` in a browser, `global` in CommonJS).  This
feature is especially useful for namespacing `curl()`.

defineName: a string that renames AMD's global `define()` function.  This can
be handy for creating a third-party script or widget that may be placed on a
page that uses an AMD loader.  Note: until curl.js 0.8, your modules must use
the same name!  You can also use cram.js (or r.js?) to transform calls to
`define()` to your custom name.

defineContext: an object on which to place the AMD `define()` function.  Like
defineName, this is a vital feature for creating third-party scripts/widgets.

Configuring packages
---

curl.js can configure each package differently. See
[[Package-centric-Configuration]] for more information.
