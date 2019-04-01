/** @module S3Cache */
const async = require('async')
const path = require('path')
const url = require('url')
const querystring = require('querystring')
const checksum = require('checksum')
const moment = require('moment')

const log = require('loglevel')
const prefix = require('loglevel-plugin-prefix')
const chalk = require('chalk')

const S3 = require('aws-sdk').S3

const defaultOptions = {
  logLevel: 'warn',
  ttl: 0,
  ttlUnits: 'seconds',
  pathPrefix: '',
  stringifyResponses: true,

  // Options for folder chunking
  folderPathDepth: 2,
  folderPathChunkSize: 2,

  // Options for checksum, valid values are OpenSSL hash specifiers.
  checksumAlgorithm: 'md5',
  checksumEncoding: 'hex',

  // Options for key normalization
  normalizeLowercase: false,

  // Options for key normalization if it's a path
  parseKeyAsPath: false,
  normalizePath: true,

  // Options for key normalization if it's a URL
  parseKeyAsUrl: false,
  normalizeUrl: true,

  // Options for caching
  proactiveExpiry: false,
}

const logColors = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red,
}

/**
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Response.html
 * @typedef {Error} S3Error
 * @property {string} code - a unique short code representing the error that was emitted.
 * @property {string} message - a longer human readable error message
 * @property {Boolean} retryable - whether the error message is retryable.
 * @property {number} statusCode - in the case of a request that reached the service, this value contains the response status code.
 * @property {Date} time - the date time object when the error occurred.
 * @property {string} hostname - set when a networking error occurs to easily identify the endpoint of the request.
 * @property {string} region - set when a networking error occurs to easily identify the region of the request.
 */

/**
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Response.html
 * @typedef {Object} S3Response
 * @property {Buffer|array|string|ReadableStream} Body - Object data
 * @property {number} Expires Unix epoch timestamp for ttl time
 */

/**
 * A [cache-manager](https://github.com/BryanDonovan/node-cache-manager) module for storing results in S3.
 * @see https://www.npmjs.com/package/cache-manager
 * @example
 * const s3 = new S3Cache({
 *   accessKey: 'AAAAAAAA',
 *   secretKey: 'asdnbklajsndkj',
 *   bucket: 'my-cache-bucket',
 *   ttl: 1, ttlUnits: 'hours',
 *   s3Options: {
 *     region: 'us-west-2',
 *     httpOptions: {
 *       proxy: 'http://my.proxy:3128'
 *     },
 *     params: {
 *       ACL: 'authenticated-read',
 *     },
 *   },
 * })
 */
