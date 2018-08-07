class S3 {
	constructor(config) {
		this.config = config
		this.cache = {}
	}

	_log(message) {
		if( this.config.debug ) {
			console.log(message)
		}
	}

	_mergeParams(params) {
		return Object.assign({}, this.config.params, params)
	}

	_checkPath(params, bucketMustExist = false, keyMustExist = false) {
		if( !('Bucket' in params) ) {
			return new Error('No bucket specified!')
		}

		if( bucketMustExist && !(params.Bucket in this.cache) ) {
			return new Error(`Requested bucket: ${params.Bucket} does not exist!`)
		}

		if( keyMustExist && !(params.Key in this.cache[params.Bucket]) ) {
			return new Error(`Requested key: ${params.Key} in bucket: ${params.Bucket} does not exist!`)
		}

		// Check to make sure this path is a sane one.
		const path = params.Key
		if( typeof path !== 'string' ) {
			return new Error('Path is not a string!')
		}

		if( Buffer.from(path).length > 1024 ) {
			return new Error('Path is more than 1024 bytes long!')
		}

		if( /\/\//.test(path) ) {
			return new Error('Path contains adjacent slashes, behavior is unknown!')
		}

		if( /[&$@=;:+,?\s]/.test(path) ) {
			return new Error('Path contains potentially special characters, needs encoding!')
		}

		/* eslint-disable-next-line no-control-regex */
		if( /[\u0000-\u001F\u007f-\u00A0]/.test(path) ) {
			return new Error('Path contains unprintable characters, needs encoding!')
		}

		return null
	}

	getObject(inputParams = {}, cb) {
		const params = this._mergeParams(inputParams)

		if( Object.keys(params).length === 0 ) {
			this._log('No params provided to getObject, returning')
			cb()
			return
		}
		this._log('getObject', params)
		const err = this._checkPath(params, true, true)

		if( err instanceof Error ) {
			cb(err, null)
			return
		}

		cb(err, this.cache[params.Bucket][params.Key])
	}

	putObject(inputParams = {}, cb) {
		const params = this._mergeParams(inputParams)

		if( Object.keys(params).length === 0 ) {
			this._log('No params provided to putObject, returning')
			cb()
			return
		}
		this._log('putObject', params)
		const err = this._checkPath(params)

		if( err instanceof Error ) {
			cb(err, null)
			return
		}

		// Initialize Bucket before putting key
		if( !(params.Bucket in this.cache) ) {
			this.cache[params.Bucket] = {}
		}

		this.cache[params.Bucket][params.Key] = params
		cb(err, null)
	}

	resetCache() {
		this.cache = {}
	}
}

module.exports = {S3}
