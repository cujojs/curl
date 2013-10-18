AMD isn't the only javascript module standard.  For instance, CommonJS
defines it's own module specification.
[CommonJS Modules/1.1](http://wiki.commonjs.org/wiki/Modules/1.1)
is used in many server-side javascript envionments.

Rather than code every type of module standard into curl.js, we made it
easy to extend curl.js to support other formats.  Module loaders (or
just "loaders") are used to extend curl.js to understand the other
formats.

curl.js 0.8 comes with support for loaders for CommonJS Modules/1.1
(curl/loader/cjsm11) and legacy, non-modular scripts (curl/loader/legacy).
Loaders that perform other tasks are possible, too.  For instance,
a module loader to cache AMD modules in localStorage could be implemented.

Module loaders are specified by the "loader" property on a
package's configuration.  Here's a simple example:

```js
curl({
	packages: [
		{
			name: 'myNodeProj',
			// typical package config
			path: 'path/to/myNodeProj',
			lib: '.',
			main: 'main',
			// package-specific config
			config: { loader: 'curl/loader/cjsm11' }
		}
	]
});
```

Write your own Module Loader
===

So far, we've been able to reuse the same API as AMD [[Plugins]]
to implement module loaders.  Many module loaders should be implementable
this way.  Others may need to access more of the internals of curl.js.
Devs who need the internal API can request the curl/_privileged module
to gain access to curl.js's internals.  (Take a peek at the curl/debug
module for hints about how to use curl.js's internals.)

Experimental
===

Note: the curl/_privileged module is experimental at this point and is
likely to change.  Be sure to follow curl.js's dev branch closely if
you plan to write production code using curl.js's internal APIs.
