class UnexpectedParameter extends Error {}

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

		// Initialize Bucket before putting key
		if( !(params.Bucket in this.cache) ) {
			this.cache[params.Bucket] = {}
		}

		this._log('getObject', params)

		if( 'PleaseBreakApi' in params ) {
			cb(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"), null)
			return
		}

		const err = this._checkPath(params, true, true)

		if( err instanceof Error ) {
			cb(err, null)
			return
		}

		// Convert the object data into a Buffer before sending
		const responseObject = Object.assign({}, this.cache[params.Bucket][params.Key])
		responseObject.Body = Buffer.from(responseObject.Body)

		cb(err, responseObject)
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

		if( 'PleaseBreakApi' in params ) {
			cb(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"), null)
			return
		}

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

	listObjectsV2(inputParams = {}, cb) {
		const params = this._mergeParams(inputParams)

		if( Object.keys(params).length === 0 ) {
			this._log('No params provided to listObjects, returning')
			cb()
			return
		}
		this._log('listObjects', params)

		if( !(params.Bucket in this.cache) ) {
			cb(null, {Contents: []})
			return
		}

		if( 'PleaseBreakApi' in params ) {
			cb(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"), null)
			return
		}

		let results = Object.values(this.cache[params.Bucket])

		// Filter the results by key if requested.
		if( 'Prefix' in params ) {
			results = results.filter(x => x.Key.startsWith(params.Prefix))
		}

		const returnedStuff = {Contents: results}

		// Slice the array if we're "continuing"
		if( results.length > 1000 ) {
			let sliceBegin = 0
			if( params.ContinuationToken ) {
				sliceBegin = params.ContinuationToken
			}

			let sliceEnd = Math.min(sliceBegin + 1000, results.length)
			returnedStuff.Contents = results.slice(sliceBegin, sliceEnd)
			returnedStuff.NextContinuationToken = sliceEnd

			if( sliceEnd < results.length ) {
				returnedStuff.IsTruncated = true
			}
		}

		cb(null, returnedStuff)
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

		if( 'PleaseBreakApi' in params ) {
			cb(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"), null)
			return
		}

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

	deleteObjects(inputParams = {}, cb) {
		const params = this._mergeParams(inputParams)
		if( !cb ) {
			cb = () => {}
		}

		if( Object.keys(params).length === 0 ) {
			this._log('No params provided to deleteObjects, returning')
			cb()
			return
		}
		this._log('deleteObjects', params)

		if( 'PleaseBreakApi' in params ) {
			cb(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"), null)
			return
		}

		let err = null

		for( let i = 0; i < params.Delete.Objects.length; i++ ) {
			err = this._checkPath(params.Delete.Objects[i])

			if( err instanceof Error ) {
				cb(err, null)
				return
			}

			if( params.Delete.Objects[i].Key in this.cache[params.Bucket] ) {
				delete this.cache[params.Bucket][params.Key]
			}
		}

		cb(err, {})
		return {send: () => {}}
	}

	headObject(inputParams = {}, cb) {
		if( !cb ) {
			cb = () => {}
		}

		if( 'PleaseBreakApi' in inputParams ) {
			cb(new UnexpectedParameter("Unexpected key 'PleaseBreakApi' found in params"), null)
			return
		}

		this.getObject(inputParams, (err, result) => {
			if( result ) {
				delete result.Body
				delete result.Key
			}

			cb(err, result)
		})
		return {send: () => {}}
	}
}

if( process.env.USE_REAL_AWS && (process.env.USE_REAL_AWS === 'true' || process.env.USE_REAL_AWS === true) ) {
	module.exports = require.requireActual('aws-sdk')
} else {
	module.exports = {S3}
}