class S3Cache {
  /**
   * @constructs S3Cache
   * @param {Object} options                             - An object of options
   * @param {string} options.accessKey                   - An AWS access key
   * @param {string} options.secretKey                   - An AWS secret key
   * @param {string} options.bucket                      - The name of an AWS S3 bucket.
   *
   * @param {number|Object} [options.ttl]                - Paired with {@link options.ttlUnits}, amount in the future to set an object to expire. Can also be an Object, as supported by Moment.
   * @param {string} [options.ttlUnits=seconds]          - Paired with {@link options.ttl}, this is the unit of time to set an object to expire.
   * @see http://momentjs.com/docs/#/manipulating/add/
   *
   * @param {string} [options.logLevel]                  - If specified, the default log level.
   * @param {string} [options.pathPrefix]                - If specified, all cache objects will be placed under this folder. Slashes are not necessary (unless for a nested folder)
   * @param {number} [options.folderPathDepth=2]         - The number of folders to chunk checksummed names into. Increases performance by nesting objects into folders. Set to 0 to disable.
   * @param {number} [options.folderPathChunkSize=2]     - The number of characters to use in each folder path chunk.
   *
   * @param {string} [options.checksumAlgorithm=md5]     - The digest algorithm to use when checksumming. Supports any OpenSSL digest (use `openssl list -digest-algorithms`) and 'none'.
   * @param {string} [options.checksumEncoding=hex]      - The encoding to use for the digest. Valid values (as of this writing) are 'hex', 'latin1', and 'base64'.
   * @see https://nodejs.org/api/crypto.html#crypto_hash_digest_encoding
   *
   * @param {Boolean} [options.normalizeLowercase=false] - When normalizing, should the key be lowercased first? If using URLs, probably true. If using paths, probably false.
   * @param {Boolean} [options.parseKeyAsPath=false]     - Should the key be parsed as a path for normalization?
   * @param {Boolean} [options.normalizePath=true]       - If the key is parsed as a path, should we normalize it? (uses path.normalize)
   * @param {Boolean} [options.parseKeyAsUrl=false]      - Should the key be parsed as a URL for normalization?
   * @param {Boolean} [options.normalizeUrl=true]        - If the key is parsed as a URL, should we normalize it? (sorts query parameters)
   * @param {Boolean} [options.proactiveExpiry=false]    - If a key is marked as expired when we encounter it, should we delete it? Causes an additional request, but keeps the cache cleaner in case of keys()
   *
   * @param {Object} [options.s3Options]                 - An object passed into the S3 constructor.
   * @param {Object} [options.s3Options.params]          - An object passed into the S3 constructor. Parameters in here are included with every request to S3. Good for options like 'region'.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property
   */
  constructor(options) {
    this.options = Object.assign({}, defaultOptions, options)

    const validateOption = param => {
      if( !(param in this.options) || !this.options[param] ) {
        throw new Error(`Did not get required parameter: ${param} in constructor`)
      }
    }

    validateOption('accessKey')
    validateOption('secretKey')
    validateOption('bucket')

    // Translate passed in params to S3 constructor params.
    let constructorOptions = {
      accessKeyId: this.options.accessKey,
      secretAccessKey: this.options.secretKey,
      params: {
        Bucket: this.options.bucket,
      },
    }

    // If s3Options is provided, merge it with our constructorOptions object and create S3 object
    if( 's3Options' in this.options ) {
      if( typeof this.options.s3Options !== 'object' || this.options.s3Options === null ) {
        throw new Error('Expected an object for s3Options!')
      }

      // If params is in the provided options object, manually merge them
      // Otherwise this isn't a deep merge.
      if( 'params' in this.options.s3Options ) {
        this.options.s3Options.params = Object.assign(constructorOptions.params, this.options.s3Options.params)
      }

      Object.assign(constructorOptions, this.options.s3Options)
    }

    this.s3 = new S3(constructorOptions)

    // Setup logging
    if( 'S3CACHE_LOGLEVEL' in process.env && process.env.S3CACHE_LOGLEVEL ) {
      this.options.logLevel = process.env.S3CACHE_LOGLEVEL
    }

    log.setLevel(this.options.logLevel)
    prefix.reg(log)

    prefix.apply(log, {
      format(level, name, timestamp) {
        return `${chalk.gray(`[${timestamp}]`)} ${logColors[level.toUpperCase()](level)} ${chalk.green(`${name}:`)}`
      },
    })

    this._log = ['get', 'set', 'keys', 'head', 'ttl', 'del', 'reset', 'normalizePath', 'timestampToMoment', 'stringifyResponse']
      .reduce((memo, type) => {
        // Create the logger
        Object.assign(memo, {[type]: log.getLogger(type)})

        // Look for an environment variable with this logger's name to set level
        if( `S3CACHE_${type.toUpperCase()}_LOGLEVEL` in process.env && process.env[`S3CACHE_${type.toUpperCase()}_LOGLEVEL`] ) {
          memo[type].setLevel(process.env[`S3CACHE_${type.toUpperCase()}_LOGLEVEL`])
        } else {
          memo[type].setLevel(this.options.logLevel)
        }

        return memo
      }, {})
  }

  /**
   * Parses str as a URL, then sorts query parameters if {@link constructor.options.normalizeUrl} is true
   * @private
   * @param  {string} str                    - The input string
   * @param  {Object} [options=this.options] - Override options for the class
   * @return {string}                        - The input string, normalized.
   */
  _normalizeUrl(str, options = this.options) {
    const request = url.parse(str)

    if( options.normalizeUrl ) {
      if( request.search !== null ) {
        // Sort query parameters -- slice off the leading ?
        const params = querystring.parse(request.search.slice(1))

        // Sort param keys
        request.search = Object.keys(params).sort().map(key =>
          querystring.stringify({[key]: params[key]})
        ).join('&')
      }
    }

    return url.format(request)
  }

  /**
   * Parses str as a path, then normalizes it if {@link constructor.options.normalizePath} is true
   * @private
   * @param  {string} str                    - The input string
   * @param  {Object} [options=this.options] - Override options for the class
   * @return {string}                        - The input string, normalized.
   */
  _normalizePath(str, options = this.options) {
    let loc = path.format(path.parse(str))

    if( options.normalizePath ) {
      loc = path.normalize(loc)
    }

    return loc
  }

