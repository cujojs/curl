Paths are a simple way to tell curl.js where to find your modules. Every dev
wants to structure her/his project by her/his own best practices.  We're not
going to try to force you to do it our way.  Since curl.js can't read your
mind, you must tell it where to find your modules.

Note: paths are not as configurable as packages.  Packages are the preferred
method to organize your code and to configure curl.js.  Paths, however, are
easy for smallish projects and may be a good choice for getting started
quickly.

Simple Paths
---

curl.js uses a configuration object called `paths` that acts like a
hash map.  The properties (a.k.a. keys) of the paths object are typically
module ids or package names.  The values are paths to the locations of
those modules or packages.

A typical paths config might look like this:

```js
var mycfg = {
	baseUrl: '/path/to/top/of/frontend/code',
	paths: {
		curl: 'awesome-oss/curl',
		my: 'my', // this isn't actually needed since it is a noop
		other: '../../other/third-party/js',
		'old-js-file.js': '../../other/third-party/js/someLegacyCode.js'
	}
};
```

In this scenario, curl.js will look for modules and other resources that start
with "curl", "my", and "other" in specific locations.  Examples:

* "curl/loader/cjsm11" -> "/path/to/top/of/frontend/code/awesome-oss/curl/loader/cjsm11"
* "my/app/controller" -> "/path/to/top/of/frontend/code/my/app/controller"
* "other/junk" -> "/path/to/top/of/other/third-party/js/other/junk"
* "old-js-file.js" -> "/path/to/top/of/other/third-party/js/somLegacyCode.js"

During url resolution, the property names (keys) in paths are matched to the
start of the module id being required.  If there's a match, the path information
is prepended.  If a baseUrl is also specified, it is prepended as well.

Complex Paths
---

Paths may be specified at multiple levels.  This can be quite handy for
telling curl.js that some modules -- or even whole folders of modules --
have been relocated.  Paths use specificity to determine precedence.
Paths that have more slashes ("/") are considered more specific and are used
instead of any paths that match with less slashes.  Here's an example:

```js
var mycfg = {
	baseUrl: 'app/code', // relative to current page!
	paths: {
		'my/otherapp': '../../otherapp/code',
		'my/otherapp/foo': 'my/foo'
	}
};
```

In this scenario, any modules that start with "my/otherapp" reside in a
completely separate folder tree (possibly in some reused folder).  For instance,
"my/otherapp/awesome" will be sought at "otherapp/code/awesome".

Also, we've instructed curl.js to NOT use the usual "my/otherapp/foo" module.
Instead, it will use the "my/foo" module.  It's important to note that if
"my/foo" uses relative ids to require dependencies, it will look
for them relative to where "my/foo" would have been *if we didn't relocate it*.
If you plan to relocate a module that has relative dependencies, consider
relocating those dependencies as well.  (Note: this behavior changed in
curl 0.6.3. Earlier versions looked for dependencies relative to the relocated
module.)

Absolute Paths
---

Paths are only used when an absolute url is not specified.  Typically, you don't
want to use absolute paths for modules.  However, absolute paths can
occasionally come in handy for plugin-based resources, such as css files.
For instance, you can specify a dependency on a remote stylesheet as follows:

```js
define(['css!//mycdn.com/path/to/stylesheets/dark.css'], function () {
	// do something stylish
});
```

(If a url starts with "//", it's a [protocol-relative url](http://paulirish.com/2010/the-protocol-relative-url/).
The "http:" or "https:" will be filled-in automatically by the browser.)

However, this situation would be better handled by removing the deep
knowledge from your module and moving it into the configuration:

```js
curl = {
	paths: {
		'themes': '//mycdn.com/path/to/stylesheets/'
	}
};
```

```js
define(['css!themes/dark.css'], function () {
	// do something stylish
});
```

Paths and Plugins
---

In curl.js 0.6 and higher, plugins have a special path syntax that allows
plugin-based resources to reside on a separate domain or in a parallel folder
within the same server.  The normal syntax for it is as follows:

```js
curl = {
	plugins: {
		css: {
			baseUrl: '//mycdn.com/base/path/for/all/stylesheets',
			paths: {
				layout: 'containers',
				theme: 'themes'
			}
		},
		text: {
			baseUrl: '//mycdn.com/base/path/for/all/templates',
			paths: {
				header: 'headers',
				footer: 'footers'
			}
		}
	}
};
```

However, there's a short-cut syntax for it that some people may prefer:

```js
curl = {
	paths: {
		'css!': '//mycdn.com/base/path/for/all/stylesheets', // baseUrl for css!
		'css!layout': 'containers',
		'css!theme': 'themes',
		'text!': '//mycdn.com/base/path/for/all/templates', // baseUrl for text!
		'text!header': 'headers',
		'text!body': 'layouts'
	}
};
```

