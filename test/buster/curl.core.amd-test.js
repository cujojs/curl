(function (buster, define) {

var assert, refute;

assert = buster.assert;
refute = buster.refute;

define(function (require) {

	var curl, core, amd, path, script, Deferred;

	curl = require('curl');
	core = curl.get('curl/core');
	amd = curl.get('curl/amd');
	path = curl.get('curl/path');
	script = curl.get('curl/script');
	Deferred = curl.get('curl/Deferred');

	buster.testCase('amd.transformId', {
		'should call reduceLeadingDots': function () {
			this.stub(path, 'reduceLeadingDots');
			amd.transformId({ id: 'id', parentCtx: { id: 'pid' } });
			assert.calledOnceWith(path.reduceLeadingDots, 'id', 'pid');
		}
	});

	buster.testCase('core.resolveUrl', {
		'//TODO move this to correct place: should use realm\'s idToUrl to resolve a url': function () {
			var fakeCtx = {
				id: 'fake',
				realm: { idToUrl: function (id) { return id; } }
			};
			assert.same('string', typeof core.resolveUrl(fakeCtx).url, 'adds a url property that is a string');
		}
	});

	buster.testCase('amd.applyArguments', {
		'should set arguments onto context': function () {
			var ctx, id, deps, factory, options;
			ctx = {};
			id = 'id';
			deps = [];
			factory = function () {};
			options = { isCjsWrapped: true };
			amd.applyArguments.apply(ctx, [id, deps, factory, options]);
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

	buster.testCase('amd.fixDefineArgs', {
		'should normalize define(id, deps, factory)': function () {
			var args = expectedArgs.slice(0, 3),
				expected = expectedArgs.slice();
			assert.equals(amd.fixDefineArgs(args), expected);
		},
		'should normalize define(id, deps, other)': function () {
			var args, results;
			args = expectedArgs.slice(0, 3);
			args[2] = {};
			results = amd.fixDefineArgs(args);
			assert.equals(expectedArgs[0], results[0], 'id');
			assert.equals(expectedArgs[1], results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(deps, factory)': function () {
			var args, results;
			args = expectedArgs.slice(1, 3);
			results = amd.fixDefineArgs(args);
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
			results = amd.fixDefineArgs(args);
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
			results = amd.fixDefineArgs(args);
			assert.equals(expectedArgs[0], results[0], 'id');
			assert.equals(['require'], results[1], 'deps');
			assert.equals(expectedArgs[2], results[2], 'factory');
			assert.equals(true, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(1, results[3].arity, 'arity');
		},
		'should normalize define(id, other)': function () {
			var args, results;
			args = [expectedArgs[0], {}];
			results = amd.fixDefineArgs(args);
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
			results = amd.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(['require'], results[1], 'deps');
			assert.equals(expectedArgs[2], results[2], 'factory');
			assert.equals(true, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(1, results[3].arity, 'arity');
		},
		'should normalize define(other)': function () {
			var args, results;
			args = [{}];
			results = amd.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(undefined, results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(array)': function () {
			var args, results;
			args = [[]];
			results = amd.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(undefined, results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		},
		'should normalize define(string)': function () {
			var args, results;
			args = [''];
			results = amd.fixDefineArgs(args);
			assert.equals(undefined, results[0], 'id');
			assert.equals(undefined, results[1], 'deps');
			assert.equals('function', typeof results[2], 'convert to factory function');
			assert.equals(undefined, results[3].isCjsWrapped, 'isCjsWrapped');
			assert.equals(-1, results[3].arity, 'arity');
		}
	});

	buster.testCase('amd.parseFactory', {
		'should not toString-and-parse non-cjs modules': function () {
			var ctx = {
				id: 'id',
				url: 'url',
				deps: [],
				factory: function () {}
			};
			ctx.factory.toString = this.stub().returns('');
			amd.parseFactory(ctx);
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
			amd.parseFactory(ctx);
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
			amd.parseFactory(ctx);
			assert.equals(expected, ctx.deps, 'extracted deps');
		}
	});

	buster.testCase('amd.defineModule', {
		'setUp': function () {
			// ensure they start empty
			amd.anonCache = undefined;
			amd.errorCache = undefined;
			amd.defineCache = {};
		},
		'tearDown': function () {
			// ensure they end empty
			amd.anonCache = undefined;
			amd.errorCache = undefined;
			amd.defineCache = {};
		},
		'should put anon module args in anon cache': function () {
			this.stub(script, 'getCurrentModuleId');
			amd.defineModule(undefined, [], function () {}, {});
			refute(typeof amd.anonCache == 'undefined', 'anon cache is not empty');
		},
		'should indicate an error if two anon defines in a row': function () {
			this.stub(script, 'getCurrentModuleId');
			amd.defineModule(undefined, [], function () {}, {});
			amd.defineModule(undefined, [], function () {}, {});
			assert(typeof amd.errorCache != 'undefined', 'error cache is not empty');
		},
		'should attempt to find id in active scripts': function () {
			var stub = this.stub(script, 'getCurrentModuleId');
			amd.defineModule(undefined, [], function () {}, {});
			assert.called(stub);
		},
		'should put anon module in define cache if found id in active scripts': function () {
			var stub = this.stub(script, 'getCurrentModuleId').returns('id');
			amd.defineModule(undefined, [], function () {}, {});
			assert(typeof amd.defineCache.id == 'object', 'is in cache');
		},
		'should put named module args in define cache': function () {
			this.stub(script, 'getCurrentModuleId');
			amd.defineModule('id', [], function () {}, {});
			assert(typeof amd.defineCache.id == 'object', 'is in cache');
		}
	});

	buster.testCase('amd.locateModule', {
		'should return an already cached module': function () {
			var mctx, result;
			mctx = {
				id: 'id',
				realm: { cache: { } }
			};
			mctx.realm.cache['id'] = mctx;
			result = amd.locateModule(mctx);
			assert.same(mctx.id, result.id, 'returned same module');
		},
		'should remove, return, and apply args if module is in define cache': function () {
			var mctx, result;
			amd.defineCache['id'] = ['id', [], function () {}, {}];
			mctx = {
				id: 'id',
				realm: { cache: { } }
			};
			this.stub(amd, 'applyArguments');
			result = amd.locateModule(mctx);
			assert.called(amd.applyArguments, 'called assigneAmdProperties');
			refute('id' in amd.defineCache, 'removed module from define cache');
			assert.same(mctx.id, result.id);
		},
		'should resolve url if the module wasn\'t found': function () {
			var mctx, result;
			mctx = {
				id: 'id',
				realm: { cache: { }, idToUrl: function () {} }
			};
			mctx.realm.idToUrl = this.stub().returns(mctx.id);
			result = amd.locateModule(mctx);
			assert.called(mctx.realm.idToUrl);
			assert.same(mctx.id, result.id);
		}
	});

	buster.testCase('amd.fetchModule', {
		'setUp': function () {
			// ensure they start empty
			amd.anonCache = undefined;
			amd.errorCache = undefined;
			amd.defineCache = {};
		},
		'tearDown': function () {
			// ensure they end empty
			amd.anonCache = undefined;
			amd.errorCache = undefined;
			amd.defineCache = {};
		},
		'should return mctx if it is already defined': function () {
			var result, ctx;
			ctx = 'foo';
			result = amd.fetchModule(ctx);
			assert.equals(ctx, result, 'returned non-ctx');
			ctx = { factory: function () {} };
			result = amd.fetchModule(ctx);
			assert.same(ctx, result, 'returned ctx with factory');
		},
		'should return promise if not already fetched': function () {
			var result;
			this.stub(script, 'load');
			this.stub(core, 'isModuleContext').returns(true);
			this.stub(amd, 'assignDefines');
			result = amd.fetchModule({});
			assert.called(script.load);
			assert(Deferred.isPromise(result), 'returned a promise');
		}
	});

	buster.testCase('amd.assignDefines', {
		'should return if module found in anon cache': function () {
			var result;
			this.stub(amd, 'applyArguments');
			amd.anonCache = ['id', [], function () {}, {}];
			result = amd.assignDefines({});
			assert(typeof result != 'undefined', 'returned');
		},
		'should return if module found in define cache': function () {
			var ctx, result;
			this.stub(amd, 'applyArguments');
			amd.defineCache['id'] = ['id', [], function () {}, {}];
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			result = amd.assignDefines(ctx);
			assert(typeof result != 'undefined', 'returned');
		},
		'should move all named modules to correct cache': function () {
			var ctx;
			this.stub(amd, 'applyArguments');
			amd.anonCache = ['id', [], function () {}, {}];
			amd.defineCache['id'] = ['id', [], function () {}, {}];
			amd.defineCache['id2'] = ['id2', [], function () {}, {}];
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			amd.assignDefines(ctx);
			assert('id' in ctx.realm.cache, 'found id in cache');
			assert('id2' in ctx.realm.cache, 'found id2 in cache');
		},
		'should clear define and anon caches': function () {
			var ctx;
			this.stub(amd, 'applyArguments');
			amd.anonCache = ['id', [], function () {}, {}];
			amd.defineCache['id'] = ['id', [], function () {}, {}];
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			amd.assignDefines(ctx);
			assert.equals(amd.defineCache, {}, 'define cache is clear');
			assert.equals(amd.anonCache, undefined, 'anon cache is clear');
		},
		'should throw if module not found': function () {
			var ctx;
			this.stub(amd, 'applyArguments');
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			assert.exception(function () {
				amd.assignDefines(ctx);
			});
		},
		'should throw if error cache is full': function () {
			var ctx;
			this.stub(amd, 'applyArguments');
			amd.errorCache = 'an error happened';
			ctx = {
				id: 'id',
				realm: { cache: {} }
			};
			assert.exception(function () {
				amd.assignDefines(ctx);
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