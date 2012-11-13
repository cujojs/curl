/** MIT License (c) copyright B Cavalier, J Hann, D Dotsenko */
/** @preserve curl jsonrpc! plugin
*/
/**
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 */

;define(/*=='jsonrpc',==*/ function () {

	var greeting = "JSONRPC plugin for CurlJS: "

	function xhr () {
		var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];
		if (typeof XMLHttpRequest !== "undefined") {
			// rewrite the getXhr method to always return the native implementation
			xhr = function () { return new XMLHttpRequest(); };
		} else {
			// keep trying progIds until we find the correct one, then rewrite the getXhr method
			// to always return that one.
			var noXhr = xhr = function () {
					throw new Error(greeting + "XMLHttpRequest not available");
				};
			while (progIds.length > 0 && xhr === noXhr) (function (id) {
				try {
					new ActiveXObject(id);
					xhr = function () { return new ActiveXObject(id); };
				}
				catch (ex) {}
			}(progIds.shift()));
		}
		return xhr();
	}

    function buildJsonRpcParts(method, params, successFn, errorFn) {
        var _id = (new Date()).getTime().toString(16) + Math.floor(Math.random() * 10000).toString(16)

        return {

	        'data': JSON.stringify({'id':_id,'method':method,'params':params})
	        , 'errorFn': errorFn
	        , 'successFn': function (obj) {
	            try {
	            	if (typeof obj === 'string') {
	            		obj = JSON.parse(obj)
	            	}
	                if (_id != obj.id) {
	                    throw new Error(greeting + "Incorrect ID element in the response JSON.")
	                }
	                if (obj.error) {
	                    errorFn(obj.error)
	                }
	                // if (!jsobj.result) {
	                //    throw "Returned Result element is empty"
	                successFn(obj.result);
	            } catch (ex) {
	                errorFn(ex.message)
	            }
	        }
        }
    }

	function fetchJSON(url, method, data, successFn, errorFn) {
		var parts = buildJsonRpcParts(
			// method
			method
			//params
			, data
			//success_call
			, successFn
			//error_call
			, errorFn
		)
		, x = xhr()

		x.open('POST', url, true)
		x.setRequestHeader(
			'Accept',
			'text/*, text/x-javascript, text/javascript, text/x-json, application/x-javascript, application/json'
		)
		x.setRequestHeader(
			'Pragma',
			'no-cache'
		)
		x.setRequestHeader(
			'Cache-Control',
			'no-cache'
		)
		x.setRequestHeader(
			'Content-Type',
			'application/json'
		)
		x.onreadystatechange = function (e) {
			if (x.readyState === 4) {
				if (x.status < 400) {
					parts.successFn(x.responseText)
				}
				else {
					parts.errorFn(new Error(greeting + 'Call to '+method+'@'+url+' failed with status: ' + x.statusText))
				}
			}
		}
		x.send(parts.data)
	}

	function error(ex) {
		throw ex
	}

	return {
		'dynamic': true
		, 'load': function (resourceName, req, callback, globalConfig, requestScpecificSettings) {
			// jsonrpc's requestScpecificSettings object can be JS Object, or JS Array
			// if JS Object, the following props are expected:
			//  'method' - {String} name of the JSONRPC method to call
			//  'arguments' (alias 'data') - {Object} - JS Object where key:value pairs are argument_name:value.
			// If JS Array, first item in line is method name, and second is arguments object.
			var errorFn = callback.reject || error
			, successFn = callback.resolve || callback
			, method = requestScpecificSettings['method'] || requestScpecificSettings[0]

			if (!method) {
				errorFn(new Error(greeting + "Call failed. 'method' property is required for settings object."))
			}

			fetchJSON(
				req['toUrl'](resourceName)
				, method
				, requestScpecificSettings['arguments'] || requestScpecificSettings['data'] || requestScpecificSettings[1]
				, successFn
				, errorFn
			)
		}
	}
});
