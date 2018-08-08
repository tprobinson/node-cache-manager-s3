/** @module S3Cache */
const path = require('path')
const url = require('url')
const querystring = require('querystring')
const checksum = require('checksum')
const moment = require('moment')
const S3 = require('aws-sdk').S3

const defaultOptions = {
	debug: false,
	ttl: 0,
	ttlUnits: 'seconds',
	pathPrefix: '',

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
 * 	accessKey: 'AAAAAAAA',
 * 	secretKey: 'asdnbklajsndkj',
 * 	bucket: 'my-cache-bucket',
 * 	ttl: 1, ttlUnits: 'hours',
 * 	s3Options: {
 * 		region: 'us-west-2',
 * 		httpOptions: {
 * 			proxy: 'http://my.proxy:3128'
 * 		},
 * 		params: {
 * 			ACL: 'authenticated-read',
 * 		},
 * 	},
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
	 * @param {number|Object} [options.ttl]             - Paired with {@link options.ttlUnits}, amount in the future to set an object to expire. Can also be an Object, as supported by Moment.
	 * @param {string} [options.ttlUnits=seconds]       - Paired with {@link options.ttl}, this is the unit of time to set an object to expire.
	 * @see http://momentjs.com/docs/#/manipulating/add/
	 *
	 * @param {string} [options.pathPrefix]                - If specified, all cache objects will be placed under this folder. Slashes are not necessary (unless for a nested folder)
	 * @param {number} [options.folderPathDepth=2]         - The number of folders to chunk checksummed names into. Increases performance by nesting objects into folders. Set to 0 to disable.
	 * @param {number} [options.folderPathChunkSize=2]     - The number of characters to use in each folder path chunk.
	 *
	 * @param {string} [options.checksumAlgorithm=md5]         - The digest algorithm to use when checksumming. Supports any OpenSSL digest (use `openssl list -digest-algorithms`)
	 * @param {string} [options.checksumEncoding=hex]          - The encoding to use for the digest. Valid values (as of this writing) are 'hex', 'latin1', and 'base64'.
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

		// If s3Options is provided, merge it with our constructorOptions object.
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
	}

	/**
	 * A simple debug logging function. Triggered by {@link constructor.option.debug}
	 * @private
	 * @param  {[type]} message - The message to log.
	 */
	_log(message) {
		if( this.options.debug ) {
			console.log(message)
		}
	}

	/**
	 * Parses str as a URL, then sorts query parameters if {@link constructor.options.normalizeUrl} is true
	 * @private
	 * @param  {string} str - The input string
	 * @return {string}     - The input string, normalized.
	 */
	_normalizeUrl(str) {
		const request = url.parse(str)

		if( this.options.normalizeUrl ) {
			if( request.search !== null ) {
				// Sort query parameters.
				const params = querystring.parse(request.search)

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
	 * @param  {string} str - The input string
	 * @return {string}     - The input string, normalized.
	 */
	_normalizePath(str) {
		let loc = path.format(path.parse(str))

		if( this.options.normalizePath ) {
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
	 * @param  {string} pathName - The input key
	 * @return {string}          - The input key, as an S3-ready path.
	 */
	_getPath(pathName) {
		let key = pathName

		// Perform any normalization needed before we checksum
		if( this.options.normalizeLowercase ) {
			key = key.toLowerCase()
		}

		if( this.options.parseKeyAsUrl ) {
			key = this._normalizeUrl(key)
		} else if( this.options.parseKeyAsPath ) {
			key = this._normalizePath(key)
		}

		if( this.options.normalizeLowercase || this.options.parseKeyAsUrl || this.options.parseKeyAsPath ) {
			this._log(`Path normalized: ${key}`)
		}

		// Checksum the path to remove all potentially bad characters
		key = checksum(key, {
			algorithm: this.options.checksumAlgorithm,
			encoding: this.options.checksumEncoding,
		})

		// Add a folder structure based on the hash.
		const urlChunks = []
		for( let depth = 0; depth < this.options.folderPathDepth; depth++ ) {
			const begin = depth * this.options.folderPathChunkSize
			const end = begin + this.options.folderPathChunkSize
			urlChunks.push(key.slice(begin, end))
		}

		key = urlChunks.join('/') + '/' + key

		// Prefix it if desired
		if( this.options.pathPrefix !== '' ) {
			key = path.join(this.options.pathPrefix, key)
		}

		this._log(`Final path: ${key}`)
		return key
	}

	/**
	 * get a key from the cache.
	 * @param {...string|Object|function} args                   - Polymorphic argument to support optional parameters
	 */
	get(...args) {
		const key = args.shift()
		let options, cb

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

		this._log(`Getting key: ${key}`)
		const requestOptions = {
			Key: this._getPath(key),
		}

		// Allow 's3Options' to override request options.
		if( options && 's3Options' in options ) {
			Object.assign(requestOptions, options.s3Options)
		}

		this.s3.getObject(requestOptions, (err, result) => {
			if(!cb) {
				cb = () => {}
			}

			// Check the expiration. If it's dead, pretend there's nothing.
			if( !err && 'Expires' in result && moment.unix(result.Expires).isBefore() ) {
				// If we're being proactive, delete the object.
				if( currentOptions.proactiveExpiry ) {
					this._log('Object is expired, deleting it')
					this.del(key, (err, result) => err ? cb(err, null) : cb(null, null))
					return
				} else {
					this._log('Object is expired, ignoring result')
				}

				cb(null, null)
				return
			}

			cb(err, result)
		})
	}

	/**
	 * set a key in the cache. Assumes the bucket already exists.
	 * @param {...string|Object|function} args                   - Polymorphic argument to support optional parameters
	 */
	set(...args) {
		const key = args.shift()
		const value = args.shift()
		let options, cb

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

		this._log(`Setting key: ${key}`)
		const requestOptions = {
			Key: this._getPath(key),
			ACL: currentOptions.acl,
			ContentType: currentOptions.contentType,
			Body: value,
		}

		if( currentOptions.ttl ) {
			requestOptions.Expires = moment().add(currentOptions.ttl, currentOptions.ttlUnits).unix()
			this._log('Adding object expires at ' + requestOptions.Expires)
		}

		// Allow 's3Options' to override request options.
		if( options && 's3Options' in options ) {
			Object.assign(requestOptions, options.s3Options)
		}

		const request = this.s3.putObject(requestOptions, cb)

		if( !cb ) {
			request.send()
		}
	}

	/**
	 * delete a key in the cache.
	 * @param {...string|Object|function} args                   - Polymorphic argument to support optional parameters
	 */
	del(...args) {
		const key = args.shift()
		let options, cb

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

		this._log(`Deleting key: ${key}`)

		const requestOptions = {
			Key: this._getPath(key),
		}

		// Allow 's3Options' to override request options.
		if( options && 's3Options' in options ) {
			Object.assign(requestOptions, options.s3Options)
		}

		const request = this.s3.deleteObject(requestOptions, cb)

		if(!cb) {
			request.send()
		}
	}

	/**
	 * Get a list of objects from the cache. This function is sort of pointless because of hashing.
	 * @param {...string|Object|function} args                   - Polymorphic argument to support optional parameters
	 */
	keys(...args) {
		const cb = args.pop()
		let key, options

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
		// uncomment this if I ever use this.options, use this obj instead
		// const currentOptions = Object.assign({}, this.options, options)

		this._log(`Enumerating keys by pattern: ${key}`)
		const requestOptions = {}

		// This is pointless since the hashing will never allow this to work.
		// if( key ) {
		// 	requestOptions.Prefix = key
		// }

		// Allow 's3Options' to override request options.
		if( options && 's3Options' in options ) {
			Object.assign(requestOptions, options.s3Options)
		}

		// TODO: implement longer than 1000 key retrieval
		this.s3.listObjects(requestOptions, cb)
	}

	/**
	 * Get the ttl time of a particular object
	 * @param {...string|Object|function} args            - Polymorphic argument to support optional parameters
	 */
	ttl(...args) {
		let options
		const key = args.shift()
		const cb = args.pop()

		if( args.length === 1 ) {
			options = args[0]
		}

		// Allow per-request options to override constructor options.
		// uncomment this if I ever use this.options, use this obj instead
		// const currentOptions = Object.assign({}, this.options, options)

		this._log(`Getting TTL on key: ${key}`)

		const requestOptions = {
			Key: this._getPath(key),
		}

		// Allow 's3Options' to override request options.
		if( options && 's3Options' in options ) {
			Object.assign(requestOptions, options.s3Options)
		}

		this.s3.headObject(requestOptions, (err, result) => {
			if( !err && 'Expires' in result ) {
				cb(null, result.Expires)
				return
			}

			cb(err, -1)
		})
	}

	// TODO: implement reset function? clear the whole cache?
	// TODO: implement setex function? make a copy of the object since S3 is weird
}

module.exports = S3Cache
