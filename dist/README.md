Distribution Files
==================

These are the "compiled" versions of curl.js.

Use curl/curl.js if you are only loading AMD-formatted javascript modules and
AMD loader plugins.

Use curl-with-js-and-domReady/curl.js if you wish to use non-AMD javascript
files and don't have an alternative domReady implementation handy.

You can build your own custom version of curl.js by using the `make.sh` script
in the /bin/ folder.  You must run it from the /bin/ folder.  Syntax:

	./make.sh destination/curl.js ../src/curl.js [files to concat into curl.js]

The following files can be concatenated into curl.js:

* ../src/curl/plugin/js.js (the js! plugin)
* ../src/curl/plugin/text.js (the text! plugin)
* ../src/curl/plugin/i18n.js (the i18n! plugin)
* ../src/curl/domReady.js (the domReady module)
* ../src/curl/dojo16Compat.js (the dojo 1.6 compatibility shim / module)
* Any other non-anonymous AMD module (cannot be anonymous!)
* Any non-AMD javascript file

Note: you will need a fairly recent version of `curl` (the unix utility, not
curl.js) to run `make.sh`.  Version 7.18 or later is fine.
