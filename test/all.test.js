const S3Cache = require('../src/index.js')
const random = require('random-words')
const moment = require('moment')

const utils = require('./utils')

const debug = false
const debugLog = utils.debugLogFunc(debug)

const keyParams = {
	accessKey: random(utils.largeRandomOptions),
	secretKey: random(utils.largeRandomOptions),
	bucket: random(utils.largeRandomOptions),
	debug,
}

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
		const cache = new S3Cache(Object.assign({}, keyParams, {
			s3Options: {params: {ServerSideEncryption: 'AES256'}}
		}))

		expect(cache).toHaveProperty('s3.config.params.ServerSideEncryption', 'AES256')
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

	afterEach(() => {
		debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty('Body', testValue)
			done()
		})
	})

	test('fail to get string with different case', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toEqual(expect.any(Error))
			expect(value).toBeNull()
			done()
		})
	})

	test('list keys', done => {
		cache.keys((err, values) => {
			expect(err).toBeNull()
			expect(values.length === 1 && values[0].Body === testValue).toBeTruthy()
			done()
		})
	})

	test('list keys with empty prefix', done => {
		cache.keys('', (err, values) => {
			expect(err).toBeNull()
			expect(values.length === 1 && values[0].Body === testValue).toBeTruthy()
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

	test('delete string', done => {
		cache.del(testKey, done)
	})

	test('fail to get deleted string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toEqual(expect.any(Error))
			expect(err).toHaveProperty('statusCode', 404)
			expect(value).toBeNull()
			done()
		})
	})

	test('debug logging', done => {
		const cache = new S3Cache(Object.assign({}, keyParams, {debug: true}))
		const fakeDebugLog = jest.fn()
		jest.spyOn(global.console, 'log').mockImplementation(fakeDebugLog)
		cache.keys(() => {
			expect(fakeDebugLog).toHaveBeenCalled()
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

	afterEach(() => {
		debugLog(JSON.stringify(cache.s3.cache))
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
	const headerName = 'ServerSideEncryption'
	const headerValue = 'AES256'
	const headers = {s3Options: {[headerName]: headerValue}}

	afterEach(() => {
		debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string', done => {
		cache.set(testKey, testValue, headers, done)
	})

	test('get string', done => {
		cache.get(testKey, headers, (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty('Body', testValue)
			expect(value).toHaveProperty(headerName, headerValue)
			done()
		})
	})

	test('list keys', done => {
		cache.keys(headers, (err, values) => {
			expect(err).toBeNull()
			expect(values.length === 1 && values[0].Body === testValue).toBeTruthy()
			done()
		})
	})

	test('list keys with prefix', done => {
		cache.keys('', headers, (err, values) => {
			expect(err).toBeNull()
			expect(values.length === 1 && values[0].Body === testValue).toBeTruthy()
			done()
		})
	})

	test('get key with no TTL', done => {
		cache.ttl(testKey, headers, (err, value) => {
			expect(err).toBeNull()
			expect(value).toEqual(-1)
			done()
		})
	})

	test('delete string', done => {
		cache.del(testKey, headers, done)
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
		debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value.Key.startsWith(pathPrefix + '/')).toBeTruthy()
			expect(value).toHaveProperty('Body', testValue)
			done()
		})
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

	afterEach(() => {
		debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set future ttl string', done => {
		cache.set(testKey, testValue, done)
	})

	test('get future ttl string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty('Body', testValue)

			// Give the timestamp a little cushion in case of lag.
			expect(value.Expires).toBeInRange(expectedExpireTime, expectedExpireTime + 3)
			done()
		})
	})

	test('get string ttl', done => {
		cache.ttl(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toBeInRange(expectedExpireTime, expectedExpireTime + 3)
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
			expect(err).toEqual(expect.any(Error))
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

	afterEach(() => {
		debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty('Body', testValue)
			done()
		})
	})

	test('get string with different case', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty('Body', testValue)
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

	afterEach(() => {
		debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string with url', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string with url', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty('Body', testValue)
			done()
		})
	})

	test('fail to get same string with random case on url', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toEqual(expect.any(Error))
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
			expect(value).toHaveProperty('Body', testPoorlyFormedValue)
			done()
		})
	})

	test('fail to get same string with random case on poorly formed url', done => {
		cache.get(utils.randomizeCase(testPoorlyFormedKey), (err, value) => {
			expect(err).toEqual(expect.any(Error))
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
				expect(value).toHaveProperty('Body', testPoorlyFormedValue)
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

	afterEach(() => {
		debugLog(JSON.stringify(cache.s3.cache))
	})

	test('set string with path', done => {
		cache.set(testKey, testValue, done)
	})

	test('get string with path', done => {
		cache.get(testKey, (err, value) => {
			expect(err).toBeNull()
			expect(value).toHaveProperty('Body', testValue)
			done()
		})
	})

	test('fail to get same string with random case on path', done => {
		cache.get(utils.randomizeCase(testKey), (err, value) => {
			expect(err).toEqual(expect.any(Error))
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
			expect(value).toHaveProperty('Body', testPoorlyFormedValue)
			done()
		})
	})

	test('fail to get same string with random case on poorly formed path', done => {
		cache.get(utils.randomizeCase(testPoorlyFormedKey), (err, value) => {
			expect(err).toEqual(expect.any(Error))
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
				expect(value).toHaveProperty('Body', testPoorlyFormedValue)
				done()
			})
		})
	})
})
