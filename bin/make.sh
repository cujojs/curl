#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# get optional optimization instruction
opt=$1
if [ "${opt:0:2}" = "--" ]; then
	opt=${opt:2}
	shift
else
	opt=ADVANCED_OPTIMIZATIONS
fi

# grab the output file
out=$1
tmpfile=$(mktemp -t cram.XXXXXX)

# use all of the remaining parameters as files to be concatenated
shift

echo "making $out"
echo "optimization level is $opt"

# concatenate all of the files to a temp file
cat $@ | sed -e "s:\/\*==::g" -e "s:==\*\/::g" > "$tmpfile"

# get version number
CURLJS_VERSION=$(sed -n "s|.*version.*\(['\"]\)\([^'\"]*\)\1.*|\2|p" < ../src/curl.js)

# prepend valid version number
if [ -z "${CURLJS_VERSION//[0-9.]/}" ] && ! [ -z "$CURLJS_VERSION" ]; then
	echo "/* version: ${CURLJS_VERSION} */" > "$out"
else
	echo "incorrect/missing version number (${CURLJS_VERSION})" >&2
	echo -n > "$out"
fi

if [ "$opt" = "NONE" ]; then
	# cat files to the output file
	cat "$tmpfile" >> "$out"
else
	# compile files to the output file
	"$DIR"/compile.sh "$tmpfile" "$opt" >> "$out"
fi

# remove the temporary concatenated file
rm "$tmpfile"

echo "created $out"
