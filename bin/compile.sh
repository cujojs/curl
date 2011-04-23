# run a file through google closure compiler
curl \
	--data-urlencode "js_code@$1" \
	-d compilation_level=ADVANCED_OPTIMIZATIONS \
	-d output_info=compiled_code \
	-d output_format=text \
	http://closure-compiler.appspot.com/compile
