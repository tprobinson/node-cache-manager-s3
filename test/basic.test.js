const S3Cache = require('../src/index.js')
const utils = require('./utils')
const random = require('random-words')

const keyParams = utils.constructorParams
const cache = utils.getAsyncCache(keyParams)

describe('class construction options', () => {
  test('can instantiate class', () => {
    const cache = new S3Cache(keyParams)
    expect(cache).toEqual(expect.any(S3Cache))
  })

  test('can add options to constructor', () => {
    const region = 'us-west-2'
    const cache = new S3Cache(Object.assign({}, keyParams, {
      s3Options: { region }
    }))

    expect(cache).toHaveProperty('s3.config.region', region)
  })

  test('can add options to S3 constructor', () => {
    const headerKey = 'ContentType'
    const headerValue = 'text/plain'
    const cache = new S3Cache(Object.assign({}, keyParams, {
      s3Options: { params: { [headerKey]: headerValue } }
    }))

    expect(cache).toHaveProperty(`s3.config.params.${headerKey}`, headerValue)
  })

  test('construction fails without required parameters', () => {
    expect(() => new S3Cache({ accessKey: 'a', secretKey: 'b' })).toThrow()
    expect(() => new S3Cache({ secretKey: 'b', bucket: 'c' })).toThrow()
    expect(() => new S3Cache({ bucket: 'c', accessKey: 'a' })).toThrow()
  })

  test('construction fails with incorrect parameters', () => {
    expect(() => new S3Cache(Object.assign({}, keyParams, { s3Options: 2 }))).toThrow()
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
    largeListOfKeys.push({ key: random(utils.largeRandomOptions), value: random() })
  }

  beforeAll(() => cache.resetAsync())
  afterAll(() => cache.resetAsync())

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  // Since the previous test doesn't actually manipulate buckets, do it here as a test.
  test('reset cache', async () => {
    await cache.resetAsync()
  })

  test('set string', async () => {
    await cache.setAsync(testKey, testValue)
  })

  test('get string', async () => {
    const value = await cache.getAsync(testKey)
    expect(value).toEqual(testValue)
  })

  test('get key with no TTL', async () => {
    const value = await cache.ttlAsync(testKey)
    expect(value).toEqual(-1)
  })

  test('fail to get string with different case', async () => {
    const value = await cache.getAsync(utils.randomizeCase(testKey))
    expect(value).toBeUndefined()
  })

  test('list keys', async () => {
    const values = await cache.keysAsync()
    expect(values).toHaveLength(1)
  })

  test('list keys with empty prefix', async () => {
    const values = await cache.keysAsync('')
    expect(values).toHaveLength(1)
  })

  const setManyKeys = () => {
    const allSets = largeListOfKeys.map(item => cache.setAsync(item.key, item.value))
    return Promise.all(allSets)
  }

  const getManyKeys = async () => {
    const values = await cache.keysAsync()
    // + 1 for the keys we've set already
    expect(values).toHaveLength(largeListOfKeys.length + 1)
  }

  // Skip these if we're using real AWS, since they're a lot of load.
  if( utils.usingRealAws ) {
    test.skip('set more than 1000 keys (skipped for real AWS)', setManyKeys) // eslint-disable-line jest/no-disabled-tests
    test.skip('list more than 1000 keys (skipped for real AWS)', getManyKeys) // eslint-disable-line jest/no-disabled-tests
  } else {
    test('set more than 1000 keys', setManyKeys)
    test('list more than 1000 keys', getManyKeys)
  }

  test('delete string', async () => {
    await cache.delAsync(testKey)
  })

  test('fail to get deleted string', async () => {
    const value = await cache.getAsync(testKey)
    expect(value).toBeUndefined()
  })

  test('error when get/set with key/value as non-string', async () => {
    expect(() => cache.get(1)).toThrow()
    expect(() => cache.set(1, 2)).toThrow()
  })

  test('unicode string safety', async () => {
    await cache.setAsync(testUnicodeKey, testUnicodeValue)
    const value = await cache.getAsync(testUnicodeKey)
    expect(value).toEqual(testUnicodeValue)
  })

  test('binary data safety', async () => {
    await cache.setAsync(testBinaryKey, testBinaryValue)
    const badValue = await cache.getAsync(testBinaryKey)
    const value = await cache.getAsync(testBinaryKey, { stringifyResponses: false })

    expect(badValue).not.toEqual(testBinaryValue)
    expect(value).toEqual(testBinaryValue)
  })
})
