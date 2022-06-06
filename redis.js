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

function get(key) {
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

function set(key, data, ttl) {
	return redis
		.set(key, JSON.stringify(data, 0, 4))
		.then((resp) => {
			// set expiry
			return redis.expire(key, ttl);
		})
		.catch(console.error);
}



module.exports = {
	get,
	set,
	del: (key) => redis.del(key),
	keys: (key) => redis.keys(key),
};