The previous two syntaxes are equivalent and allow you to write modules that
look much saner (and are much more maintainable) than they would have
been otherwise:

```js
define(['text!body/three-column', 'css!layout/three-column', 'css!theme/dark'],
	function (template) {
		// make magic here
	}
);
```

You can also map a single plugin-loaded resource using paths:

```js
curl = {
	paths: {
		'legacy.js': 'path/to/legacy-v1.3.2/legacy.min.js'
	}
};

curl(['js!legacy.js'], function () { /* go time! */ });
```

When mapping paths to plugin-based resources (rather than to folders that
hold those resources), you *may or may not* include the file extensions.
If you include the file extension in the paths configuration, you must
include it wherever you reference the file or curl.js won't be able to
resolve it correctly.

```js
curl({
	paths: {
		// since the extension is provided here...
		"reset.css": "css/mobile/base.css"
	}
});
// (later, in another file)
// ...it's also needed here
define(["css!reset.css"], function (reset) {});
```

Note: you can't currently map an individual file and use the plugin's
per-resource options (e.g. "js!legacy.js!exports=myGlobalVar").

Id Resolution vs. Url Resolution
---

curl.js locates dependencies in two steps.  (It's actually a bit more
complicated when concerning plugins.  More on that later.)

1. Id resolution
2. Url resolution

Normalizing relative ids
===

The first step is to ensure that curl.js has a proper module id.  If a
module id begins with a dot, it's a relative id.  Relative ids are "normalized"
by reducing any leading dots.  The dots work similarly to those used in
operating systems.  Double dots indicate that the module id is relative to
the parent folder of the current module.  A single dot indicates that the
module id is relative to the same folder as the current module.  For instance:

```js
// mypackage/subpackage/mymodule:
define(["../othersub/othermodule", "./mytemplate"], function (other, tmpl) {});
```

In this snippet, `othermodule` resides in a sister folder to `mymodule`.
However, `mytemplate` resides in the same folder as `mymodule`.

The leading dots are reduced by reducing them into the current module's id.
`../othersub/othermodule` is reduced onto `mypackage/subpackage/mymodule`,
yielding `mypackage/othersub/othermodule`.  `./mytemplate` is reduced into
`mypackage/subpackage/mymodule` to give ``mypackage/subpackage/mytemplate`.

Note: specifying more double dots than there are slashes in the current
module's id causes curl.js to assume you are specifying a url, rather than a
module id.  You may cause double-downloads or duplicated modules if you use
urls instead of ids.

It's possible to specify a module id consisting only of dots ("..") or
only of dots and slashes ("../..").  These special cases indicate that there
is a module with the same name as a folder at that level.  For instance:

```js
// mypackage/subpackage/mymodule:
define(["../.."], function (mypackage) {});
```

The module specified by `../..` in this snippet will refer to a module called
"mypackage.js" that is a peer to the folder, "mypackage".

Transforming ids
===

Once we've reduced the leading dots, curl.js can perform *id transformations*.
Currently, curl.js knows how to perform two id transformations: plugin id
expansion and main module expansion.  curl.js uses plugin id expansion to allow
the developer to organize plugins in a sub-folder, but still refer to them
using common top-level notation.  For instance:

```js
define(["text!./mytemplate.html"], function (tmpl) {});
```

In this snippet, without plugin id transformation, curl.js would look for
the text! plugin module at the baseUrl folder.  However, curl.js keeps its
plugin modules in the `curl/plugin` folder.  The actual ids of the plugins
are configured via the "pluginPath" option (which will soon be renamed
"pluginPrefix" to avoid confusion with url transformations.)

The other id transform is for packages' main modules.  CommonJS (and by
extension, AMD) allows developers to refer to the primary module of a package
by simply specifying the name of the package.  For instance, [cujojs/wire](https://github.com/cujojs/wire)
has a main module that is also called "wire".  Rather than refer to the main
module as `wire/wire`, we refer to it as just `wire`.  curl.js uses the
package's configuration to determine what the actual id of the package is
and transforms it when the developer omits it.

curl.js uses the transformed id to track a module internally.

Resolving urls
===

Once a module's id has been resolved, curl.js must then find the url of the
module so it can fetch it, if necessary.  curl.js uses the paths and the
packages configuration information to determine the url.  As specified
earlier, paths and packages information are stored as key-value pairs.  The
keys are the module ids and the values are url paths.  (In the case of packages,
the _de facto_ AMD configuration format for specifying packages is as an array,
not a set of key-value pairs.  The name and location properties of each
configured package can be thought of as the key-value pair. curl.js
supports the standardized configuration format and translates internally
to an actual key-value pair.)

curl.js also keeps track of modules' urls in case the developer has specified
the same file using different module ids -- or a module id in one place and
a url in another.  This situation is highly likely to be caused by a
developer error, but there are actually a few valid use cases for doing this.
