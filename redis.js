// Copyright 2022 Anthony Mugendi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const Redis = require('ioredis'),
	redis = new Redis({ db: 3 });

let namespace;

function get_key() {
	let args = Array.from(arguments).flat(),
		arr = [namespace].concat(args);
	return arr.join(':');
}

function arrify(value) {
	if (value === null || value === undefined) {
		return [];
	}

	if (Array.isArray(value)) {
		return value;
	}

	if (typeof value === 'string') {
		return [value];
	}

	if (typeof value[Symbol.iterator] === 'function') {
		return [...value];
	}

	return [value];
}

function getJSON(key) {
	return redis
		.get(key)
		.then((resp) => {
			try {
				resp = JSON.parse(resp);
			} catch (error) {
				resp = null;
			}

			return resp;
		})
		.catch(console.error);
}

function setJSON(key, data) {
	return redis.set(key, JSON.stringify(data, 0, 4));
}

redis.get_key = get_key;
redis.getJSON = getJSON;
redis.setJSON = setJSON;

module.exports = (ns = 'usesso') => {
	namespace = ns;
	return redis;
};
