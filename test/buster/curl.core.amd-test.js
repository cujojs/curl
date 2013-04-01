(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, core, path, script, Deferred;

	curl = require('curl');
	core = curl.get('curl/core');
	path = curl.get('curl/path');
	script = curl.get('curl/script');
	Deferred = curl.get('curl/Deferred');

	buster.testCase('core.transformId', {
		'should call normalizeId': function () {
			var ctx = {};
			this.stub(core, 'normalizeId');
			core.transformId(ctx);
			assert.calledOnceWith(core.normalizeId, ctx);
		}
	});

	buster.testCase('core.normalizeId', {
		'should call reduceLeadingDots': function () {
			this.stub(path, 'reduceLeadingDots');
			core.normalizeId({ id: 'id', parentCtx: { id: 'pid' } });
			assert.calledOnceWith(path.reduceLeadingDots, 'id', 'pid');
		}
	});

	buster.testCase('core.resolveUrl', {
		'should use realm\'s idToUrl to resolve a url': function () {
			var fakeCtx = {
				id: 'fake',
				realm: { idToUrl: function (id) { return id; } }
			};
			assert.same('string', typeof core.resolveUrl(fakeCtx).url, 'adds a url property that is a string');
		}
	});

	buster.testCase('core.assignAmdProperties', {
		'should set arguments onto context': function () {
			var ctx, id, deps, factory, options;
			ctx = {};
			id = 'id';
			deps = [];
			factory = function () {};
			options = { isCjsWrapped: true };
			core.assignAmdProperties.apply(ctx, [id, deps, factory, options]);
			assert.same(ctx.id, id, 'id');
			assert.same(ctx.deps, deps, 'deps');
			assert.same(ctx.factory, factory, 'factory');
			assert.same(ctx.isCjsWrapped, options.isCjsWrapped, 'isCjsWrapped');
		}
	});

	var expectedArgs = [
		'id',
		['foo', 'bar'],
		function (require) { },
		{ isCjsWrapped: undefined, arity: 1 }
	];

	buster.testCase('core.fixDefineArgs', {
		'should normalize define(id, deps, factory)': function () {
			var args = expectedArgs.slice(0, 3),
				expected = expectedArgs.slice();
			assert.equals(core.fixDefineArgs(args), expected);
		},
		'should normalize define(id, deps, other)': function () {
			var args, results;
			args = expectedArgs.slice(0, 3);
			args[2] = {};
			results = core.fixDefineArgs(args);
			assert.equals(expectedArgs[0], results[0], 'id');
			assert.equals(expectedArgs[1], results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(deps, factory)': function () {
			var args, results;
			args = expectedArgs.slice(1, 3);
			results = core.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(expectedArgs[1], results[1], 'deps');
			assert.equals(expectedArgs[2], results[2], 'factory');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(1, results[3].arity, 'arity');
		},
		'should normalize define(deps, other)': function () {
			var args, results;
			args = expectedArgs.slice(1, 3);
			args[1] = {};
			results = core.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(expectedArgs[1], results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(id, factory)': function () {
			var args, results;
			// Note: this signature should trigger isCjsWrapped
			args = [expectedArgs[0], expectedArgs[2]];
			results = core.fixDefineArgs(args);
			assert.equals(expectedArgs[0], results[0], 'id');
			assert.equals(['require'], results[1], 'deps');
			assert.equals(expectedArgs[2], results[2], 'factory');
			assert.equals(true, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(1, results[3].arity, 'arity');
		},
		'should normalize define(id, other)': function () {
			var args, results;
			args = [expectedArgs[0], {}];
			results = core.fixDefineArgs(args);
			assert.equals(expectedArgs[0], results[0], 'id');
			assert.equals(undefined, results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(factory)': function () {
			var args, results;
			// Note: this signature should trigger isCjsWrapped
			args = [expectedArgs[2]];
			results = core.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(['require'], results[1], 'deps');
			assert.equals(expectedArgs[2], results[2], 'factory');
			assert.equals(true, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(1, results[3].arity, 'arity');
		},
		'should normalize define(other)': function () {
			var args, results;
			args = [{}];
			results = core.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(undefined, results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(array)': function () {
			var args, results;
			args = [[]];
			results = core.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(undefined, results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(string)': function () {
			var args, results;
			args = [''];
			results = core.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(undefined, results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		}
	});

	buster.testCase('core.parseAmdFactory', {
		'should not toString-and-parse non-cjs modules': function () {
			var ctx = {
				id: 'id',
				url: 'url',
				deps: [],
				factory: function () {}
			};
			ctx.factory.toString = this.stub().returns('');
			core.parseAmdFactory(ctx);
			refute.called(ctx.factory.toString, 'factory was toString()ed');
		},
		'should extract deps from cjs modules': function () {
			var ctx = {
				id: 'id',
				url: 'url',
				factory: function () {},
				isCjsWrapped: true
			};
			this.stub(core, 'extractCjsDeps').returns(['a', 'b']);
			core.parseAmdFactory(ctx);
			assert.equals(['a', 'b'], ctx.deps, 'extracted deps');
		},
		'should extract deps from cjs modules and merge onto existing deps': function () {
			var ctx = {
				id: 'id',
				url: 'url',
				factory: function () {},
				isCjsWrapped: true,
				deps: ['require', 'exports', 'module']
			}, expected = ctx.deps.concat(['a', 'b']);
			this.stub(core, 'extractCjsDeps').returns(['a', 'b']);
			core.parseAmdFactory(ctx);
			assert.equals(expected, ctx.deps, 'extracted deps');
		}
	});

	buster.testCase('core.defineAmdModule', {
		'setUp': function () {
			// ensure they start empty
			core.anonCache = undefined;
			core.errorCache = undefined;
			core.defineCache = {};
		},
		'tearDown': function () {
			// ensure they end empty
			core.anonCache = undefined;
			core.errorCache = undefined;
			core.defineCache = {};
		},
		'should put anon module args in anon cache': function () {
			this.stub(script, 'getCurrentModuleId');
			core.defineAmdModule(undefined, [], function () {}, {});
			refute(typeof core.anonCache == 'undefined', 'anon cache is not empty');
		},
		'should indicate an error if two anon defines in a row': function () {
			this.stub(script, 'getCurrentModuleId');
			core.defineAmdModule(undefined, [], function () {}, {});
			core.defineAmdModule(undefined, [], function () {}, {});
			assert(typeof core.errorCache != 'undefined', 'error cache is not empty');
		},
		'should attempt to find id in active scripts': function () {
			var stub = this.stub(script, 'getCurrentModuleId');
			core.defineAmdModule(undefined, [], function () {}, {});
			assert.called(stub);
		},
		'should put anon module in define cache if found id in active scripts': function () {
			var stub = this.stub(script, 'getCurrentModuleId').returns('id');
			core.defineAmdModule(undefined, [], function () {}, {});
			assert(typeof core.defineCache.id == 'object', 'is in cache');
		},
		'should put named module args in define cache': function () {
			this.stub(script, 'getCurrentModuleId');
			core.defineAmdModule('id', [], function () {}, {});
			assert(typeof core.defineCache.id == 'object', 'is in cache');
		}
	});

	buster.testCase('core.locateAmdModule', {
		'should return an already cached module': function () {
			var mctx, result;
			mctx = {
				id: 'id',
				realm: { cache: { } }
			};
			mctx.realm.cache['id'] = mctx;
			result = core.locateAmdModule(mctx);
			assert.same(mctx.id, result.id, 'returned same module');
		},
		'should remove, return, and apply args if module is in define cache': function () {
			var mctx, result;
			core.defineCache['id'] = ['id', [], function () {}, {}];
			mctx = {
				id: 'id',
				realm: { cache: { } }
			};
			this.stub(core, 'assignAmdProperties');
			result = core.locateAmdModule(mctx);
			assert.called(core.assignAmdProperties, 'called assigneAmdProperties');
			refute('id' in core.defineCache, 'removed module from define cache');
			assert.same(mctx.id, result.id);
		},
		'should resolve url if the module wasn\'t found': function () {
			var mctx, result;
			mctx = {
				id: 'id',
				realm: { cache: { } }
			};
			this.stub(core, 'resolveUrl').returns(mctx);
			result = core.locateAmdModule(mctx);
			assert.called(core.resolveUrl);
			assert.same(mctx.id, result.id);
		}
	});

	buster.testCase('core.fetchAmdModule', {
		'setUp': function () {
			// ensure they start empty
			core.anonCache = undefined;
			core.errorCache = undefined;
			core.defineCache = {};
		},
		'tearDown': function () {
			// ensure they end empty
			core.anonCache = undefined;
			core.errorCache = undefined;
			core.defineCache = {};
		},
		'should return mctx if it is already defined': function () {
			var result, ctx;
			ctx = 'foo';
			result = core.fetchAmdModule(ctx);
			assert.equals(ctx, result, 'returned non-ctx');
			ctx = { factory: function () {} };
			result = core.fetchAmdModule(ctx);
			assert.same(ctx, result, 'returned ctx with factory');
		},
		'should return promise if not already fetched': function () {
			var result;
			this.stub(script, 'load');
			this.stub(core, 'isModuleContext').returns(true);
			this.stub(core, 'assignDefines');
			result = core.fetchAmdModule({});
			assert.called(script.load);
			assert(Deferred.isPromise(result), 'returned a promise');
		}
	});

	buster.testCase('core.assignDefines', {
		'should return if module found in anon cache': function () {
			var result;
			this.stub(core, 'assignAmdProperties');
			core.anonCache = ['id', [], function () {}, {}];
			result = core.assignDefines({});
			assert(typeof result != 'undefined', 'returned');
		},
		'should return if module found in define cache': function () {
			var ctx, result;
			this.stub(core, 'assignAmdProperties');
			core.defineCache['id'] = ['id', [], function () {}, {}];
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			result = core.assignDefines(ctx);
			assert(typeof result != 'undefined', 'returned');
		},
		'should move all named modules to correct cache': function () {
			var ctx;
			this.stub(core, 'assignAmdProperties');
			core.anonCache = ['id', [], function () {}, {}];
			core.defineCache['id'] = ['id', [], function () {}, {}];
			core.defineCache['id2'] = ['id2', [], function () {}, {}];
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			core.assignDefines(ctx);
			assert('id' in ctx.realm.cache, 'found id in cache');
			assert('id2' in ctx.realm.cache, 'found id2 in cache');
		},
		'should clear define and anon caches': function () {
			var ctx;
			this.stub(core, 'assignAmdProperties');
			core.anonCache = ['id', [], function () {}, {}];
			core.defineCache['id'] = ['id', [], function () {}, {}];
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			core.assignDefines(ctx);
			assert.equals(core.defineCache, {}, 'define cache is clear');
			assert.equals(core.anonCache, undefined, 'anon cache is clear');
		},
		'should throw if module not found': function () {
			var ctx;
			this.stub(core, 'assignAmdProperties');
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			assert.exception(function () {
				core.assignDefines(ctx);
			});
		},
		'should throw if error cache is full': function () {
			var ctx;
			this.stub(core, 'assignAmdProperties');
			core.errorCache = 'an error happened';
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			assert.exception(function () {
				core.assignDefines(ctx);
			});
		}
	});

});
}(
	this.buster || require('buster'),
	typeof define == 'function' && define.amd
		? define
		: function (factory) { module.exports = factory(require); }
));