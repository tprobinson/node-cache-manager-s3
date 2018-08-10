const S3Cache = require('../src/index.js')
const utils = require('./utils')
const random = require('random-words')
const moment = require('moment')
const async = require('async')

const usingRealAws = process.env.USE_REAL_AWS && (process.env.USE_REAL_AWS === 'true' || process.env.USE_REAL_AWS === true)

const keyParams = utils.constructorParams

expect.extend({ toBeInRange: utils.toBeInRange })

describe('class construction options', () => {
	test('can instantiate class', () => {
		const cache = new S3Cache(keyParams)
		expect(cache).toEqual(expect.any(S3Cache))
	})

	test('can add options to constructor', () => {
		const region = 'us-west-2'
		const cache = new S3Cache(Object.assign({}, keyParams, {
			s3Options: {region}
		}))

		expect(cache).toHaveProperty('s3.config.region', region)
	})

	test('can add options to S3 constructor', () => {
		const headerKey = 'ContentType'
		const headerValue = 'text/plain'
		const cache = new S3Cache(Object.assign({}, keyParams, {
			s3Options: {params: {[headerKey]: headerValue}}
		}))

		expect(cache).toHaveProperty(`s3.config.params.${headerKey}`, headerValue)
	})

	test('construction fails without required parameters', () => {
		expect(() => new S3Cache({accessKey: 'a', secretKey: 'b'})).toThrow()
		expect(() => new S3Cache({secretKey: 'b', 'bucket': 'c'})).toThrow()
		expect(() => new S3Cache({'bucket': 'c', accessKey: 'a'})).toThrow()
	})

	test('construction fails with incorrect parameters', () => {
		expect(() => new S3Cache(Object.assign({}, keyParams, {s3Options: 2}))).toThrow()
	})
})

describe('basic function test', () => {
	const cache = new S3Cache(keyParams)
	const testKey = random()
	const testValue = random()
	const largeCountOfKeys = (Math.random() + 1) * 100 + 1000
	const largeListOfKeys = []
	for( let i = largeCountOfKeys; i > 0; i-- ) {
		largeListOfKeys.push({key: random(utils.largeRandomOptions), value: random()})
	}

	afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	// Since the previous test doesn't actually manipulate buckets, do it here as a test.
	test('reset cache', done => {
		cache.reset(done)
	})

	test('set string', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testValue)
			done()
		})
	})

	test('get key with no TTL', done => {
		cache.ttl(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(-1)
			done()
		})
	})

	test('fail to get string with different case', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('list keys', done => {
		cache.keys((err, values) => {
			expect(err).toBeNull()
			expect(values).toHaveLength(1)
			done()
		})
	})

	test('list keys with empty prefix', done => {
		cache.keys('', (err, values) => {
			expect(err).toBeNull()
			expect(values).toHaveLength(1)
			done()
		})
	})

	const setManyKeys = done => {
		async.each(largeListOfKeys, (item, cb) => cache.set(item.key, item.value, cb), done)
	}

	const getManyKeys = done => {
		cache.keys((err, values) => {
			expect(err).toBeNull()
			// + 1 for the keys we've set already
			expect(values).toHaveLength(largeListOfKeys.length + 1)
			done()
		})
	}

	// Skip these if we're using real AWS, since they're a lot of load.
	if( usingRealAws ) {
		test.skip('set more than 1000 keys (skipped for real AWS)', setManyKeys) // eslint-disable-line jest/no-disabled-tests
		test.skip('list more than 1000 keys (skipped for real AWS)', getManyKeys) // eslint-disable-line jest/no-disabled-tests
	} else {
		test('set more than 1000 keys', setManyKeys)
		test('list more than 1000 keys', getManyKeys)
	}

	test('delete string', done => {
		cache.del(testKey, done)
	})

	test('fail to get deleted string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('error when get/set with key/value as non-string', done => {
		expect(() => cache.get(1)).toThrow()
		expect(() => cache.set(1, 2)).toThrow()
		done()
	})

	test('debug logging with option', done => {
		const cache = new S3Cache(Object.assign({}, keyParams, {logLevel: 'TRACE'}))
		const fakeDebugLog = jest.fn()
		jest.spyOn(global.console, 'log').mockImplementation(fakeDebugLog)
		cache.keys(() => {
			expect(fakeDebugLog).toHaveBeenCalled()
			done()
		})
	})

	test('debug logging with env var', done => {
		const oldLogLevel = process.env.S3CACHE_KEYS_LOGLEVEL
		process.env.S3CACHE_KEYS_LOGLEVEL = 'TRACE'

		const cache = new S3Cache(keyParams)
		const fakeDebugLog = jest.fn()
		jest.spyOn(global.console, 'log').mockImplementation(fakeDebugLog)
		cache.keys(() => {
			expect(fakeDebugLog).toHaveBeenCalled()

			if( oldLogLevel ) {
				process.env.S3CACHE_GET_LOGLEVEL = oldLogLevel
			} else {
				delete process.env.S3CACHE_GET_LOGLEVEL
			}
			done()
		})
	})
})

