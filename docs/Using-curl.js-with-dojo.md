dojo 1.6 was the first framework / toolkit to embrace AMD.  It's a tough job
to migrate thousands of modules.  As of dojo 1.7.1, they've got almost all
of them converted.  (Great job guys!)

However, there are still a few dojo-isms sprinkled throughout the code
that make trouble for other AMD loaders.  Examples: expectation of a
`<loader>.ready(callback)` method, special module ids ("." and ".."), and a
circular dependency using non-CommonJS-formatted modules.

curl.js supports the notion of *loader shims*.  These shims alter the
behavior of curl.js.  One such shim is "curl/shim/dojo16".  Despite
its name, it's needed for dojo 1.7.x, too.  There's also a shim for dojo 1.8+.

Using curl/shim/dojo18 or curl/shim/dojo16
===

There are two options for using the dojo shim: preload it or build it in.

Preloading curl/shim/dojo18
---

To preload it, use the `preloads` config property like this
*after* including curl.js with a script element:

```js
curl({
	baseUrl: 'path/to/js',
	packages: {
		dojo: { location: 'dojo-1.8.1/dojo' },
		dijit: { location 'dojo-1.8.1/dijit' }
	},
	preloads: [
		'curl/shim/dojo18'
	]
});
```

or this if you want to configure curl *before* loading curl.js with a script
element:

```js
curl = {
	baseUrl: 'blah/blah',
	packages: {
		dojo: { location: 'dojo-1.8.1/dojo' },
		dijit: { location 'dojo-1.8.1/dijit' }
	},
	preloads: [
		'curl/shim/dojo18'
	]
};
```

Always be sure to list dojo and dijit as packages, not paths!  Both dojo
and dijit use `main` modules.  curl.js does not look for `main` modules
when using paths.  It only looks for them when using packages.

Building curl/shim/dojo18 into curl.js
---

There's a custom version of curl.js in the "dist/curl-for-dojo1.8" folder.
This custom curl.js was built using the bin/make-all.sh script.

You can create your own custom builds of curl.js by using the make.sh script
in the bin folder.  Take a peek at the bin/make-all.sh script to see how to use
make.sh.  Also, take a look at the README.md in he dist folder for details.
