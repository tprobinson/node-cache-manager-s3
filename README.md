# node-cache-manager-s3

A [cache-manager](https://github.com/BryanDonovan/node-cache-manager) module for storing results in S3.

<!-- MDTOC maxdepth:6 firsth1:1 numbering:0 flatten:0 bullets:1 updateOnSave:1 -->

- [node-cache-manager-s3](#node-cache-manager-s3)   
- [Usage](#Usage)   
   - [Common Options](#Common-Options)   
      - [Setting a default TTL](#Setting-a-default-TTL)   
      - [Storing all cache objects under a parent folder](#Storing-all-cache-objects-under-a-parent-folder)   
      - [Optimizing cache hits](#Optimizing-cache-hits)   
   - [Overriding options per-request](#Overriding-options-per-request)   
   - [Changing S3 Options](#Changing-S3-Options)   
      - [Specifying S3 Region](#Specifying-S3-Region)   
      - [Using an HTTP proxy](#Using-an-HTTP-proxy)   
- [Full Options List](#Full-Options-List)   
- [Known Issues / TODO](#Known-Issues-TODO)   
- [License](#License)   

<!-- /MDTOC -->

# Usage

Create the cache object and use it in your cache-manager:
```js
const cacheManager = require('cache-manager');
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
})

const s3Cache = cacheManager.caching({
	store: s3CacheStore,
})

s3Cache.set('foo', 'bar', {ttl: 360}, (err) => {
    if (err) { throw err; }

    s3Cache.get('foo', (err, result) => {
				if (err) { throw err; }
        console.log(result);
        // >> 'bar'
        s3Cache.del('foo');
    });
});
```

If you need no further configuration, then you're done!

## Common Options

This store comes with a number of options for convenience, as well as transparency to the underlying S3 API.

Here are some common use cases:

### Setting a default TTL
```js
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
  ttl: 360,
})

// or, in hours:

const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
  ttl: 12,
  ttlUnits: 'hours',
})
```

Keep in mind that setting the ttlUnits in this way will not be set back to 'seconds' if you specify only `ttl` for an individual request.

### Storing all cache objects under a parent folder
```js
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
  pathPrefix: 'cacheForApplicationOne',
})
```

### Optimizing cache hits

This store provides some options for optimizing cache hits by normalizing input key names. While it can be used for anything, there are special cases for storing file paths or URLs. `normalizeLowercase` will generically set all keys to be lowercase.

When storing URLs, `parseKeyAsUrl` will ensure that slashes are consistently formatted. `normalizeUrl` will sort query parameters if they exist.

```js
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
  normalizeLowercase: true,
  parseKeyAsUrl: true,
  normalizeUrl: true,
})
```

When storing paths, `parseKeyAsPath` will resolve minor formatting weirdness. `normalizePath` will use [`path.normalize`](https://nodejs.org/api/path.html#path_path_normalize_path) on any keys, resolving subdirectories as well as removing adjacent slashes.

Unless you know for sure that you have no case conflicts on your paths, `normalizeLowercase` is not recommended for paths.

```js
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
  parseKeyAsPath: true,
  normalizePath: true,
})
```

## Overriding options per-request

Options can be overridden per-request. Just specify in the options object of each request.

```js
// Default TTL of 5 minutes
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
  ttl: 360,
})

// Set this object with 10 minute TTL
s3CacheStore.set('key', 'value', {ttl: 600})
```

S3 options can also be specified on individual requests via `s3Options`.

Note that the object passed in will be applied to only the request-- it cannot influence the constructor params, and so it does not need 'params'.
```js
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
	s3Options: {
		region: 'us-west-2',
	},
})

s3CacheStore.get('key', {
  s3Options: {
    Bucket: 'some-other-bucket',
  },
})
```

## Changing S3 Options
Anything specified in the `s3Options` object in the constructor is passed to the [S3 constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property)


### Specifying S3 Region
```js
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
	s3Options: {
		region: 'us-west-2',
	},
})
```

### Using an HTTP proxy
```js
const s3CacheStore = new S3Cache({
	accessKey: 'AAAAAAAA',
	secretKey: 'asdnbklajsndkj',
	bucket: 'my-cache-bucket',
	s3Options: {
		httpOptions: {
			proxy: 'http://my.proxy:3128'
		}
	},
})
```


# Full Options List

| Name      | Default  | Description |
| --------- | -------- | ----------- |
| accessKey | required | An AWS access key |
| secretKey | required | An AWS secret key |
| bucket | required | The bucket to store in. |
| ttl | None | Paired with `ttlUnits`, amount in the future to set an object to expire. Can also be an Object, as supported by [Moment](http://momentjs.com/docs/#/manipulating/add/). |
| ttlUnits | seconds | Paired with `ttl`, this is the unit of time to set an object to expire. |
| pathPrefix | None | If specified, all cache objects will be placed under this folder. Slashes are not necessary (unless for a nested folder) |
| folderPathDepth | 2 | The number of folders to chunk checksummed names into. Increases performance by nesting objects into folders. Set to 0 to disable. |
| folderPathChunkSize | 2 | The number of characters to use in each folder path chunk. |
| checksumAlgorithm | md5 | The digest algorithm to use when checksumming. Supports any OpenSSL digest (use `openssl list -digest-algorithms`) |
| checksumEncoding | hex | The encoding to use for the digest. Valid values (as of this writing) are 'hex', 'latin1', and 'base64'. [Node docs](https://nodejs.org/api/crypto.html#crypto_hash_digest_encoding) |
| normalizeLowercase | false | When normalizing, should the key be lowercased first? If using URLs, probably true. If using paths, probably false. |
| parseKeyAsPath | false | Should the key be parsed as a path for normalization? |
| normalizePath | true | If the key is parsed as a path, should we normalize it? (uses path.normalize) |
| parseKeyAsUrl | false | Should the key be parsed as a URL for normalization? |
| normalizeUrl | true | If the key is parsed as a URL, should we normalize it? (sorts query parameters) |
| proactiveExpiry | false | If a key is marked as expired when we encounter it, should we delete it? Causes an additional request, but keeps the cache cleaner in case of `keys()` |
| s3Options | None | An object passed into the [S3 constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property). |
| s3Options.params | fill | An object passed into the [S3 constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property). Parameters in here are included with every request to S3. Good for options like 'region'. |


# Known Issues / TODO

[ ] implement reset function?
[ ] implement setex function?

# License

[MIT](https://www.tldrlegal.com/l/mit)
