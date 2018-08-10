const cacheManager = require('cache-manager')
const S3Cache = require('../src/index.js')
const utils = require('./utils')
const random = require('random-words')
const moment = require('moment')
const async = require('async')

const usingRealAws = process.env.USE_REAL_AWS && (process.env.USE_REAL_AWS === 'true' || process.env.USE_REAL_AWS === true)

const keyParams = utils.constructorParams

expect.extend({ toBeInRange: utils.toBeInRange })

let cacheFuncInput = 2
function cacheMe (input, cb) {
	cb(null, `${input * cacheFuncInput}`)

	// Try to cause a little havoc, make sure the output is cached.
	cacheFuncInput += 1
}

beforeEach(() => { cacheFuncInput = 2 })

describe('cache-manager construction options', () => {
	test('can instantiate class', () => {
		const s3Cache = new S3Cache(keyParams)
		const cache = cacheManager.caching({
			store: s3Cache
		})
		expect(s3Cache).toEqual(expect.any(S3Cache))
		expect(cache.store).toEqual(expect.any(S3Cache))
	})
})

describe('basic function test', () => {
	const s3Cache = new S3Cache(keyParams)
	const cache = cacheManager.caching({
		store: s3Cache
	})
	const crappedFunc = (input, cb) =>
		cache.wrap(input, cacheCallback => {
			cacheMe(input, cacheCallback)
		}, cb)

	const wrappedFunc = (id, cb) => {
		cache.get(id, function (err, result) {

			if( result !== null ) {
				return cb(null, result)
			}

			cacheMe(id, function (err, result) {
				if(err) { return cb(err) }
				cache.set(id, result, cb(null, result))
			})
		})
	}

	// afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(s3Cache.s3.cache))
	})

	// Since the previous test doesn't actually manipulate buckets, do it here as a test.
	test('reset cache', done => {
		cache.reset(done)
	})

	test('try function out', done => {
		async.timesSeries(3, (n, timesCb) => wrappedFunc('2', timesCb),
			(err, results) => {
				expect(err).toBeNull()
				expect(results[0]).toEqual('4')
				expect(results[1]).toEqual('4')
				expect(results[2]).toEqual('4')
				done()
			}
		)
	})
})
