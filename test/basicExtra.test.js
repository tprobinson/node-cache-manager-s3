const S3Cache = require('../src/index.js')
const utils = require('./utils')
const random = require('random-words')
const async = require('async')

const keyParams = utils.constructorParams
const cache = new S3Cache(keyParams)

class UnexpectedParameter extends Error {}

describe('basic function test without callbacks', () => {
  const testKey = random()
  const testKey2 = random()
  const testValue = random()
  const testValue2 = random()

  beforeAll(done => cache.reset(done))
  afterAll(done => cache.reset(done))

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
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
  const testKey = random()
  const testValue = random()
  const headerName = 'ContentType'
  const headerValue = 'text/plain'
  const headers = {s3Options: {[headerName]: headerValue}}

  beforeAll(done => cache.reset(done))
  afterAll(done => cache.reset(done))

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('set string', done => {
    cache.set(testKey, testValue, headers, done)
  })

  test('get string', done => {
    cache.get(testKey, (err, value) => {
      expect(err).toBeNull()
      expect(value).toEqual(testValue)
      done()
    })
  })

  test('get string with options', done => {
    cache.get(testKey, {s3Options: {IfModifiedSince: 0}}, (err, value) => {
      expect(err).toBeNull()
      expect(value).toEqual(testValue)
      done()
    })
  })

  test('list keys', done => {
    cache.keys({}, (err, values) => {
      expect(err).toBeNull()
      expect(values).toHaveLength(1)
      done()
    })
  })

  test('list keys with prefix', done => {
    cache.keys('', (err, values) => {
      expect(err).toBeNull()
      expect(values).toHaveLength(1)
      done()
    })
  })

  test('list keys with options', done => {
    cache.keys({s3Options: {MaxKeys: 1000}}, (err, values) => {
      expect(err).toBeNull()
      expect(values).toHaveLength(1)
      done()
    })
  })

  test('set string with no checksum on key', done => {
    cache.set(testKey, testValue, Object.assign({}, headers, {
      checksumAlgorithm: 'none',
    }), done)
  })

  test('get string with no checksum on key', done => {
    cache.get(testKey, {checksumAlgorithm: 'none'}, (err, value) => {
      expect(err).toBeNull()
      expect(value).toEqual(testValue)
      done()
    })
  })

  test('no-checksum set should produce separate cache entry', done => {
    cache.keys({}, (err, values) => {
      expect(err).toBeNull()
      expect(values).toHaveLength(2)
      done()
    })
  })

  test('set string with base64 checksum', done => {
    cache.set(testKey, testValue, Object.assign({}, headers, {
      checksumAlgorithm: 'none',
      checksumEncoding: 'base64',
    }), done)
  })

  test('get string with base64 checksum', done => {
    cache.get(testKey, {checksumAlgorithm: 'none', checksumEncoding: 'base64'}, (err, value) => {
      expect(err).toBeNull()
      expect(value).toEqual(testValue)
      done()
    })
  })

  test('base64-checksum set should produce separate cache entry', done => {
    cache.keys({}, (err, values) => {
      expect(err).toBeNull()
      expect(values).toHaveLength(3)
      done()
    })
  })

  test('fail to get keys when API error triggered.', done => {
    cache.keys('', {s3Options: {PleaseBreakApi: 1}}, (err, values) => {
      expect(err).toEqual(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"))
      done()
    })
  })

  test('get key metadata', done => {
    cache.head(testKey, {s3Options: {IfModifiedSince: 0}}, (err, value) => {
      expect(err).toBeNull()
      expect(value).toHaveProperty(headerName, headerValue)
      done()
    })
  })

  test('get key with no TTL', done => {
    cache.ttl(testKey, {}, (err, value) => {
      expect(err).toBeNull()
      expect(value).toEqual(-1)
      done()
    })
  })

  test('delete string', done => {
    // Force this bucket option so we test the s3Option assign code
    cache.del(testKey, {s3Options: {Bucket: keyParams.bucket}}, done)
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
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('check a set string prefix', done => {
    async.waterfall([
      waterCb => cache.set(testKey, testValue, waterCb),
      (x, waterCb) => cache.get(testKey, {}, (err, value) => {
        expect(err).toBeNull()
        expect(value).toEqual(testValue)
        waterCb()
      })
    ], done)
  })
})
