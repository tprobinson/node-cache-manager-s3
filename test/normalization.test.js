const utils = require('./utils')
const random = require('random-words')

const keyParams = utils.constructorParams

describe('key normalization', () => {
  const cache = utils.getAsyncCache(Object.assign({}, keyParams, {
    normalizeLowercase: true,
  }))

  const testKey = random()
  const testValue = random()

  beforeAll(() => cache.resetAsync())
  afterAll(() => cache.resetAsync())

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('set string', async () => {
    await cache.setAsync(testKey, testValue)
  })

  test('get string', async () => {
    const value = await cache.getAsync(testKey)
    expect(value).toEqual(testValue)
  })

  test('get string with different case', async () => {
    const value = await cache.getAsync(utils.randomizeCase(testKey))
    expect(value).toEqual(testValue)
  })
})

describe('key normalization as url', () => {
  const cache = utils.getAsyncCache(Object.assign({}, keyParams, {
    parseKeyAsUrl: true,
    normalizeUrl: true,
  }))

  // Simulate storing HTML for a URL request
  const testKey = utils.getRandomUrl()
  const testValue = random(Object.assign({}, utils.largeRandomOptions, { exactly: 20 }))
  const testPoorlyFormedKey = utils.getRandomUrl(true)
  const testPoorlyFormedValue = random(Object.assign({}, utils.largeRandomOptions, { exactly: 20 }))
  const testBoringKey = 'http://nowhere.com'
  const testBoringValue = random(Object.assign({}, utils.largeRandomOptions, { exactly: 20 }))

  beforeAll(() => cache.resetAsync())
  afterAll(() => cache.resetAsync())

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('set string with url', async () => {
    await cache.setAsync(testKey, testValue)
  })

  test('get string with url', async () => {
    const value = await cache.getAsync(testKey)
    expect(value).toEqual(testValue)
  })

  test('set string with url without normalization', async () => {
    await cache.setAsync(testKey, testValue)
  })

  test('get string with url without normalization', async () => {
    const value = await cache.getAsync(testKey, { normalizeUrl: false })
    expect(value).toEqual(testValue)
  })

  test('fail to get same string with random case on url', async () => {
    const value = await cache.getAsync(utils.randomizeCase(testKey))
    expect(value).toBeUndefined()
  })

  test('set string with poorly formed url', async () => {
    await cache.setAsync(testPoorlyFormedKey, testPoorlyFormedValue)
  })

  test('get string with poorly formed url', async () => {
    const value = await cache.getAsync(testPoorlyFormedKey)
    expect(value).toEqual(testPoorlyFormedValue)
  })

  test('set string with boring url', async () => {
    await cache.setAsync(testBoringKey, testBoringValue)
  })

  test('get string with boring url', async () => {
    const value = await cache.getAsync(testBoringKey)
    expect(value).toEqual(testBoringValue)
  })

  test('fail to get same string with random case on poorly formed url', async () => {
    const value = await cache.getAsync(utils.randomizeCase(testPoorlyFormedKey))
    expect(value).toBeUndefined()
  })

  test('get same string with lowercase normalization, random case', async () => {
    const cache2 = utils.getAsyncCache(Object.assign({}, keyParams, {
      normalizeLowercase: true,
      parseKeyAsUrl: true,
      normalizeUrl: true,
    }))

    await cache2.setAsync(testPoorlyFormedKey, testPoorlyFormedValue)
    const value = await cache2.getAsync(utils.randomizeCase(testPoorlyFormedKey))
    expect(value).toEqual(testPoorlyFormedValue)
  })
})

describe('key normalization as path', () => {
  const cache = utils.getAsyncCache(Object.assign({}, keyParams, {
    parseKeyAsPath: true,
    normalizePath: true,
  }))

  // Simulate storing file content for a file path
  const testKey = utils.getRandomPath()
  const testValue = random(Object.assign({}, utils.largeRandomOptions, { exactly: 20 }))
  const testPoorlyFormedKey = utils.getRandomPath(true)
  const testPoorlyFormedValue = random(Object.assign({}, utils.largeRandomOptions, { exactly: 20 }))

  beforeAll(() => cache.resetAsync())
  afterAll(() => cache.resetAsync())

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('set string with path', async () => {
    await cache.setAsync(testKey, testValue)
  })

  test('get string with path', async () => {
    const value = await cache.getAsync(testKey)
    expect(value).toEqual(testValue)
  })

  test('set string with path without normalization', async () => {
    await cache.setAsync(testKey, testValue, { normalizePath: false })
  })

  test('get string with path without normalization', async () => {
    const value = await cache.getAsync(testKey, { normalizePath: false })
    expect(value).toEqual(testValue)
  })

  test('fail to get same string with random case on path', async () => {
    const value = await cache.getAsync(utils.randomizeCase(testKey))
    expect(value).toBeUndefined()
  })

  test('set string with poorly formed path', async () => {
    await cache.setAsync(testPoorlyFormedKey, testPoorlyFormedValue)
  })

  test('get string with poorly formed path', async () => {
    const value = await cache.getAsync(testPoorlyFormedKey)
    expect(value).toEqual(testPoorlyFormedValue)
  })

  test('fail to get same string with random case on poorly formed path', async () => {
    const value = await cache.getAsync(utils.randomizeCase(testPoorlyFormedKey))
    expect(value).toBeUndefined()
  })

  test('get same string with lowercase normalization, random case', async () => {
    const cache2 = utils.getAsyncCache((Object.assign({}, keyParams, {
      normalizeLowercase: true,
      parseKeyAsPath: true,
      normalizePath: true,
    })))

    await cache2.setAsync(testPoorlyFormedKey, testPoorlyFormedValue)
    const value = await cache2.getAsync(utils.randomizeCase(testPoorlyFormedKey))
    expect(value).toEqual(testPoorlyFormedValue)
  })
})
