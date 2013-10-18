The js! plugin
===

The js! plugin may be used to load non-AMD javascript.  Since non-modular
scripts rely on predefined global variables to be available before they
execute, this plugin assists in loading these scripts in order while still
loading them as fast as possible *in parallel and non-blocking*.

(AMD modules do not need to be explicitly loaded in order.  AMD module loaders,
such as curl.js, do automatic dependency management, ensuring that modules are
loaded in order.)

DO NOT USE THIS PLUGIN :)
---

The legacy loader is a much better way to load non-modular javascript files.
Please refer to [[Non AMD Loaders]] for more information.

js! plugin options
---

The js! plugin has two per-resource options:

* !order - forces evaluation of several scripts in the order listed
* !exports - ensures the js file loaded by testing for a globally available
  thing. This thing is returned to requesting modules.

!order option
---

Not all browsers have the facilities to order scripts.  Therefore, the js!
plugin has to use some of it's own tricks.  The standard way to order scripts is
via the `async="false"` attribute on the script element.  The js! plugin will
test for this feature and use it if it is supported.

If `async="false"` is not supported, the js! plugin inserts `type="text/cache"`
instead.  Almost all legacy browsers will still load this dummy script despite
not knowing what a "text/cache" script is (dumb, but true, only
Firefox 3.6 afaik won't load it).

As soon as the dummy script is loaded (but not executed since the browser
doesn't know how to execute "text/cache" scripts!), the script element is
deleted.  Meanwhile, a queue manager watches for all of the dummy scripts and
replaces them in order with a normal `type="text/javascript"` script element.
At this point, the script file is in the browser's cache (it was loaded by
the dummy script element) so the normal script element loads the script nearly
instantaneously.

This is called "prefetching".  Yes. It's trickery.  But it's fast and it works.

Turning off prefetching
---

Unless it doesn't work.  If you're astute (and I know you are since you're using
and/or investigating AMD!), you no doubt noticed that this trick relies on
something that is inherently unreliable: the browser's cache.

For most applications, the cache trickery will work great.  However, some devs
may not be in control of the server's http headers so they cannot assure they
are configured correctly.  Other devs could be concerned that the files may
be too large to be cached in mobile browsers.

Luckily, there's an option for those devs.  The js! plugin will look for a
`prefetch: false` config option.  If found, it will not use these tricks
when encountering the !order option.  Of course, this also means that the
ordered scripts will no longer load in parallel in legacy browsers, so they will
essentially behave the same as if they were static script elements in the HTML
(slow!). You can't have your cake and eat it too (unless all your users are on
modern browsers).

Exmaple usage of `prefetch: false`:

```javascript
curl({
	plugins: {
		js: {
			prefetch: false
		}
	}
});
```

!exports option
---

The !exports option is used to make a plain old javascript file look more like
a javascript module.  If the plain old javascript file declares a global
variable, you can name that global in the !exports option and it will be
returned to any requesting modules.

The !exports option has a second useful feature.  It can be used to ensure a js
file loaded.  Normally, IE6-8 and Opera (up to 12.1) don't execute an onerror
handler when a script file fails to load.  The !exports option helps ensure the
loader can catch the error condition, anyways.  If the !exports global doesn't
exist, the loader throws an exception.

Syntax:

	"js!myscript.js!exports=myapp.someObject.someProperty"

With the above option, the js! plugin will test that
`myapp.someObject.someProperty` exists at the global scope.  If it doesn't, it
will assume the script did not load and proceed to call any error callbacks
specified in any calls to `curl().then()`.

Note: the !exports option must be the last option in the resource-id!

Good:

```javascript
curl(['js!one.js!order!exports=$.one', 'js!two.js!order!exports=$.two'],
	function (one, two) {
		// one == $.one and two = $,two!
	}
);
```

Bad:

```javascript
// !order is after !exports
curl(['js!one.js!exports=$.one!order', 'js!two.js!exports=$.two!order'],
	function (fail1, fail2) {
		// moar fail
	}
);
```