  /**
   * Takes an intended path and prepares it to be used in a cache.
   * Depending on the options selected, may perform normalization on the key.
   * Will checksum and folder-chunk the path to make caching more efficient.
   * May prefix the key if {@link constructor.options.pathPrefix} is set.
   * Uses {@link _normalizeUrl} and {@link _normalizePath} if their respective options are set.
   * @param  {string} pathName               - The input key
   * @param  {Object} [options=this.options] - Override options for the class
   * @return {string}                        - The input key, as an S3-ready path.
   */
  _getPath(pathName, options = this.options) {
    let key = pathName

    // Perform any normalization needed before we checksum
    if( options.normalizeLowercase ) {
      key = key.toLowerCase()
    }

    if( options.parseKeyAsUrl ) {
      key = this._normalizeUrl(key, options)
    } else if( options.parseKeyAsPath ) {
      key = this._normalizePath(key, options)
    }

    if( options.normalizeLowercase || options.parseKeyAsUrl || options.parseKeyAsPath ) {
      this._log.normalizePath.debug('Path normalized:', key)
    }

    // Checksum the path to remove all potentially bad characters
    if( options.checksumAlgorithm !== 'none' ) {
      key = checksum(key, {
        algorithm: options.checksumAlgorithm,
        encoding: options.checksumEncoding,
      })
    } else if( options.checksumEncoding === 'base64' ) {
      key = Buffer.from(key).toString('base64')
    }

    // Add a folder structure based on the hash.
    const urlChunks = []
    for( let depth = 0; depth < options.folderPathDepth; depth++ ) {
      const begin = depth * options.folderPathChunkSize
      const end = begin + options.folderPathChunkSize
      urlChunks.push(key.slice(begin, end))
    }

    key = urlChunks.join('/') + '/' + key

    // Prefix it if desired
    if( options.pathPrefix !== '' ) {
      key = path.join(this.options.pathPrefix, key)
    }

    this._log.normalizePath.debug('Final path: ', key)
    return key
  }

  /**
   * Converts S3 responses back into a data format we want.
   * @param  {S3Response} response Incoming response object
   * @param {Object} [options=this.options] Incoming options
   * @return {string}
   */
  _stringifyResponse(response, options = this.options) {
    if( !response || !('Body' in response) ) {
      this._log.stringifyResponse.warn('Unknown response', response)
      return response
    }

    if( options.stringifyResponses ) {
      return response.Body.toString()
    }
    return response.Body
  }

  /**
   * Ensures that incoming timestamps are a Moment object.
   * @param  {string|number} timestamp
   * @return {Moment}
   */
  _timestampToMoment(timestamp) {
    this._log.timestampToMoment.trace('Timestamp being converted to moment:', timestamp)

    // Convert a Unix timestamp to milliseconds, because javascript
    if( typeof timestamp === 'number' ) {
      return moment(timestamp * 1000)
    }

    return moment(timestamp)
  }

  /**
   * get a key from the cache.
   * @param {...string|Object|function} args - Polymorphic argument to support optional parameters
   */
  get(...args) {
    const key = args.shift()
    let options, cb

    if( log.getLevel() === log.levels.TRACE ) {
      this._log.get.trace('called at:', moment().valueOf())
    }
    this._log.get.debug('called with:', key)

    if( args.length === 2 ) {
      [options, cb] = args
    } else if( args.length === 1 ) {
      if( typeof args[0] === 'function' ) {
        cb = args[0]
      } else {
        options = args[0]
      }
    }

    // Allow per-request options to override constructor options.
    const currentOptions = Object.assign({}, this.options, options)

    const requestOptions = {
      Key: this._getPath(key, currentOptions),
    }

    this._log.get.trace(
      'options components:',
      'this.options:', this.options,
      'options:', options,
      'requestOptions:', requestOptions,
    )

    // Allow 's3Options' to override request options.
    if( options && 's3Options' in options ) {
      Object.assign(requestOptions, options.s3Options)
    }

    if(!cb) {
      cb = () => {}
    }

    this._log.get.debug('final options: ', requestOptions)

    async.waterfall([
      waterCb => this.s3.getObject(requestOptions, waterCb),
      (result, waterCb) => {
        // Check the expiration. If it's dead, pretend there's nothing.
        if( 'Expires' in result && this._timestampToMoment(result.Expires).isBefore() ) {
          // If we're being proactive, delete the object.
          if( currentOptions.proactiveExpiry ) {
            this._log.get.info(key, ' is expired, deleting it')
            this.del(key, (err, result) => err ? waterCb(err, null) : waterCb(null, null))
            return
          } else {
            this._log.get.info(key, ' is expired, ignoring result')
          }

          waterCb(null, null)
          return
        }

        this._log.get.trace('get returning result:', result)
        waterCb(null, this._stringifyResponse(result, currentOptions))
      }
    ], (err, result) => {
      if( err instanceof Error && err.statusCode === 404 ) {
        this._log.get.trace(key, ' not found according to s3' )
        cb(null, null)
        return
      }

      cb(err, result)
    })
  }

