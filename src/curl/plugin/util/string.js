/**
 * Useful functions to work with strings.
 *
 * Licensed under the MIT License at:
 *      http://www.opensource.org/licenses/mit-license.php
 *
 * @version 0.1
 * @author Denis Sikuler
 * @license MIT License (c) 2012 Copyright Denis Sikuler
 */


define([], function() {
"use strict";
    
    var 
        // RegExp to extract tag attributes and their values
        attrRegExp = /(\w+)\s*=\s*("|')\s*(.*?)\s*\2/g,
        // RegExp to extract settings and their values
        settingRegExp = /(\w+)\s*=\s*(.*?)\s*(?:;|$)/g;
    
    return {

        /**
         * Extracts attributes and their values from tag's text.
         * 
         * @param {String} sTag
         *      Tag's text to process.
         * @return {Object}
         *      Attributes map. Keys are attribute names, values - corresponding values.
         */
        extractAttributes: function(sTag) {
            var result = {},
                attr;
            while (attr = attrRegExp.exec(sTag)) {
                result[ attr[1] ] = attr[3];
            }
            return result;
        },
        
        /**
         * Extracts operation settings from configuration string.
         * The configuration string should have the following format:
         * name=value[;name=value...]
         * where <code>name</code> - a setting name, <code>value</code> - the setting value.
         * 
         * @param {String} sConfig
         *      Represents settings and their values.
         * @return {Object}
         *      Settings map. Keys are setting names, values - corresponding values.
         */
        extractSettings: function(sConfig) {
            var result = {},
                setting;
            while (setting = settingRegExp.exec(sConfig)) {
                result[ setting[1] ] = setting[2];
            }
            return result;
        }
        
    };
    
});
