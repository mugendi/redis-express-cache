'use strict';

const crypto = require('crypto'),
	os = require('os');

// console.log(os.hostname());

let options, cache, appName;
const namespace = 'RExC';

// md5 hash
function md5(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

// config
function config(opts = {}) {
	options = Object.assign(
		{
			methods: ['get'],
			cacheKey: (req) => md5(req.originalUrl),
			ttl: 3600,
		},
		opts
	);

	cache = options.cacheClient || require('./redis');

	return module.exports;
}

// clear data namespace
async function clear_by_namespace(key) {
	key = `${key}:*`;

	cache
		.keys(key)
		.then((resp) => {
			// console.log(1, resp);
			if (resp.length) return cache.del(...resp);
		})
		.catch(console.error);
}

// clear
async function clear(key = null) {
	// console.log({ key });
	if (key) {
		return cache
			.del(key)
			.then((resp) => {
				if (resp == 0) {
					key = get_key(appName, namespace, key);
					// no such key, delete by namespace
					return clear_by_namespace(key);
				}
			})
			.catch(console.error);
	} else {
		// delete all keys
		let key = get_key(appName, namespace);
		return clear_by_namespace(key);
	}
}

// get key
function get_key() {
	let args = Array.from(arguments).flat();
	return args.join(':');
}

// middleware
async function middleware(req, res, next) {
	// ensure options
	if (!options) config();

	let method = req.method.toLowerCase();

	// if not among the methods, we stop there
	if (options.methods.indexOf(method) == -1) {
		return next();
	}

	// get app based on values set with app.set(), environmental value or fallback to hostname
	appName = req.app.settings.name || process.env.APP_NAME || os.hostname();

	// get redis key
	let key = get_key(appName, namespace, options.cacheKey(req));
	// set ttl
	let ttl = parseInt(options.ttl) || 3600;

	// get value
	let value = await cache.get(key);

	if (value) {
		// returns the value immediately
		if (value.isJson) {
			res.json(value.body);
		} else {
			res.send(value.body);
		}

		return;
	}

	res.original_send = res.send;
	res.original_end = res.end;
	res.original_json = res.json;
	res.original_redirect = res.redirect;

	res.send = function (data) {
		rawSend(data, false);
	};

	res.end = (data) => {
		res.original_end(data);
	};

	res.json = function (data) {
		rawSend(data, true);
	};

	// save cacheKey
	req.cacheKey = key;

	// modify TTL
	req.cacheTTL = (TTL) => {
		ttl = TTL;
	};

	next();

	async function rawSend(data, isJson) {
		// if headers already sent, stop
		if (res.headersSent) {
			return;
		}

		// pass-through for Buffer - not supported
		if (typeof data === 'object') {
			if (Buffer.isBuffer(data)) {
				queues[key] = []; // clear queue
				res.set('Content-Length', data.length);
				res.original_send(data);
				return;
			}
		}

		const body = data instanceof Buffer ? data.toString() : data;

		if (res.statusCode < 400) {
			// save
			cache.set(key, { body, isJson }, ttl).catch(console.error);

			// console.log({ method });

			// TODO: Do we set Cache Control Headers?
			//set cache control header
			if (
				//dont cache on development mode
				process.env.NODE_ENV !== 'development' &&
				// only add CacheControl if 'true' is passed via route
				req.cacheControl
			) {
				// we should clear browser cache after we have cleared server cache
				// that way we are sure to fetch new data
				let maxAge = parseInt(Math.ceil(ttl * 1.05));
				res.set('Cache-control', `public, max-age=${maxAge}`);
			} else {
				// for the other requests set strict no caching parameters
				res.set('Cache-control', `no-store`);
			}
		}

		// cacheStore.set(key, { body: body, isJson: isJson }, ttl);
		// console.log({body, isJson})

		if (isJson) {
			res.original_json(body);
		} else {
			res.original_send(body);
		}
	}
}

// Exports...
module.exports = {
	config,
	middleware,
	clear,
};