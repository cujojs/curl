#!/bin/sh
# grab the output file
out=$1
tmpfile=$(mktemp -t cram.XXXXXX)

# use all of the remaining parameters as files to be concatenated
shift

# concatenate all of the files to a temp file
cat $@ | sed -e "s:\/\*==::g" -e "s:==\*\/::g" > "$tmpfile"

# compile them to the output file
./compile.sh "$tmpfile" > "$out"

# remove the temporary concatenated file
rm "$tmpfile"
