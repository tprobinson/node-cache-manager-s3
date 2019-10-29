const utils = require('./utils')
const random = require('random-words')

const keyParams = utils.constructorParams
const cache = utils.getAsyncCache(keyParams)

class UnexpectedParameter extends Error {}

describe('basic function test without callbacks', () => {
  const testKey = random()
  const testKey2 = random()
  const testValue = random()
  const testValue2 = random()

  beforeAll(() => cache.resetAsync())
  afterAll(() => cache.resetAsync())

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('set string', async () => {
    await cache.setAsync(testKey, testValue)
  })

  test('set string with options', async () => {
    await cache.setAsync(testKey2, testValue2, {})
  })

  test('get string', async () => {
    await cache.getAsync(testKey)
  })

  test('get string with options', async () => {
    await cache.getAsync(testKey2, {})
  })

  test('delete string', async () => {
    await cache.delAsync(testKey)
  })

  test('delete string with options', async () => {
    await cache.delAsync(testKey2, {})
  })
})

describe('basic function test with options overrides', () => {
  const testKey = random()
  const testValue = random()
  const headerName = 'ContentType'
  const headerValue = 'text/plain'
  const headers = { s3Options: { [headerName]: headerValue } }

  beforeAll(() => cache.resetAsync())
  afterAll(() => cache.resetAsync())

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('set string', async () => {
    await cache.setAsync(testKey, testValue, headers)
  })

  test('get string', async () => {
    const value = await cache.getAsync(testKey)
    expect(value).toEqual(testValue)
  })

  test('get string with options', async () => {
    const value = await cache.getAsync(testKey, { s3Options: { IfModifiedSince: 0 } })
    expect(value).toEqual(testValue)
  })

  test('list keys', async () => {
    const values = await cache.keysAsync({})
    expect(values).toHaveLength(1)
  })

  test('list keys with prefix', async () => {
    const values = await cache.keysAsync('')
    expect(values).toHaveLength(1)
  })

  test('list keys with options', async () => {
    const values = await cache.keysAsync({ s3Options: { MaxKeys: 1000 } })
    expect(values).toHaveLength(1)
  })

  test('set string with no checksum on key', async () => {
    await cache.setAsync(testKey, testValue, Object.assign({}, headers, {
      checksumAlgorithm: 'none',
    }))
  })

  test('get string with no checksum on key', async () => {
    const value = await cache.getAsync(testKey, { checksumAlgorithm: 'none' })
    expect(value).toEqual(testValue)
  })

  test('no-checksum set should produce separate cache entry', async () => {
    const values = await cache.keysAsync({})
    expect(values).toHaveLength(2)
  })

  test('set string with base64 checksum', async () => {
    await cache.setAsync(testKey, testValue, Object.assign({}, headers, {
      checksumAlgorithm: 'none',
      checksumEncoding: 'base64',
    }))
  })

  test('get string with base64 checksum', async () => {
    const value = await cache.getAsync(testKey, { checksumAlgorithm: 'none', checksumEncoding: 'base64' })
    expect(value).toEqual(testValue)
  })

  test('base64-checksum set should produce separate cache entry', async () => {
    const values = await cache.keysAsync({})
    expect(values).toHaveLength(3)
  })

  test('fail to get keys when API error triggered.', async () => {
    await expect(cache.keysAsync('', { s3Options: { PleaseBreakApi: 1 } })).rejects.toThrow(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"))
  })

  test('get key metadata', async () => {
    const value = await cache.headAsync(testKey, { s3Options: { IfModifiedSince: 0 } })
    expect(value).toHaveProperty(headerName, headerValue)
  })

  test('get key with no TTL', async () => {
    const value = await cache.ttlAsync(testKey, {})
    expect(value).toEqual(-1)
  })

  test('delete string', async () => {
    // Force this bucket option so we test the s3Option assign code
    await cache.delAsync(testKey, { s3Options: { Bucket: keyParams.bucket } })
  })
})

describe('get/set/del with prefix', () => {
  const pathPrefix = random(utils.largeRandomOptions)
  const cache = utils.getAsyncCache(Object.assign({}, keyParams, {
    pathPrefix,
  }))

  const testKey = random()
  const testValue = random()

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('check a set string prefix', async () => {
    await cache.setAsync(testKey, testValue)
    const value = await cache.getAsync(testKey, {})

    expect(value).toEqual(testValue)
  })
})
