const path = require('path')
const url = require('url')
const querystring = require('querystring')
const checksum = require('checksum')
const moment = require('moment')
const S3 = require('aws-sdk').S3

const defaultOptions = {
	expiry: false,
	expiryUnits: 'hours',
	acl: 'private',
	contentType: 'text/html;charset=UTF-8',
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
}

class S3Cache {
	constructor(options = {}) {
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

	_log(message) {
		if( this.options.debug ) {
			console.log(message)
		}
	}

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

	_normalizePath(str) {
		let loc = path.format(path.parse(str))

		if( this.options.normalizePath ) {
			loc = path.normalize(loc)
		}

		return loc
	}

	_getPath(pathName) {
		let key = pathName

		// Perform any normalization needed before we checksum
		if( this.options.normalizeLowercase ) {
			key = key.toLowercase()
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
			urlChunks.push(key.slice(depth * this.options.folderPathChunkSize, this.options.folderPathChunkSize))
		}

		key = urlChunks.join('/') + '/' + key

		// Prefix it if desired
		if( this.options.pathPrefix !== '' ) {
			key = path.join(this.options.pathPrefix, key)
		}

		this._log(`Final path: ${key}`)
		return key
	}

	get(key, callback) {
		this._log(`Getting key: ${key}`)

		this.s3.getObject({
			Key: this._getPath(key),
		}, callback)
	}

	set(key, value, callback) {
		this._log(`Setting key: ${key}`)
		const requestOptions = {
			Key: this._getPath(key),
			ACL: this.options.acl,
			ContentType: this.options.contentType,
			Body: value,
		}

		if( this.options.expiry ) {
			requestOptions.Expires = moment().add(this.options.expiry, this.options.expiryUnits).unix()
			this._log('Adding object expires at ' + requestOptions.Expires)
		}

		const request = this.s3.putObject(requestOptions, callback)

		if(!callback) {
			request.send()
		}
	}
}

module.exports = S3Cache
