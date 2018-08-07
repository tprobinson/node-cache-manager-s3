const S3Cache = require('../index.js')
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

// TODO: Future tests
// fail when folder path options are <= 0
// fail when hash algorithm is invalid
// test other hash algorithms
// test deleting object when del is implemented

describe('class construction options', () => {
	test('can instantiate class', () => {
		const cache = new S3Cache(keyParams)
		expect(cache).toEqual(expect.any(S3Cache))
	})

	test('can add options to S3 constructor', () => {
		const region = 'us-west-2'
		const cache = new S3Cache(Object.assign({}, keyParams, {
			s3Options: {region}
		}))

		expect(cache).toHaveProperty('s3.config.region', region)
	})
})

describe('basic get/set', () => {
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
})

describe('get/set with prefix', () => {
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

describe('get/set with expires', () => {
	const expiry = Math.ceil(Math.random() * 10)
	const expiryUnits = 'h'
	const expectedExpireTime = moment().add(expiry, expiryUnits).unix()
	const cache = new S3Cache(Object.assign({}, keyParams, {
		expiry, expiryUnits,
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

			// Give the timestamp a little cushion in case of lag.
			expect(value.Expires).toBeInRange(expectedExpireTime, expectedExpireTime + 3)
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
