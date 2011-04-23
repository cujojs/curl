# grab the output file
out=$1

# use all of the remaining parameters as files to be concatenated
shift

# concatenate all of the files to a temp file
cat $@ | sed -e "s:\/\*==::g" -e "s:==\*\/::g" > curl-temp.js

# compile them to the output file
./compile.sh curl-temp.js > $out

# remove the temporary concatenated file
rm curl-temp.js
