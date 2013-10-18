The easiest way to bootstrap an application is via curl.js's `data-curl-run` HTML attribute.  There are two ways to utilize this feature.

Single-script bootstrapping
===

```html
<script src="lib/curl/src/curl.js" data-curl-run="run.js"></script>
```

When curl.js loads, it will scan the document to find the first script with the `data-curl-run` attribute.  It uses the value of the `data-curl-run` attribute to determine where to find the bootstrap script.  curl.js will load the bootstrap script immediately.  A typical bootstrap script might look like the following.

```js
(function () {

    curl.config({
        baseUrl: baseUrl,
        packages: {
            curl: { location: 'lib/curl/src/curl/' },
            app: { location: 'app', main: 'main' }
        },
        preloads: ['poly/es5']
    });

    curl(['app']).then(start, fail);

    function start(main) {
        // do something startup-ish
    }

    function fail(ex) {
        // show a meaningful error to the user.
    }

}());
```

Note: a boot script must call `curl()` or `curl.config()` at least once.  See [Caveats](#Caveats) below.

Dual-script bootstrapping
===

```html
<script src="//mycdn.com/curl-0.8.4/curl.js" async="false"></script>
<script data-curl-run src="run.js" async="false"></script>
```

In this scenario, since run.js script is included as a script element, it will be loaded and evaluated by the browser in the usual fashion.  The `data-curl-run` attribute is completely ignored by curl.js.  However, at build time, cram.js parses the HTML and finds the `data-curl-run` attribute to determine where the bootstrap script is.  cram.js then uses the information inside run.js to create a bundle.

The dual-script bootstrap method is great for serving curl.js from a CDN while hosting your application code on your own servers.


Single-script bootstrapping with fallback
===

During highly iterative development, you might decide to not bundle your modules into a single file (using cram.js, for instance).  You could let curl.js load the modules as needed from your local server.  While this is great for fast development, bundles are highly recommended for production environments.

This means that the bootstrap file during development is different than the bootstrap file in production.  The production bootstrap file will likely be embedded in a bundle alongside the modules of the application.  curl.js allows for two bootstrap files (dev and production) by comma-separating the names of the bootstrap files `data-curl-run`:

```html
<script src="lib/curl/src/curl.js" data-curl-run="bundle.js,run.js"></script>
```

The first file, bundle.js, is the *production file* -- a bundle of modules alongside the boot script -- and the second, run.js, is the un-bundled bootstrap file.  curl.js will attempt to load bundle.js first, and if that fails, will attempt to load run.js.

Therefore, at development time, you should expect to see a 404 error in the console since bundle.js won't exist.

Why `data-curl-run`?
===

So, why not use `data-main` like other AMD loaders?

curl.js looks for the HTML attribute `data-curl-run` rather than `data-main` for three important reasons:

1. RequireJS (and other AMD loaders) don't clean up `data-main` after using it.  Subsequent loaders on the page could accidentally use it again!
2. curl.js allows more than one run.js file to be specified in the attribute.  This feature is designed to allow you to quickly toggle between a standalone run.js and a bundle file without changing the HTML source.
3. The W3C highly recommends that `data-*` attributes be namespaced, so all curl-specific attributes should start with `data-curl-`.

Caveats
===

Note: due to the unfortunately ambiguous behavior of browsers, curl.js can't differentiate between 404 errors and syntax errors in the bundle.js file.  Keep this in mind when debugging `data-curl-run`.  No browser provides adequate information to a script's onerror handler.  Furthermore, Internet Explorer fires the onload handler instead of the onerror handler when a script 404s.

Because of Internet Explorer, curl.js uses other means to detect if the boot script successfully loaded and evaluated.  Specifically, curl detects if `curl()` or `curl.config()` has been called at least once.  The resulting caveat is that `data-curl-run` cannot be combined with boot strategies that involve calls to `curl()` or `curl.config()` outside of the boot script (in the HTML, for instance).
