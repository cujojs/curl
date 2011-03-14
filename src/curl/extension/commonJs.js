
//cjsProto.createDepList = function (ids) {
//	// this should be called on resources that are already known to be loaded
//	var deps = [],
//		i = 0,
//		id, r;
//	while ((id = ids[i++])) {
//		if (id === 'require') {
//			// supply a scoped require function, if requested
//			var self = this;
//			r = beget(global.require);
//			r.toUrl = function (relUrl) { return self.toUrl(relUrl); };
//		}
//		else if (id === ' exports') {
//			// supply a new exports object, if requested
//			if (deps.exports) throw new Error('"exports" may only be specified once. ' + id);
//			deps.push(deps.exports = {});
//		}
//		else {
//			r = resources[id].r;
//		}
//		deps.push(r);
//	}
//	return deps;
//};
//

//cjsProto.evalResource = function (deps, resource) {
//	var res = resource;
//	if (isFunction(res)) {
//		var params = this.createDepList(deps);
//		res = res.apply(null, params);
//		// pull out and return the exports, if using that variant of AMD
//		if (params.exports) {
//			res = params.exports;
//		}
//	}
//	return res;
//};
//
