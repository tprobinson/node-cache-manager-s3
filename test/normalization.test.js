const S3Cache = require('../src/index.js')
const utils = require('./utils')
const random = require('random-words')

const keyParams = utils.constructorParams

describe('key normalization', () => {
  const cache = new S3Cache(Object.assign({}, keyParams, {
    normalizeLowercase: true,
  }))
  const testKey = random()
  const testValue = random()

  beforeAll(done => cache.reset(done))
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
  const testBoringKey = 'http://nowhere.com'
  const testBoringValue = random(Object.assign({}, utils.largeRandomOptions, {exactly: 20}))

  beforeAll(done => cache.reset(done))
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

  test('set string with url without normalization', done => {
    cache.set(testKey, testValue, {normalizeUrl: false}, done)
  })

  test('get string with url without normalization', done => {
    cache.get(testKey, {normalizeUrl: false}, (err, value) => {
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

  test('set string with boring url', done => {
    cache.set(testBoringKey, testBoringValue, done)
  })

  test('get string with boring url', done => {
    cache.get(testBoringKey, (err, value) => {
      expect(err).toBeNull()
      expect(value).toEqual(testBoringValue)
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

  beforeAll(done => cache.reset(done))
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

  test('set string with path without normalization', done => {
    cache.set(testKey, testValue, {normalizePath: false}, done)
  })

  test('get string with path without normalization', done => {
    cache.get(testKey, {normalizePath: false}, (err, value) => {
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
