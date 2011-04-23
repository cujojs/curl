# make simple, compiled curl.js
./make.sh ../dist/curl/curl.js ../src/curl.js

# make other versions of curl
./make.sh ../dist/curl-with-js-and-domReady/curl.js ../src/curl.js ../src/curl/domReady.js ../src/curl/plugin/js.js
