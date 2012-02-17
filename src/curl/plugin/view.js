/**
 * view.js
 * curl view! plugin.
 *
 * @version 0.1
 * @author Denis Sikuler
 * @license MIT License (c) 2012 Copyright Denis Sikuler
 */
(function () {
"use strict";

/*
 * curl view! plugin
 * <p>
 * This plugin loads text/html file using text! plugin,
 * searches for &lt;link&gt; tags related to style sheets in the file content, 
 * removes them from the content and loads found CSS-files as dependencies.
 * The "refined" file content returned as resource value.
 * CSS-files can be loaded by css! (by default) or link! plugin.
 *
 * <p>
 * Configuration settings (name - type - can it be set in resource name? - description):
 * <ul>
 * <li>cssLoader - String - Yes - name of plugin ('css' or 'link') that should be used to load a CSS-file 
 *      when loader is not specified in resource name
 * <li>defaultExt - String - Yes - default file extension that is used if it is not specified in resource name
 * <li>filterTag - Function - No - function that should be used to determine whether a tag is useful 
 *      and defines a dependency or the tag should be simply deleted;
 *      the function should return true for a useful tag and false for a tag that should be deleted.
 * <li>parse - Function - No - function that should be used to parse the loaded text;
 *      the function takes two parameters: the text and the settings object;
 *      the function should return an object with the following fields:
 *      <ul>
 *      <li>resource - String - text after processing.
 *      <li>depList - Array - list of found dependencies.
 *      </ul>
 * <li>processTag - Function - No - function that should be used to process a tag found during parsing;
 *      the function takes 3 parameters: the tag text, the object representing tag attributes and 
 *      the settings object; the function should return an object with the following fields:
 *      <ul>
 *      <li>dependency - Array, String, null - a dependency or a list of dependencies
 *              that is corresponding to the tag.
 *      <li>text - String - a tag text after processing; the text will substitute for the original text.
 *      </ul>
 * </ul>
 * Some configuration settings can be defined in resource name in the following format:
 * name=value[;name=value...]
 *
 * <p>
 * Dependencies:
 * text, css and link plugins.
 *
 * <p>
 * Usage:
 * <pre><code>
 *      // loads some/folder/view.html
 *      define(['view!some/folder/view.html'], function(view) {...});
 *      
 *      // loads some/folder/view.html (assuming that 'html' is set as default extension)
 *      // and uses link plugin to load found CSS-files
 *      define(['view!some/folder/view!cssLoader=link'], function(view) {...});
 * </code></pre>
 *
 */


    var 
        // RegExp to extract tag attributes and their values
        attrRegExp = /(\w+)\s*=\s*("|')\s*(.*?)\s*\2/g,
        // RegExp to extract settings and their values
        settingRegExp = /(\w+)\s*=\s*(.*?)\s*(?:;|$)/g,
        // Default configuration
        defaultConfig = {
            cssLoader: "css",
            defaultExt: "html"
        },
        // Used to save settings of specific loading
        sLoadSettings;

    /**
     * Converts setting values to the appropriate type that is determined on data from default configuration.
     * 
     * @param {Object} settings
     *      Settings map to process. Keys are setting names, values - corresponding values.
     * @return {Object}
     *      Processed settings map.
     */
    function convertSettings(settings) {
        var defaultValues = defaultConfig,
            sName, sType, value;
        for (sName in settings) {
            if (sName in defaultValues) {
                sType = typeof defaultValues[sName];
                value = settings[sName];
                if (sType !== typeof value) {
                    switch (sType) {
                        case "number":
                            settings[sName] = Number(value);
                            break;
                        case "boolean":
                            settings[sName] = ! (value === "false" || value === 0);
                            break;
                    }
                }
            }
        }
        return settings;
    }

    /**
     * Extracts attributes and their values from tag's text.
     * 
     * @param {String} sTag
     *      Tag's text to process.
     * @return {Object}
     *      Attributes map. Keys are attribute names, values - corresponding values.
     */
    function extractAttributes(sTag) {
        var result = {},
            attr;
        while (attr = attrRegExp.exec(sTag)) {
            result[ attr[1] ] = attr[3];
        }
        return result;
    }

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
    function extractSettings(sConfig) {
        var result = {},
            setting;
        while (setting = settingRegExp.exec(sConfig)) {
            result[ setting[1] ] = setting[2];
        }
        return result;
    }

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
    function mix(destination) {
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

    /**
     * Determines whether a tag is useful and defines a dependency or the tag should be simply deleted.
     * 
     * @param {String} sTagText
     *      The entire tag's text (html) to process.
     * @param {Object} attrMap
     *      Represents tag attributes. Keys are attribute names, values - corresponding values.
     * @param {Object} settings
     *      Processing settings/configuration. See {@link #parse}.
     * @return {Boolean}
     *      <code>true</code> if the tag is useful, <code>false</code> if the tag should be deleted.
     */
    defaultConfig.filterTag = function(sTagText, attrMap, settings) {
        return attrMap.href && attrMap.rel && attrMap.rel.toLowerCase().indexOf("stylesheet") > -1;
    };

    /**
     * Processes a tag found during parsing and returns object that describes action
     * that should be taken upon this tag. 
     * 
     * @param {String} sTagText
     *      The entire tag's text (html) to process.
     * @param {Object} attrMap
     *      Represents tag attributes. Keys are attribute names, values - corresponding values.
     * @param {Object} settings
     *      Processing settings/configuration. See {@link #parse}.
     * @return {Object}
     *      Processing result. The object has the following fields (name - type - description):
     *      <ul>
     *      <li>dependency - Array, String, null - a dependency or a list of dependencies
     *              that is corresponding to the tag.
     *      <li>text - String - tag text after processing; will substitute for the original text
     *              in parsed resource; should be empty to delete the tag from resource.
     *      </ul>
     */
    defaultConfig.processTag = function(sTagText, attrMap, settings) {
        var result = {dependency: null, text: ""},
            sName;
        if (settings.filterTag(sTagText, attrMap, settings)) {
            sName = attrMap.href;
            result.dependency = sName.indexOf("css!") === 0 || sName.indexOf("link!") === 0
                                ? sName 
                                : settings.cssLoader + "!" + sName;
        }
        return result;
    };

    /**
     * Parses the given text and search for &lt;link&gt; tags that are related to CSS-files.
     * Found tags are removed from the text, extracted resource names form dependency list. 
     * 
     * @param {String} sText
     *      Text to process.
     * @param {Object} settings
     *      Processing settings/configuration. Besides settings the object contains 'api' field
     *      that represents the module API.
     * @return {Object}
     *      Parsing result. The object has the following fields (name - type - description):
     *      <ul>
     *      <li>resource - String - text after processing.
     *      <li>depList - Array - list of found dependencies.
     *      </ul>
     */
    defaultConfig.parse = function(sText, settings) {
        var sStart = "<link ",
            sEnd = ">",
            nI = sText.indexOf(sStart),
            nStartLen = sStart.length,
            nEndLen = sEnd.length,
            deps = [],
            nK, sTag, tagResult;
        while (nI > -1) {
            nK = sText.indexOf(sEnd, nI + nStartLen);
            if (nK > -1) {
                if (nK) {
                    nK += nEndLen;
                    sTag = sText.substring(nI, nK);
                    tagResult = settings.processTag(sTag, 
                                                    extractAttributes(
                                                        sTag.substring(nStartLen, sTag.length - nEndLen) ), 
                                                    settings);
                    if (tagResult) {
                        if (tagResult.dependency) {
                            if (typeof tagResult.dependency === "string") {
                                deps.push(tagResult.dependency);
                            }
                            else {
                                deps.push.apply(deps, tagResult.dependency);
                            }
                        }
                        if (tagResult.text !== sTag) {
                            sText = sText.substring(0, nI) + tagResult.text + sText.substring(nK);
                        }
                        else {
                            nI = nK;
                        }
                    }
                    else {
                        nI = nK;
                    }
                }
                else {
                    nI = nK + nEndLen;
                }
                nI = sText.indexOf(sStart, nI);
            }
            else {
                break;
            }
        }
        return {
            resource: sText,
            depList: deps
        };
    };
    
    define({
        
        // Auxiliary API
        
        'convertSettings': convertSettings,
        
        'extractAttributes': extractAttributes,
        
        'extractSettings': extractSettings,
        
        'mix': mix,
        
        'filterTag': defaultConfig.filterTag,
        
        'processTag': defaultConfig.processTag,
        
        'parse': defaultConfig.parse,
        
        // Plugin API

        'normalize': function(sResourceName, normalize, config) {
            // This function is called once before load.
            // So here we extract and save settings for later use.
            var nI = sResourceName.indexOf("!");
            sLoadSettings = nI > -1 ? sResourceName.substring(nI + 1) : null;
            return normalize( nI > -1 ? sResourceName.substring(0, nI) : sResourceName );
        },

        'load': function(sResourceName, require, callback, config) {
            var conf, settings;
            // Prepare operation settings
            if (sLoadSettings) {
                settings = convertSettings( extractSettings(sLoadSettings) );
                sLoadSettings = null;
            }
            conf = mix({}, defaultConfig, config, settings);
            conf.api = mix({}, this);
            // Load and parse resource
            require(["text!" + require.toUrl( require.nameWithExt(sResourceName, conf.defaultExt) ), "require"], 
                function(sText, req) {
                    var parseResult = conf.parse(sText, conf),
                        sText = (parseResult && typeof parseResult === "object" 
                                    ? parseResult.resource : parseResult);
                    
                    if (parseResult && parseResult.depList && parseResult.depList.length) {
                        req(parseResult.depList, function() {
                            callback(sText);
                        });
                    }
                    else {
                        callback(sText);
                    }
            });
        }

    });

})();
