CommonJS defines its own module standard. Unfortunately, the
[CommonJS Modules/1.1](http://wiki.commonjs.org/wiki/Modules/1.1)
standard was designed for server-side environments and doesn't
support "legacy" javascript environments, such as those in browsers.

Not without help, at least.

Some frameworks, such as Ember, have built-in tools to "transport"
CommonJS Modules (CJS modules) to the browser.  AMD defines a method to do this,
as well.  Both of these methods are achieved by wrapping the CJS modules
with a function wrapper.  With AMD, the wrapper is simply a `define()` call
with a [specific signature](https://github.com/amdjs/amdjs-api/wiki/AMD).

Here's the AMD wrapper signature:

```js
define(function (require, exports, module) {
	// your CJS module goes here
	// use require('module-id') to require dependencies
	// use exports to expose methods and properties to other modules
});
```

The special pseudo-dependencies are injected into the module by curl.js.
These pseudo-dependencies mimic the "free variables" described in CJS.
The order of these three pseudo-dependencies (require, exports, module)
is critical, but not all of them must be specified.  (In general though,
just specify all three, if possible, for maximum compatibility with all
AMD environments.)

Node.js
---

A special exception is made for node.js modules.  Rather than use the
exports variable to expose methods and properties, devs can assign
their entire module to the module.exports property. This is a special
feature of curl.js and is useful for exporting functions, constructors,
or other modules that don't fit the strict CJS standard:

```js
define(function (require, exports, module) {
	function MyConstructor () {}
	MyConstructor.prototype = {
		someMethod: function () {}
	};
	module.exports = MyConstructor;
});
```

Hybrid
---

curl.js also allows hybrids of AMD and CJS modules by explicitly naming
the pseudo-dependencies like the following:

```js
define(['require', 'module', 'BaseObject'], function (require, module) {
	function MyConstructor () {}
	MyConstructor.prototype = Object.create(require('BaseObject'));
	module.exports = MyConstructor;
});
```

Note that "BaseObject" is explicitly included in the dependency list. curl.js
will *not* scan and find the r-value require `require('BaseObject')`
since the definition function doesn't meet the special signature as
described above.

Unwrapped CJS modules
---

curl.js 0.8 adds a feature to load CJS modules without
wrapping them.  If you specify `loader: 'curl/loader/cjsm11'` in the config
for a package, curl.js will assume that the entire package consists of
unwrapped CJS modules and will wrap them when they arrive at the browser.

This feature is perfect for rapid development in a dev environment, and
only works for modules loaded from the *same domain* because it uses XHR.

See [[Non-AMD-Loaders]] for more information about this feature.

CommonJS Gotchas
---

The biggest newb mistake when using CommonJS modules in the browser is
not realizing that CommonJS modules are "early exported".  This means that
when a module requires another module, the required module may not be fully
defined until **after both** factory functions have run.  This means you
may not write code that accesses properties or methods of another function
while a factory function executes.  You must access other modules only
inside functions that are executed by dependent modules.

```js
// bad:
define(function (require, exports) {
	var a = require('a);
	a.init(); // TypeError: doSomething may not exist yet!
	exports.foo = function () { return a.bar; };
});
```

```js
// good:
define(function (require, exports) {
	var a = require('a), init = false;
	exports.foo = function () {
		if (!init) { a.init(); init = true; }
		return a.bar;
	};
});
```
