/**
 * Useful functions to work with objects.
 *
 * Licensed under the MIT License at:
 *      http://www.opensource.org/licenses/mit-license.php
 *
 * @version 0.1
 * @author Denis Sikuler
 * @license MIT License (c) 2012 Copyright Denis Sikuler
 */


define({
    
    /**
     * Mix contents (fields and methods) of several objects.
     * 
     * @param {Object} destination
     *      Object that will accumulate contents of other objects.
     * @param {Object} [...]
     *      Object whose contents is copied.
     * @return {Object}
     *      Modified destination object.
     */
    mix: function(destination) {
        var nL = arguments.length, 
            nI, sKey, source;
        for (nI = 1; nI < nL; nI++) {
            source = arguments[nI];
            if (source != null && typeof source === "object") {
                for (sKey in source) {
                    destination[sKey] = source[sKey];
                }
            }
        }
        return destination;
    }
    
});
