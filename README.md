# cache-manager-s3

A [cache-manager](https://github.com/BryanDonovan/node-cache-manager) module for storing results in S3.

<!-- TOC START min:1 max:3 link:true asterisk:false update:true -->
- [cache-manager-s3](#cache-manager-s3)
- [Usage](#usage)
  - [Common Options](#common-options)
    - [Setting a default TTL](#setting-a-default-ttl)
    - [Storing all cache objects under a parent folder](#storing-all-cache-objects-under-a-parent-folder)
    - [Optimizing cache hits](#optimizing-cache-hits)
    - [Storing non-string data](#storing-non-string-data)
  - [Changing S3 Options](#changing-s3-options)
    - [Specifying S3 Region](#specifying-s3-region)
    - [Using an HTTP proxy](#using-an-http-proxy)
  - [Overriding options per-request](#overriding-options-per-request)
  - [How Items are Stored in S3](#how-items-are-stored-in-s3)
    - [MD5](#md5)
    - [Base64](#base64)
    - [No Encoding](#no-encoding)
- [Full Options List](#full-options-list)
- [Debugging](#debugging)
- [Known Issues / TODO](#known-issues--todo)
- [Development](#development)
- [License](#license)
<!-- TOC END -->



[![https://nodei.co/npm/cache-manager-s3.svg?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/cache-manager-s3.svg?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/cache-manager-s3)

[![npm version](https://badge.fury.io/js/cache-manager-s3.svg)](https://badge.fury.io/js/cache-manager-s3)
[![Dependency Status](https://david-dm.org/tprobinson/node-cache-manager-s3.svg)](https://david-dm.org)
[![Coverage Status](https://coveralls.io/repos/github/tprobinson/node-cache-manager-s3/badge.svg?branch=master)](https://coveralls.io/github/tprobinson/node-cache-manager-s3?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/tprobinson/node-cache-manager-s3/badge.svg?targetFile=package.json)](https://snyk.io/test/github/tprobinson/node-cache-manager-s3?targetFile=package.json)

master: [![Build Status](https://travis-ci.org/tprobinson/node-cache-manager-s3.svg?branch=master)](https://travis-ci.org/tprobinson/node-cache-manager-s3)
[![Docs Status](https://inch-ci.org/github/tprobinson/node-cache-manager-s3.svg?branch=master)](https://inch-ci.org/github/tprobinson/node-cache-manager-s3)

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

### Storing non-string data

By default, this store stringifies responses. This means that any data stored that is not a string will not match when it is retrieved. To disable this behavior, use the `stringifyResponses` option on the constructor or on individual `.get` requests.

```js
const s3CacheStore = new S3Cache({
  accessKey: 'AAAAAAAA',
  secretKey: 'asdnbklajsndkj',
  bucket: 'my-cache-bucket',
  stringifyResponses: false,
})

s3CacheStore.get('suchandsuch', {stringifyResponses: false}, (err, result) => {})
```

If `stringifyResponses` is set to `false`, **all** responses will be returned as Buffers because of how the S3 API communicates. This is particularly useful for storing objects like pictures, but can be troublesome if you're storing mixed content.

Setting 'ContentType' as an s3Option on `.set` requests, then reading that to determine how to handle incoming data on `.get` requests may be a way to handle mixed content.

## Changing S3 Options
Anything specified in the `s3Options` object in the constructor is passed to the [S3 constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property)


### Specifying S3 Region
```js
const s3CacheStore = new S3Cache({
  accessKey: 'AAAAAAAA',
  secretKey: 'asdnbklajsndkj',
  bucket: 'my-cache-bucket',
  s3Options: {
    params: {
      region: 'us-west-2',
    },
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

## How Items are Stored in S3

Due to the unpredictability of incoming data, data stored in S3 has its key hashed to prevent special characters or even binary data from messing up the S3 API.

By default, this is an MD5 checksum. This takes full advantage of S3 because it is binary-safe and can be evenly sharded among multiple folder prefixes, which is recommended in the [S3 API performance](https://docs.aws.amazon.com/AmazonS3/latest/dev/request-rate-perf-considerations.html) documentation.

However, this has a distinct disadvantage: MD5 is a non-trivially-reversible hash, so clearing the cache based on anything other than an exact path is very difficult (aside from a total cache wipe).

An example of when this would be a disadvantage is if you were storing a catalog and wanted to clear your cache of all variants of a particular product.

### MD5
Using the following path structure:

```
apples/
  apples/red
  apples/blue

bananas/
  bananas/yellow
  bananas/crazy
```

With default options, the cache bucket would look like the following:
```
fd/
  fd/c6/
    fd/c6/fdc6b42636254539e5af35a0a63c6b1b

e3/
  e3/3e/
    e3/3e/e33e0a47d9f120706019c42b4f6d7751

74/
  74/6d/
    74/6d/7f6d5d1fb90a43b34704bfd3fe6a99ac

fa/
  fa/55/
    fa/55/fa5505657ed82b895c6a3535ba4a6c59
```

No information about the path is preserved in this structure.

### Base64
Compare this to the following settings that use `base64` instead:
```js
{
  checksumAlgorithm: 'none',
  checksumEncoding: 'base64',
  folderPathChunkSize: 7,
}
```

```
YXBwbGV/
  YXBwbGV/zL3JlZA/
    YXBwbGV/zL3JlZA/YXBwbGVzL3JlZA==
  YXBwbGV/zL2JsdW/
    YXBwbGV/zL2JsdW/YXBwbGVzL2JsdWU=

YmFuYW5/
  YmFuYW5/hcy95ZW/
    YmFuYW5/hcy95ZW/YmFuYW5hcy95ZWxsb3c=
  YmFuYW5/hcy9jcm/
    YmFuYW5/hcy9jcm/YmFuYW5hcy9jcmF6eQ==
```

The paths above, while somewhat clumsily dividing product categories, can be decoded to its original path components. If you wanted to clear the cache of all `apple` products, it would be much easier in this configuration. However, S3 performance in this case is somoewhat dependent on how much variety is in the original paths, and the particular size of `folderPathChunkSize`.


### No Encoding
If you are certain that your paths will not contain any URL-unsafe characters, then you can use the following settings to remove all encoding from your keys:
```js
{
  checksumAlgorithm: 'none',
  folderPathChunkSize: 0,
}
```

```
apples/
  apples/red
  apples/blue

bananas/
  bananas/yellow
  bananas/crazy
```

This has the advantage of being completely readable by using your original path structure, avoiding any clumsiness with the `folderPathChunkSize` dividing the original words unevenly. These settings do not ensure filename sharding at all.


# Full Options List

| Name                | Default  | Description                                                                                                                                                                                                                 |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| accessKey           | required | An AWS access key                                                                                                                                                                                                           |
| secretKey           | required | An AWS secret key                                                                                                                                                                                                           |
| bucket              | required | The bucket to store in.                                                                                                                                                                                                     |
| logLevel            | warn     | The default log level for all functions. See [Debugging](#debugging) below.                                                                                                                                                 |
| ttl                 | None     | Paired with `ttlUnits`, amount in the future to set an object to expire. Can also be an Object, as supported by [Moment](http://momentjs.com/docs/#/manipulating/add/).                                                     |
| ttlUnits            | seconds  | Paired with `ttl`, this is the unit of time to set an object to expire.                                                                                                                                                     |
| pathPrefix          | None     | If specified, all cache objects will be placed under this folder. Slashes are not necessary (unless for a nested folder)                                                                                                    |
| folderPathDepth     | 2        | The number of folders to chunk checksummed names into. Increases performance by nesting objects into folders. Set to 0 to disable.                                                                                          |
| folderPathChunkSize | 2        | The number of characters to use in each folder path chunk.                                                                                                                                                                  |
| checksumAlgorithm   | md5      | The digest algorithm to use when checksumming. Supports any OpenSSL digest (use `openssl list -digest-algorithms`) as well as 'none'. When 'none' and `checksumEncoding` is 'base64', the key will be Base64-encoded.       |
| checksumEncoding    | hex      | The encoding to use for the digest. Valid values (as of this writing) are 'hex', 'latin1', and 'base64'. [Node docs](https://nodejs.org/api/crypto.html#crypto_hash_digest_encoding).                                       |
| normalizeLowercase  | false    | When normalizing, should the key be lowercased first? If using URLs, probably true. If using paths, probably false.                                                                                                         |
| parseKeyAsPath      | false    | Should the key be parsed as a path for normalization?                                                                                                                                                                       |
| normalizePath       | true     | If the key is parsed as a path, should we normalize it? (uses path.normalize)                                                                                                                                               |
| parseKeyAsUrl       | false    | Should the key be parsed as a URL for normalization?                                                                                                                                                                        |
| normalizeUrl        | true     | If the key is parsed as a URL, should we normalize it? (sorts query parameters)                                                                                                                                             |
| proactiveExpiry     | false    | If a key is marked as expired when we encounter it, should we delete it? Causes an additional request, but keeps the cache cleaner in case of `keys()`                                                                      |
| s3Options           | None     | An object passed into the [S3 constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property).                                                                                           |
| s3Options.params    | fill     | An object passed into the [S3 constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property). Parameters in here are included with every request to S3. Good for options like 'region'. |

# Debugging

S3Cache has a bunch of configurable logging. To enable logging for any individual function, set an environment variable like `S3CACHE_<function>_LOGLEVEL` to a valid [loglevel](https://www.npmjs.com/package/loglevel#documentation) string.

For example, to enable logging for all GET requests:
```sh
env S3CACHE_GET_LOGLEVEL=debug node myprogram.js
```

Valid function names:
* `GET`
* `SET`
* `DEL`
* `TTL`
* `KEYS`
* `HEAD`
* `RESET`
* `NORMALIZEPATH` -- good for making sure your keys aren't getting mangled.
* `TIMESTAMPTOMOMENT` -- probably not useful
* `STRINGIFYRESPONSE` -- not useful


To set the default log level for every function, use `S3CACHE_LOGLEVEL`. The default is `warn`.

# Known Issues / TODO

- [ ] implement setex function?
- [ ] convert to jsdoc/docstrap

# Development

Please use the included ESlint configuration to enforce style when developing. Use `yarn test` to run the linter and test suite before commits.

To test with the real AWS SDK rather than a mocked one, set the following environment variables before running `yarn test`:
* `USE_REAL_AWS`: "true" loads the real aws module instead of a fake
* `AWS_ACCESS_KEY`: key
* `AWS_SECRET_KEY`: secret key
* `AWS_S3_BUCKET`: S3 bucket name

**The tests will empty out the bucket, so be sure you're not testing against a bucket you care about!**

To get a bunch of debugging from the test suite, use the following environment variable:
* `S3CACHE_DEBUG_TESTS`: "true" make debug logging active in the test suite

To generate documentation, use `yarn doc` or `yarn docdev`.

# License

[MIT](https://www.tldrlegal.com/l/mit)
