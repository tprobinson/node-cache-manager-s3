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

module.exports = {
	largeRandomOptions,

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

	debugLogFunc(debugMockCache) {
		return message => {
			if( debugMockCache ) {
				console.log(message)
			}
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