  /**
   * set a key in the cache. Assumes the bucket already exists.
   * @param {...string|Object|function} args - Polymorphic argument to support optional parameters
   */
  set(...args) {
    const key = args.shift()
    const value = args.shift()
    let options, cb

    if( log.getLevel() === log.levels.TRACE ) {
      this._log.set.trace('called at:', moment().valueOf(), 'with value: ', value)
    }
    this._log.set.debug('called with:', key)

    if( args.length === 2 ) {
      [options, cb] = args
    } else if( args.length === 1 ) {
      if( typeof args[0] === 'function' ) {
        cb = args[0]
      } else {
        options = args[0]
      }
    }

    // Allow per-request options to override constructor options.
    const currentOptions = Object.assign({}, this.options, options)

    const requestOptions = {
      Key: this._getPath(key, currentOptions),
      ACL: currentOptions.acl,
      ContentType: currentOptions.contentType,
    }

    // Coerce the value into a buffer. This ensures binary or unicode data is safe
    if( value instanceof Buffer ) {
      requestOptions.Body = value
    } else {
      requestOptions.Body = Buffer.from(value)
    }

    if( currentOptions.ttl ) {
      requestOptions.Expires = moment().add(currentOptions.ttl, currentOptions.ttlUnits).unix()
      this._log.set.debug(key, ' expires at ' + requestOptions.Expires)
    }

    this._log.set.trace(
      'options components:',
      'this.options:', this.options,
      'options:', options,
      'requestOptions:', requestOptions,
    )

    // Allow 's3Options' to override request options.
    if( options && 's3Options' in options ) {
      Object.assign(requestOptions, options.s3Options)
    }

    this._log.set.debug('final options: ', requestOptions)

    const request = this.s3.putObject(requestOptions, cb)

    if( !cb ) {
      request.send()
    }
  }

  /**
   * delete a key in the cache.
   * @param {...string|Object|function} args - Polymorphic argument to support optional parameters
   */
  del(...args) {
    const key = args.shift()
    let options, cb

    if( log.getLevel() === log.levels.TRACE ) {
      this._log.del.trace('called at:', moment().valueOf())
    }
    this._log.del.debug('called with:', key)

    if( args.length === 2 ) {
      [options, cb] = args
    } else if( args.length === 1 ) {
      if( typeof args[0] === 'function' ) {
        cb = args[0]
      } else {
        options = args[0]
      }
    }

    // Allow per-request options to override constructor options.
    // uncomment this if I ever use this.options, use this obj instead
    // const currentOptions = Object.assign({}, this.options, options)

    const requestOptions = {
      Key: this._getPath(key),
      // Key: this._getPath(key, currentOptions),
    }

    this._log.del.trace(
      'options components:',
      'this.options:', this.options,
      'options:', options,
      'requestOptions:', requestOptions,
    )

    // Allow 's3Options' to override request options.
    if( options && 's3Options' in options ) {
      Object.assign(requestOptions, options.s3Options)
    }

    this._log.del.debug('final options: ', requestOptions)

    const request = this.s3.deleteObject(requestOptions, cb)

    if(!cb) {
      request.send()
    }
  }

