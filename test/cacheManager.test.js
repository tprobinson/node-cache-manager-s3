const cacheManager = require('cache-manager')
const S3Cache = require('../src/index.js')
const { promisify } = require('util')
const utils = require('./utils')

const keyParams = utils.constructorParams

expect.extend({ toBeInRange: utils.toBeInRange })

let cacheFuncInput = 1
function cacheMe (input) {
  // Try to cause a little havoc, make sure the output is cached.
  cacheFuncInput += 1
  console.log(cacheFuncInput, input)
  return `${input * cacheFuncInput}`
}

beforeEach(() => { cacheFuncInput = 1 })

describe('cache-manager construction options', () => {
  test('can instantiate class', () => {
    const s3Cache = utils.getAsyncCache(keyParams)
    const cache = cacheManager.caching({
      store: s3Cache
    })
    expect(s3Cache).toEqual(expect.any(S3Cache))
    expect(cache.store).toEqual(expect.any(S3Cache))
  })
})

describe('basic function test', () => {
  const s3Cache = utils.getAsyncCache(keyParams)
  const cache = cacheManager.caching({
    store: s3Cache
  })

  // Make some async methods to make Jest happy.
  const asyncifyMethods = ['get', 'set', 'reset']
  asyncifyMethods.forEach(key => {
    cache[`${key}Async`] = promisify(cache[key])
  })

  const wrappedFunc = async id => {
    const result = await cache.getAsync(id)

    if( result ) {
      return result
    }

    const cacheResult = cacheMe(id)
    await cache.setAsync(id, cacheResult)
    return cacheResult
  }

  // afterAll(done => cache.reset(done))

  afterEach(() => {
    utils.debugLog(JSON.stringify(s3Cache.s3.cache))
  })

  // Since the previous test doesn't actually manipulate buckets, do it here as a test.
  test('reset cache', async () => {
    await cache.resetAsync()
  })

  test('try function out', async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 100))

    const resultOne = await wrappedFunc('2')
    await pause()
    const resultTwo = await wrappedFunc('2')
    await pause()
    const resultThree = await wrappedFunc('2')

    expect(resultOne).toEqual('4')
    expect(resultTwo).toEqual('4')
    expect(resultThree).toEqual('4')
  })
})