describe('basic function test without callbacks', () => {
	const cache = new S3Cache(keyParams)
	const testKey = random()
	const testKey2 = random()
	const testValue = random()
	const testValue2 = random()

	afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string', () => {
		cache.set(testKey, testValue)
	})

	test('set string with options', () => {
		cache.set(testKey2, testValue2, {})
	})

	test('get string', () => {
		cache.get(testKey)
	})

	test('get string with options', () => {
		cache.get(testKey2, {})
	})

	test('delete string', () => {
		cache.del(testKey)
	})

	test('delete string with options', () => {
		cache.del(testKey2, {})
	})
})

describe('basic function test with options overrides', () => {
	const cache = new S3Cache(keyParams)
	const testKey = random()
	const testValue = random()
	const headerName = 'ContentType'
	const headerValue = 'text/plain'
	const headers = {s3Options: {[headerName]: headerValue}}

	afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string', done => {
		cache.set(testKey, testValue, headers, done)
	})

	test('get string', done => {
		cache.get(testKey, {}, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testValue)
			done()
		})
	})

	test('list keys', done => {
		cache.keys({}, (err, values) => {
			expect(err).toBeNull()
			expect(values).toHaveLength(1)
			done()
		})
	})

	test('list keys with prefix', done => {
		cache.keys('', {}, (err, values) => {
			expect(err).toBeNull()
			expect(values).toHaveLength(1)
			done()
		})
	})

	test('get key metadata', done => {
		cache.head(testKey, {s3Options: {IfModifiedSince: 0}}, (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty(headerName, headerValue)
			done()
		})
	})

	test('get key with no TTL', done => {
		cache.ttl(testKey, {}, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(-1)
			done()
		})
	})

	test('delete string', done => {
		cache.del(testKey, {}, done)
	})
})

describe('get/set/del with prefix', () => {
	const pathPrefix = random(utils.largeRandomOptions)
	const cache = new S3Cache(Object.assign({}, keyParams, {
		pathPrefix,
	}))

	const testKey = random()
	const testValue = random()

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	test('check a set string prefix', done => {
		async.waterfall([
			waterCb => cache.set(testKey, testValue, waterCb),
			(x, waterCb) => cache.get(testKey, {}, (err, value) => {
				expect(err).toBeNull()
				expect(value).toEqual(testValue)
				waterCb()
			})
		], done)
	})
})

describe('get/set/del with ttl', () => {
	const ttl = Math.ceil(Math.random() * 10)
	const ttlUnits = 'h'
	const expectedExpireTime = moment().add(ttl, ttlUnits).unix()
	const cache = new S3Cache(Object.assign({}, keyParams, {
		ttl, ttlUnits,
	}))

	const testKey = random()
	const testValue = random()

	afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set future ttl string', done => {
		cache.set(testKey, testValue, done)
	})

	test('get future ttl string', done => {
		cache.head(testKey, (err, value) => {
			expect(err).toBeNull()
			const stamp = cache._timestampToMoment(value.Expires).unix()

			// Give the timestamp a little cushion in case of lag.
			expect(stamp).toBeInRange(expectedExpireTime, expectedExpireTime + 30)
			done()
		})
	})

	test('get string ttl', done => {
		cache.ttl(testKey, (err, value) => {
			expect(err).toBeNull()

			// Give the timestamp a little cushion in case of lag.
			expect(value).toBeInRange(expectedExpireTime, expectedExpireTime + 30)
			done()
		})
	})

	test('set expired string', done => {
		cache.set(testKey, testValue, {
			// Can't use shorthand parameter because we're purposely setting
			// a dead timestamp
			s3Options: {
				Expires: moment().subtract(ttl, ttlUnits).unix()
			}
		}, done)
	})

	test('fail to get expired string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('check that key still exists', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('fail to get expired string proactively', done => {
		cache.get(testKey, {proactiveExpiry: true}, (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('check that key does not exist', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})
})

