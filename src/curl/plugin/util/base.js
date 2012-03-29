/**
 * Basic utility functions.
 *
 * Licensed under the MIT License at:
 *      http://www.opensource.org/licenses/mit-license.php
 *
 */


define({
    
    /**
     * Adds extension to the given file name (path) if it is necessary.
     * 
     * @param {String} name
     *      File name to process.
     * @param {String} defaultExt
     *      The extension that will be added if the file name does not have any extension.
     * @return {String}
     *      Processed file name.
     */
    nameWithExt: function(name, defaultExt) {
        return defaultExt && name.lastIndexOf('.') <= name.lastIndexOf('/') ?
            name + '.' + defaultExt : name;
    }
    
});
