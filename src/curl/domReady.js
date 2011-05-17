/**
 * curl domReady
 *
 * (c) copyright 2011, unscriptable.com / John Hann
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 * usage:
 *  require(['ModuleA'], function (ModuleA, domReady) {
 * 		var a = new ModuleA();
 * 		document.body.appendChild(a.domNode);
 * 	});
 *
 * HT to Bryan Forbes who wrote the initial domReady code:
 * http://www.reigndropsfall.net/
 *
 */
(function (global, doc) {

	var
		readyState = 'readyState',
		// keep these quoted so closure compiler doesn't squash them
		readyStates = { 'loaded': 1, /*'interactive': 1,*/ 'complete': 1 },
		callbacks = [],
		fixReadyState = typeof doc[readyState] != "string",
		// IE needs this cuz it won't stop setTimeout if it's already queued up
		completed = false,
		addEvent, remover, removers = [], pollerTO;

	function ready () {
		completed = true;
		clearTimeout(pollerTO);
		while (remover = removers.pop()) remover();
		if (fixReadyState) {
			doc[readyState] = "complete";
		}
		// callback all queued callbacks
		var cb;
		while ((cb = callbacks.shift())) {
			cb();
		}
	}

	function checkDOMReady (e) {
		if (!completed && readyStates[doc[readyState]]) {
			ready();
		}
	}

	function poller () {
		checkDOMReady();
		if (!completed) {
			pollerTO = setTimeout(poller, 30);
		}
	}

	// select the correct event listener function. all of our supported
	// browser will use one of these
	addEvent = ('addEventListener' in global) ?
		function (node, event) {
			node.addEventListener(event, checkDOMReady, false);
			return function () { node.removeEventListener(event, checkDOMReady, false); };
		} :
		function (node, event) {
			node.attachEvent('on' + event, checkDOMReady);
			return function () { node.detachEvent(event, checkDOMReady); };
		};

	if (doc[readyState] == "complete") {
		ready();
	}
	else {
		// add event listeners and collect remover functions
		removers = [
			addEvent(global, 'load'),
			addEvent(doc, 'readystatechange'),
			addEvent(global, 'DOMContentLoaded')
		];
		// additionally, poll for readystate
		pollerTO = setTimeout(poller, 30);
	}

	define(/*=='curl/domReady',==*/ function () {

		// this is simply a callback, but make it look like a promise
		function domReady (cb) {
			if (completed) cb(); else callbacks.push(cb);
		}
		domReady['then'] = domReady;
		domReady['amd'] = true;

		return domReady;

	});

}(this, document));
