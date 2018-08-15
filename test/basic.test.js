const S3Cache = require('../src/index.js')
const utils = require('./utils')
const random = require('random-words')
const async = require('async')

const keyParams = utils.constructorParams
const cache = new S3Cache(keyParams)

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
	const testKey = random()
	const testValue = random()

	const testUnicodeKey = random()
	const testUnicodeValue = '関係なく　文字。'

	const testBinaryKey = random()
	// One-pixel transparent GIF
	const testBinaryValue = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

	const largeCountOfKeys = (Math.random() + 1) * 100 + 1000
	const largeListOfKeys = []
	for( let i = largeCountOfKeys; i > 0; i-- ) {
		largeListOfKeys.push({key: random(utils.largeRandomOptions), value: random()})
	}

	beforeAll(done => cache.reset(done))
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
	if( utils.usingRealAws ) {
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

	test('unicode string safety', done => {
		async.series([
			seriesCb => cache.set(testUnicodeKey, testUnicodeValue, seriesCb),
			seriesCb => cache.get(testUnicodeKey, seriesCb),
		], (err, values) => {
			expect(err).toBeNull()
			expect(values[1]).toEqual(testUnicodeValue)
			done()
		})
	})

	test('binary data safety', done => {
		async.series([
			seriesCb => cache.set(testBinaryKey, testBinaryValue, seriesCb),
			seriesCb => cache.get(testBinaryKey, seriesCb),
			seriesCb => cache.get(testBinaryKey, {stringifyResponses: false}, seriesCb),
		], (err, values) => {
			expect(err).toBeNull()
			expect(values[1]).not.toEqual(testBinaryValue)
			expect(values[2]).toEqual(testBinaryValue)
			done()
		})
	})
})
