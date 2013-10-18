Even though curl.js is ultra-fast at asynchronously downloading modules and
resources in parallel, it still works best when those modules and resources
are bundled together into a small set of files.  (Whether "small set"
means "one file" or "half a dozen" depends entirely on your application
and your environment.)

cram.js
---

curl.js has a companion project, [cram.js](https://github.com/cujojs/cram).
At its core, cram.js is a simple dependency walker.  You feed it a
"root module" (which could be your app's "main" module) and it walks
the dependency tree, collects all modules and resources, and concatenates
them into one file.

cram.js is still in early development.  We use it very successfully in a
few projects already, but it is still at least one rev away from being
production-worthy, imho.  In the mean time, please consider using James
Burke's r.js (see below).

cram.js only works with Rhino at the moment.  However, because of its DI
design and use of feature testing, it will be quite easy to make it work
with Node, Ringo, and Narwhal, as well as with modern browsers
(perform build from a url), wscript.exe on Windows, and
JavaScriptCore on Mac OS X (in conjunction with a shell script).

If you want to start experimenting with cram.js now, please use the
dev branch [here](https://github.com/cujojs/cram/tree/dev).

Note: cram.js will be released shortly! yay

r.js
---

curl.js can load optimized files built with r.js, the optimizer
for [RequireJS](https://github.com/jrburke/requirejs).  Please note,
however, that the AMD spec is still not solidified with regards to
optimizing plugin-based resources.  cram.js and r.js use different
approaches when working with plugins.  This means that you must use
RequireJS's plugins -- *not curl.js's plugins* -- when using r.js.
