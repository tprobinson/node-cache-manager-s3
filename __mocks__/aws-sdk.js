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
			const err = new Error('NoSuchKey: The specified key does not exist.')
			err.statusCode = 404
			return err
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
		if( !cb ) {
			cb = () => {}
		}

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
		return {send: () => {}}
	}

	putObject(inputParams = {}, cb) {
		const params = this._mergeParams(inputParams)
		if( !cb ) {
			cb = () => {}
		}

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
		return {send: () => {}}
	}

	listObjects(inputParams = {}, cb) {
		const params = this._mergeParams(inputParams)

		if( Object.keys(params).length === 0 ) {
			this._log('No params provided to listObjects, returning')
			cb()
			return
		}
		this._log('listObjects', params)

		let results = []
		if( params.Bucket in this.cache ) {
			results = this.cache[params.Bucket]
		}

		if( 'Prefix' in params ) {
			cb(null, Object.values(results).filter(x => x.Key.startsWith(params.Prefix)))
			return
		}

		cb(null, Object.values(results))
		return {send: () => {}}
	}

	deleteObject(inputParams = {}, cb) {
		const params = this._mergeParams(inputParams)
		if( !cb ) {
			cb = () => {}
		}

		if( Object.keys(params).length === 0 ) {
			this._log('No params provided to deleteObject, returning')
			cb()
			return
		}
		this._log('deleteObject', params)
		const err = this._checkPath(params)

		if( err instanceof Error ) {
			cb(err, null)
			return
		}

		if( params.Key in this.cache[params.Bucket] ) {
			delete this.cache[params.Bucket][params.Key]
		}

		cb(err, {})
		return {send: () => {}}
	}

	headObject(inputParams = {}, cb) {
		if( !cb ) {
			cb = () => {}
		}

		this.getObject(inputParams, (err, result) => {
			if( result ) {
				delete result.body
			}

			cb(err, result)
		})
		return {send: () => {}}
	}

	resetCache() {
		this.cache = {}
	}
}

module.exports = {S3}
