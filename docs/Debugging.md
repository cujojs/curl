You can use curl() from your browser's debugging console or from your server-side JavaScript engine's REPL (e.g. node.js, RingoJS).  Further instructions are here: [[Using curl.js from a browser console]].

curl.js also includes a debugging shim.  It must be loaded before the modules you wish to debug, of course, so you should use one of these three methods to load it:

### Via "preloads"

curl.js includes a "preloads" configuration parameter that ensures that certain modules are evaluated (but not necessarily loaded) before any others.  This is the simplest way to load the debug module, but may not load son enough for some issues since it loads in parallel.

```js
curl.config({ preloads: ["curl/debug"] });
curl(["app/main"]); // or whatever modules you would normally load
```

### Via the curl() API's `.next()`

The `.next()` method halts loading until the previous modules are completely loaded and evaluated.  (Note: the `.next()` is not recommended for most other use cases since it is not as performant as preloads.)

```js
curl(["curl/debug"]).next(["app/main"], function (main) { /* ... */ });
```

### Use the dist/debug version

As of curl.js 0.7.4, there is a pre-built debugging file at "curl/dist/debug/curl.js".  In this version, the debug shim is concatenated onto the end of the curl.js file, so it's always pre-loaded.

```html
<script src="lib/curl/dist/debug/curl.js"></script>
<script>
    curl(["app/main"]); // or whatever modules you would normally load
</script>
```
