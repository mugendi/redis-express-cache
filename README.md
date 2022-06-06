# Route Cache-ing

Cacheing Express routes made simple.

# How To Use

```javascript
const routeCache = require('redis-express-cache').config({
	// how long do we cache (in seconds)
	ttl: 3600,
	// Which methods to cache
	methods: ['get'],
	// custom function to generate cache Key
	cacheKey: function (req) {
		return req.originalUrl;
	},
});

// This is the middleware function
const cache = routeCache.middleware;

let tempCacheKey;


router.get('your/route', cache, async (req, res, next) => {
	console.log('This will log once an hour');

    // req.cacheKey returns the key used to cache this route
    tempCacheKey = req.cacheKey;
	res.send('Cached for 1 hour');
});

//cacheing but with a specific TTL for only this route
router.get('other/route', cache, async (req, res, next) => {
	// specific route TTL for ths route only
	req.cacheTTL(60);
	console.log('This will log once an minute');
	res.send('Cached for 1 min');
});

//We want to clear some caches once we have new data!
router.post('/new/data/submitted', async (req, res, next) => {

    // clear cached data 
    // this will purge all cached data
    routeCache.clear();

    // this will purge cache saved using this key only (i.e /your/route)
    routeCache.clear(tempCacheKey);

	res.send('Data Posted!');
});
```


TODO: Better documentation...