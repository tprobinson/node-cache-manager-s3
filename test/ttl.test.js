const S3Cache = require('../src/index.js')
const utils = require('./utils')
const random = require('random-words')
const moment = require('moment')

const keyParams = utils.constructorParams

expect.extend({ toBeInRange: utils.toBeInRange })

describe('get/set/del with ttl', () => {
	const ttl = Math.ceil(Math.random() * 10)
	const ttlUnits = 'h'
	const expectedExpireTime = moment().add(ttl, ttlUnits).unix()
	const cache = new S3Cache(Object.assign({}, keyParams, {
		ttl, ttlUnits,
	}))

	const testKey = random()
	const testValue = random()

	beforeAll(done => cache.reset(done))
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
