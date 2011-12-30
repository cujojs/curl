define(function(){
	return {
		load: function(id, require, loaded){
			require([id], loaded);
		}
	};
});
