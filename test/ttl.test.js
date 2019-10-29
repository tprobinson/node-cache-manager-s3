const utils = require('./utils')
const random = require('random-words')
const moment = require('moment')

const keyParams = utils.constructorParams

expect.extend({ toBeInRange: utils.toBeInRange })

describe('get/set/del with ttl', () => {
  const ttl = Math.ceil(Math.random() * 10)
  const ttlUnits = 'h'
  const expectedExpireTime = moment().add(ttl, ttlUnits).unix()
  const cache = utils.getAsyncCache(Object.assign({}, keyParams, {
    ttl, ttlUnits,
  }))

  const testKey = random()
  const testValue = random()

  beforeAll(() => cache.reset())
  afterAll(() => cache.reset())

  afterEach(() => {
    utils.debugLog(JSON.stringify(cache.s3.cache))
  })

  test('set future ttl string', async () => {
    await cache.set(testKey, testValue)
  })

  test('get future ttl string', async () => {
    const value = await cache.headAsync(testKey)
    const stamp = cache._timestampToMoment(value.Expires).unix()

    // Give the timestamp a little cushion in case of lag.
    expect(stamp).toBeInRange(expectedExpireTime, expectedExpireTime + 30)
  })

  test('get string ttl', async () => {
    const value = await cache.ttlAsync(testKey)

    // Give the timestamp a little cushion in case of lag.
    expect(value).toBeInRange(expectedExpireTime, expectedExpireTime + 30)
  })

  test('set expired string', async () => {
    await cache.setAsync(testKey, testValue, {
      // Can't use shorthand parameter because we're purposely setting
      // a dead timestamp
      s3Options: {
        Expires: moment().subtract(ttl, ttlUnits).unix()
      }
    })
  })

  test('fail to get expired string', async () => {
    const value = await cache.getAsync(testKey)
    expect(value).toBeUndefined()
  })

  test('check that key still exists', async () => {
    const value = cache.get(testKey)
    expect(value).toBeUndefined()
  })

  test('fail to get expired string proactively', async () => {
    const value = await cache.get(testKey, { proactiveExpiry: true })
    expect(value).toBeUndefined()
  })

  test('check that key does not exist', async () => {
    const value = await cache.get(testKey)
    expect(value).toBeUndefined()
  })
})
