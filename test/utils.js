const url = require('url')
const random = require('random-words')

const camelCase = (word, index) =>
	index !== 0
		? word.slice(0, 1).toUpperCase().concat(word.slice(1))
		: word

const largeRandomOptions = {
	exactly: 1,
	wordsPerString: 3,
	separator: '',
	formatter: camelCase,
	join: ', ',
}

let debugFuncActive = false

// Determine whether we're using real params or random junk for the mock.
const constructorParams = {}
if( process.env.USE_REAL_AWS && (process.env.USE_REAL_AWS === 'true' || process.env.USE_REAL_AWS === true) ) {
	if(
		!('AWS_ACCESS_KEY' in process.env) ||
		!('AWS_SECRET_KEY' in process.env) ||
		!('AWS_S3_BUCKET' in process.env)
	) {
		throw new Error('Required variables not found: AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_S3_BUCKET')
	}

	constructorParams.accessKey = process.env.AWS_ACCESS_KEY
	constructorParams.secretKey = process.env.AWS_SECRET_KEY
	constructorParams.bucket = process.env.AWS_S3_BUCKET
} else {
	constructorParams.accessKey = random(largeRandomOptions)
	constructorParams.secretKey = random(largeRandomOptions)
	constructorParams.bucket = random(largeRandomOptions)
}

if( process.env.S3CACHE_DEBUG_TESTS && (process.env.S3CACHE_DEBUG_TESTS === 'true' || process.env.S3CACHE_DEBUG_TESTS === true) ) {
	debugFuncActive = true
}

module.exports = {
	largeRandomOptions,
	constructorParams,

	toBeInRange(received, from, to) {
		if( from === undefined || from === null || to === undefined || to === null ) {
			throw new Error('Expected two arguments: from, to')
		}

		if( from <= received && received <= to ) {
			return {
				message: () => `expected ${received} not to be within ${from} - ${to}`,
				pass: true,
			}
		}

		return {
			message: () => `expected ${received} to be within ${from} - ${to}`,
			pass: false,
		}
	},

	randomizeCase(string) {
		return string.split('').map((char, index) =>
			// For the first character, just flip it to ensure a change.
			// After that, random.
			index === 0 || Math.random() > 0.5
				? char.toUpperCase()
				: char.toLowerCase()
		).join('')
	},

	debugLog(message) {
		if( debugFuncActive ) {
			console.log(message)
		}
	},

	getRandomUrl(poorlyFormed = false) {
		return url.format({
			protocol: 'https:',
			host: `${random(largeRandomOptions)}.${random().toLowerCase()}`,
			search: `${random()}=${random()}`,
			pathname: random() + poorlyFormed ? '/x/.././/' : '',
		})
	},

	getRandomPath(poorlyFormed = false) {
		const copyOfOptions = Object.assign({}, largeRandomOptions, {exactly: 4})
		delete copyOfOptions.join
		return random(copyOfOptions)
			.concat(
				poorlyFormed
					? ['//', '..', '.', './../!!~/.', 'file??']
					: ['file']
			)
			.join('/')
	},
}
