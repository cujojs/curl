curl.js loves packages!

Each library and sub-project has it's own set of constraints.  Therefore,
curl.js allows each library or sub-project to specify it's own configuration
options.

To specify configuration options for a library or sub-project, first
define a package for it.  (A package doesn't have to be a formal thing.  It
doesn't need a package.json file or a main.js, for instance.  It's really
just a collection of related modules and an entry in curl's "packages"
configuration object.)

Once you've defined a package, use the config sub-object to define options
that are specific to that package.  Here's an example:

```js
// config:
{
	packages: [
		{
			name: 'pkgA',
			location: 'path/to/pkgA',
			main: 'main/main-module-file',
			// config options specific to pkgA
			config: {
				dontAddFileExt: '\\?|#'
			}
		},
		{
			name: 'pkgB',
			location: 'path/to/pkgB',
			main: 'main',
			// config options specific to pkgB
			config: {
				moduleLoader: 'curl/loader/cjsm11',
				injectScript: true
			}
		}
	]
}
```

Packages inherit configuration options from the global configuration so you
don't have to repeat them in the package-specific config object.

Each package's config object can be obtained by calling `module.config()`
from within a module.  Modules can gain a reference to the module object
by using the CommonJS-wrapped module format or by specifically requiring
the "module" dependency.

```js
// CommonJS-wrapped format:
define(function (require, exports, module) {
	var config = module.config();
	return {}; // export
});
```

```js
// AMD format:
define(['module'], function (module) {
	var config = module.config();
	return {}; // export
});
```

Note: using either of the above formats causes the module to be
"early exported".  This means that other modules will gain access to the
module before it is completely defined.
