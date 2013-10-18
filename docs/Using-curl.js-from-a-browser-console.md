Executing and defining curl.js modules from a browser console works just fine. This is handy, because it is a great way to demonstrate to colleagues how beautifully decoupled curl allows you to make your JavaScript.

To load and execute a module you have already defined, use the normal curl bootstrap syntax:

```js
curl(['components/lightbox'], function(lightbox){
	lightbox('hello');
});
```

If you want to create a module and execute it, make sure you specify a module id.  Since a console-defined module doesn't have a filename, an id is the only way curl can help other modules find it.

```js
define('newLightbox', // module id (this is the important bit)
	function () {
		function lightbox (displayString) {
    			alert(displayString);
		}
		return lightbox;
	}
);

curl(['newLightbox'], function(lightbox){
	lightbox('hello');
});
```

You can also dump curl's internals to the console, including the contents of the cache this way.  **IMPORTANT: The "curl/_privileged" module is not meant for public consumption and is likely to change, so _don't_ use it in your code.**

```js
void curl(["curl/_privileged"], console.log.bind(console));
```

The `void` is optional and simply stops the console from also printing the CurlApi object, which can be confusing if you're not expecting it.  If you just want to see what's in the cache, you can type a bit more:

```js
void curl("curl/_privileged", function (priv) { console.log(priv['cache']); });
```
