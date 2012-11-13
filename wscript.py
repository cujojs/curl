#! /usr/bin/env python
import re


def default(context):
    #    minifyfiles(context)
    pass

def turnIntoNamedModule(text):
    '''This removes /*== and ==*/ surrounding module names inside defines'''
    worker = lambda matchobj: 'define(' + re.search("(?<=define\(/\*==)\s*'\w+?'\s*,\s*(?===\*/)", matchobj.group(0)).group()
    return re.sub("define\(/\*==\s*'\w+?'\s*,\s*==\*/", worker, text)

def joinfiles(context):
    srcfolder = context.Node('src/')
    files = [
        'curl.js'
        , 'curl/plugin/jsonrpc.named.js'
        , 'curl/plugin/js.named.js'
        , 'curl/plugin/text.named.js'
        # , 'curl/plugin/css.named.js'
    ]

    text = ';'

    for name in files:
        if name.endswith('named.js'):
            text += turnIntoNamedModule((srcfolder + name - 'named.js' + 'js').text) + ';\n'
        else:
            text += (srcfolder + name).text

    context.Node('dist/curl.js').text = compress_with_closure_compiler( text ) #, 'ADVANCED_OPTIMIZATIONS' )

# def test(context):
#     src = context.Node('src/curl/plugin/jsonrpc.js')
#     out = src - '.js' + '.named.js'
#     out.text = turnIntoNamedModule(src.text)

def compress_with_closure_compiler(code, compression_level = None):
    '''Sends text of JavaScript code to Google's Closure Compiler API
    Returns text of compressed code.
    '''
    # script (with some modifications) from 
    # https://developers.google.com/closure/compiler/docs/api-tutorial1

    import httplib, urllib, sys

    compression_levels = [
        'WHITESPACE_ONLY'
        , 'SIMPLE_OPTIMIZATIONS'
        , 'ADVANCED_OPTIMIZATIONS'
    ]

    if compression_level not in compression_levels:
        compression_level = compression_levels[1] # simple optimizations

    # Define the parameters for the POST request and encode them in
    # a URL-safe format.
    params = urllib.urlencode([
        ('js_code', code)
        , ('compilation_level', compression_level)
        , ('output_format', 'json')
        , ('output_info', 'compiled_code')
        , ('output_info', 'warnings')
        , ('output_info', 'errors')
        , ('output_info', 'statistics')
        # , ('output_file_name', 'default.js')
        # , ('js_externs', 'javascript with externs') # only used on Advanced. 
      ])

    # Always use the following value for the Content-type header.
    headers = { "Content-type": "application/x-www-form-urlencoded" }
    conn = httplib.HTTPConnection('closure-compiler.appspot.com')
    conn.request('POST', '/compile', params, headers)
    response = conn.getresponse()

    if response.status != 200:
        raise Exception("Compilation server responded with non-OK status of " + str(response.status))

    compressedcode = response.read()
    conn.close()

    import json # needs python 2.6+ or simplejson module for earlier
    parts = json.loads(compressedcode)

    if 'errors' in parts:
        prettyerrors = ['\nCompilation Error:']
        for error in parts['errors']:
            prettyerrors.append(
                "\nln %s, ch %s, '%s' - %s" % (
                    error['lineno']
                    , error['charno']
                    , error['line']
                    , error['error']
                )
            )
        raise Exception(''.join(prettyerrors))

    return parts['compiledCode']

if __name__ == '__main__':
    print("This is a Wak build automation tool script. Please, get Wak on GitHub and run it against the folder containing this automation script.")