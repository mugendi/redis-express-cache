'use strict';

const crypto = require('crypto');

let options, redis;
const namespace = 'RExC';

function md5(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = {
	config,
	middleware,
	clear,
};

function config(opts = {}) {

	options = Object.assign(
		{
			methods: ['get'],
			cacheKey: (req) => md5(req.originalUrl),
			ttl: 3600,
		},
		opts
	);

	redis = options.redisClient || require('./redis')();

	return module.exports;
}

async function clear_by_namespace(key) {
	key = `${key}:*`;
	// console.log({ key });
	redis
		.keys(key)
		.then((resp) => {
			// console.log(1,resp);
			if (resp.length) return redis.del(...resp);
		})
		.catch(console.error);
}

async function clear(key = null) {
	// console.log({ key });
	if (key) {
		return redis
			.del(key)
			.then((resp) => {
				if (resp == 0) {
					key = redis.get_key(namespace, key);
					// no such key, delete by namespace
					return clear_by_namespace(key);
				}
			})
			.catch(console.error);
	} else {
		// delete all keys
		let key = redis.get_key(namespace);
		return clear_by_namespace(key);
	}
}

async function middleware(req, res, next) {
	// ensure options
	if (!options) config();

	let method = req.method.toLowerCase();

	// if not among the methods, we stop there
	if (options.methods.indexOf(method) == -1) {
		return next();
	}

	// get redis key
	let key = redis.get_key([namespace, options.cacheKey(req)]);
	req.cacheKey = key;

	// console.log({options,key})
	// get value
	let value = await redis.getJSON(key);
	let ttl = options.ttl || 3600;

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
			redis
				.setJSON(key, { body, isJson })
				.then((resp) => {
					// set ttl/expire
					return redis.expire(key, ttl);
				})
				.catch(console.error);

			// console.log({ method });

            // TODO: Do we set Cache Control Headers?
			//set cache control header
			// if (method == 'get' && process.env.NODE_ENV !== 'development') {
			// 	res.set('Cache-control', `public, max-age=${ttl}`);
			// } else {
			// 	// for the other requests set strict no caching parameters
			// 	res.set('Cache-control', `no-store`);
			// }
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