  /**
   * Get a list of objects from the cache. This function is sort of pointless because of hashing.
   * @param {...string|Object|function} args - Polymorphic argument to support optional parameters
   */
  keys(...args) {
    const cb = args.pop()
    let key, options

    if( log.getLevel() === log.levels.TRACE ) {
      this._log.keys.trace('called at:', moment().valueOf())
    }
    this._log.keys.debug('called with:', key)

    if( args.length === 2 ) {
      [key, options] = args
    } else if( args.length === 1 ) {
      if( typeof args[0] === 'object' ) {
        options = args[0]
      } else {
        key = args[0]
      }
    }

    // Allow per-request options to override constructor options.
    const currentOptions = Object.assign({}, this.options, options)

    const requestOptions = {}

    // This is pointless since the hashing will never allow this to work.
    // if( key ) {
    //   requestOptions.Prefix = key
    // }

    // Allow 's3Options' to override request options.
    if( options && 's3Options' in options ) {
      Object.assign(requestOptions, options.s3Options)
    }

    this._log.keys.debug('final options: ', requestOptions)

    // Grab all keys via pagination
    let ContinuationToken = false
    // Doing this with an external value because doWhilst seems to treat arrays wrong
    const finalResults = []
    async.doWhilst(whilstCb => {
      const thisLoopOptions = Object.assign({}, requestOptions)
      if( ContinuationToken ) {
        this._log.keys.trace('got continuation token: ', ContinuationToken)
        thisLoopOptions.ContinuationToken = ContinuationToken
      }

      this.s3.listObjectsV2(thisLoopOptions, (err, results) => {
        if( err ) {
          whilstCb(err)
          return
        }

        if( results.IsTruncated ) {
          ContinuationToken = results.NextContinuationToken
        } else {
          ContinuationToken = false
        }

        finalResults.push(results.Contents)
        whilstCb()
      })
    }, () => ContinuationToken !== false, err => {
      if( err ) {
        cb(err)
        return
      }

      // Secret option for optimizing reset() a little
      if( currentOptions.dontConcatPages ) {
        this._log.keys.debug('not concatenating pages')
        cb(null, finalResults)
        return
      }

      if( finalResults.length === 1 ) {
        this._log.keys.debug('single page result')
        cb(null, finalResults[0])
        return
      }

      // Concatenate all results
      this._log.keys.debug('concatenating page results')
      cb(null, finalResults.reduce((memo, arr) => memo.concat(arr), []))
    })
  }

  /**
   * Get the metadata of a particular object
   * @param {...string|Object|function} args - Polymorphic argument to support optional parameters
   */
  head(...args) {
    let options
    const key = args.shift()
    const cb = args.pop()

    if( log.getLevel() === log.levels.TRACE ) {
      this._log.keys.trace('called at:', moment().valueOf())
    }
    this._log.keys.debug('called with:', key)

    if( args.length === 1 ) {
      options = args[0]
    }

    // Allow per-request options to override constructor options.
    // uncomment this if I ever use this.options, use this obj instead
    // const currentOptions = Object.assign({}, this.options, options)

    const requestOptions = {
      Key: this._getPath(key),
      // Key: this._getPath(key, currentOptions),
    }

    // Allow 's3Options' to override request options.
    if( options && 's3Options' in options ) {
      Object.assign(requestOptions, options.s3Options)
    }

    this._log.keys.debug('final options: ', requestOptions)

    this.s3.headObject(requestOptions, cb)
  }

  /**
   * Get the ttl time of a particular object
   * @param {...string|Object|function} args - Polymorphic argument to support optional parameters
   */
  ttl(...args) {
    const cb = args.pop()

    this.head(...args, (err, result) => {
      if( !err && 'Expires' in result ) {
        cb(null, this._timestampToMoment(result.Expires).unix())
        return
      }

      cb(err, -1)
    })
  }

  /**
   * Empties the entire bucket. Definitely a function to use with caution.
   * Uses a secret option on {@link keys}, called dontConcatPages, to make the
   * API a little happier.
   * @param {Function} cb The callback.
   */
  reset(cb) {
    this._log.reset.warn('Resetting bucket!')
    async.waterfall([
      waterCb => this.keys({dontConcatPages: true}, waterCb),
      (results, waterCb) => async.mapLimit(results, 2, (dataset, mapCb) => {
        if( dataset.length === 0 ) { mapCb(); return }
        this.s3.deleteObjects({
          Delete: {
            // deleteObjects does not accept any parameters except key and version
            Objects: dataset.map(({Key, VersionId}) => ({Key, VersionId})),
          },
        }, mapCb)
      }, waterCb)
    ], cb)
  }

  // TODO: implement setex function? make a copy of the object since S3 is weird
}

module.exports = S3Cache
