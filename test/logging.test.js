const S3Cache = require('../src/index.js')
const utils = require('./utils')
const async = require('async')
const moment = require('moment')
const random = require('random-words')

const keyParams = utils.constructorParams

// Mock console funcs
const fakeConsoleLog = jest.fn()
const fakeConsoleWarn = jest.fn()
const fakeConsoleError = jest.fn()
jest.spyOn(global.console, 'log').mockImplementation(fakeConsoleLog)
jest.spyOn(global.console, 'warn').mockImplementation(fakeConsoleWarn)
jest.spyOn(global.console, 'error').mockImplementation(fakeConsoleError)

describe('logging', () => {
	test('debug logging with option', done => {
		const cache = new S3Cache(Object.assign({}, keyParams, {logLevel: 'TRACE'}))

		cache.keys(() => {
			expect(fakeConsoleLog).toHaveBeenCalled()
			done()
		})
	})

	test('debug logging with env var', done => {
		const testKey = random()
		const testValue = random()

		// Set everything to TRACE.
		const logTypes = ['get', 'set', 'keys', 'head', 'ttl', 'del', 'reset', 'normalizePath', 'timestampToMoment', 'stringifyResponse']
		const logLevel = 'TRACE'

		const oldLogLevels = utils.setAllLogLevels(logTypes, logLevel)
		const mainOldLogLevel = process.env.S3CACHE_LOGLEVEL
		process.env.S3CACHE_LOGLEVEL = logLevel

		const cache = new S3Cache(keyParams)

		beforeAll(done => cache.reset(done))
		afterAll(done => cache.reset(done))

		// Mimic the basic test suite, with logging.
		async.series([
			seriesCb => cache.set(testKey, testValue, seriesCb),
			seriesCb => cache.get(testKey, (err, value) => {
				expect(err).toBeNull()
				expect(value).toEqual(testValue)
				seriesCb()
			}),
			seriesCb => cache.ttl(testKey, (err, value) => {
				expect(err).toBeNull()
				expect(value).toEqual(-1)
				seriesCb()
			}),
			seriesCb => cache.keys((err, values) => {
				expect(err).toBeNull()
				expect(values).toHaveLength(1)
				seriesCb()
			}),
			seriesCb => cache.del(testKey, seriesCb),
			seriesCb => cache.get(testKey, (err, value) => {
				expect(err).toBeNull()
				expect(value).toBeNull()
				seriesCb()
			}),
		], (err, results) => {
			expect(err).toBeNull()
			expect(fakeConsoleLog).toHaveBeenCalled()

			// Reset env vars
			utils.setAllLogLevels(oldLogLevels)
			if( mainOldLogLevel ) {
				process.env.S3CACHE_LOGLEVEL = mainOldLogLevel
			} else {
				delete process.env.S3CACHE_LOGLEVEL
			}
			done()
		})
	})
})

describe('test internal functions with alternate parameters', () => {
	const cache = new S3Cache(keyParams)

	test('stringify complains when response is malformed', () => {
		cache._stringifyResponse({})
		expect(fakeConsoleWarn).toHaveBeenCalled()
	})

	test('timestampToMoment can handle unix timestamp input (from mock)', () => {
		// Doing this strips milliseconds, so we should too.
		const now = moment().startOf('second')
		const inputMoment = cache._timestampToMoment(now.unix())
		expect(inputMoment.toString()).toEqual(now.toString())
	})

	test('timestampToMoment can handle JS style dates (from real AWS)', () => {
		// Doing this strips milliseconds, so we should too.
		const now = moment().startOf('second')
		const inputMoment = cache._timestampToMoment(now.toDate().toString())
		expect(inputMoment.toString()).toEqual(now.toString())
	})

	test('normalizeUrl can work without second parameter', () => {
		const url = utils.getRandomUrl()
		expect(cache._normalizeUrl(url)).toEqual(url.toLowerCase())
	})

	test('normalizePath can work without second parameter', () => {
		const path = utils.getRandomPath()
		expect(cache._normalizePath(path)).toEqual(path)
	})
})