describe('key normalization', () => {
	const cache = new S3Cache(Object.assign({}, keyParams, {
		normalizeLowercase: true,
	}))
	const testKey = random()
	const testValue = random()

	afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testValue)
			done()
		})
	})

	test('get string with different case', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testValue)
			done()
		})
	})
})

describe('key normalization as url', () => {
	const cache = new S3Cache(Object.assign({}, keyParams, {
		parseKeyAsUrl: true,
		normalizeUrl: true,
	}))

	// Simulate storing HTML for a URL request
	const testKey = utils.getRandomUrl()
	const testValue = random(Object.assign({}, utils.largeRandomOptions, {exactly: 20}))
	const testPoorlyFormedKey = utils.getRandomUrl(true)
	const testPoorlyFormedValue = random(Object.assign({}, utils.largeRandomOptions, {exactly: 20}))

	afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string with url', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string with url', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testValue)
			done()
		})
	})

	test('fail to get same string with random case on url', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('set string with poorly formed url', done => {
		cache.set(testPoorlyFormedKey, testPoorlyFormedValue, done)
	})

	test('get string with poorly formed url', done => {
		cache.get(testPoorlyFormedKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testPoorlyFormedValue)
			done()
		})
	})

	test('fail to get same string with random case on poorly formed url', done => {
		cache.get(utils.randomizeCase(testPoorlyFormedKey), (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('get same string with lowercase normalization, random case', done => {
		const cache2 = new S3Cache(Object.assign({}, keyParams, {
			normalizeLowercase: true,
			parseKeyAsUrl: true,
			normalizeUrl: true,
		}))

		cache2.set(testPoorlyFormedKey, testPoorlyFormedValue, err => {
			expect(err).toBeNull()
			cache2.get(utils.randomizeCase(testPoorlyFormedKey), (err, value) => {
				expect(err).toBeNull()
				expect(value).toEqual(testPoorlyFormedValue)
				done()
			})
		})
	})
})

describe('key normalization as path', () => {
	const cache = new S3Cache(Object.assign({}, keyParams, {
		parseKeyAsPath: true,
		normalizePath: true,
	}))

	// Simulate storing file content for a file path
	const testKey = utils.getRandomPath()
	const testValue = random(Object.assign({}, utils.largeRandomOptions, {exactly: 20}))
	const testPoorlyFormedKey = utils.getRandomPath(true)
	const testPoorlyFormedValue = random(Object.assign({}, utils.largeRandomOptions, {exactly: 20}))

	afterAll(done => cache.reset(done))

	afterEach(() => {
		utils.debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string with path', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string with path', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testValue)
			done()
		})
	})

	test('fail to get same string with random case on path', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('set string with poorly formed path', done => {
		cache.set(testPoorlyFormedKey, testPoorlyFormedValue, done)
	})

	test('get string with poorly formed path', done => {
		cache.get(testPoorlyFormedKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(testPoorlyFormedValue)
			done()
		})
	})

	test('fail to get same string with random case on poorly formed path', done => {
		cache.get(utils.randomizeCase(testPoorlyFormedKey), (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeNull()
			done()
		})
	})

	test('get same string with lowercase normalization, random case', done => {
		const cache2 = new S3Cache(Object.assign({}, keyParams, {
			normalizeLowercase: true,
			parseKeyAsPath: true,
			normalizePath: true,
		}))

		cache2.set(testPoorlyFormedKey, testPoorlyFormedValue, err => {
			expect(err).toBeNull()
			cache2.get(utils.randomizeCase(testPoorlyFormedKey), (err, value) => {
				expect(err).toBeNull()
				expect(value).toEqual(testPoorlyFormedValue)
				done()
			})
		})
	})
})
