const S3Cache = require('../src/index.js')
const utils = require('./utils')
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
  test('debug logging with option', async () => {
    const cache = utils.getAsyncCache(Object.assign({}, keyParams, { logLevel: 'TRACE' }))

    await cache.keysAsync()
    expect(fakeConsoleLog).toHaveBeenCalled()
  })

  test('debug logging with env var', async () => {
    const testKey = random()
    const testValue = random()

    // Set everything to TRACE.
    const logTypes = ['get', 'set', 'keys', 'head', 'ttl', 'del', 'reset', 'normalizePath', 'timestampToMoment', 'stringifyResponse']
    const logLevel = 'TRACE'

    const oldLogLevels = utils.setAllLogLevels(logTypes, logLevel)
    const mainOldLogLevel = process.env.S3CACHE_LOGLEVEL
    process.env.S3CACHE_LOGLEVEL = logLevel

    const cache = utils.getAsyncCache(keyParams)

    beforeAll(() => cache.resetAsync())
    afterAll(() => cache.resetAsync())

    // Mimic the basic test suite, with logging.
    let value
    await cache.setAsync(testKey, testValue)
    value = await cache.getAsync(testKey)
    expect(value).toEqual(testValue)

    value = await cache.ttlAsync(testKey)
    expect(value).toEqual(-1)

    value = await cache.keysAsync()
    expect(value).toHaveLength(1)

    await cache.delAsync(testKey)
    value = await cache.getAsync(testKey)
    expect(value).toBeUndefined()

    expect(fakeConsoleLog).toHaveBeenCalled()

    // Reset env vars
    utils.setAllLogLevels(oldLogLevels)
    if( mainOldLogLevel ) {
      process.env.S3CACHE_LOGLEVEL = mainOldLogLevel
    } else {
      delete process.env.S3CACHE_LOGLEVEL
    }
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

  test('stringifyResponse handles strings and buffers', () => {
    const string = random()
    const bufferString = random()
    const buffer = Buffer.from(bufferString)
    expect(cache._stringifyResponse({ Body: string })).toEqual(string)
    expect(cache._stringifyResponse({ Body: buffer })).toEqual(bufferString)
    expect(cache._stringifyResponse({ Body: buffer }, { stringifyResponse: false })).toEqual(buffer)
  })
})
