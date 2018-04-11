/** Configuration **/
const nanoNodeUrl = `http://172.31.23.38:7076`; // Nano node RPC url
const nanoWorkNodeUrl = `http://74.82.30.7:7076`; // Nano work node RPC url
const listeningPort = 9950; // Port this app will listen on

const useRedisCache = true; // Change this if you are not running a Redis server.  Will use in memory cache instead.
const redisCacheUrl = `172.31.25.214`; // Url to the redis server (If used)
const redisCacheTime = 60 * 60 * 24; // Store work for 24 Hours
const memoryCacheLength = 800; // How much work to store in memory (If used)

const express = require('express');
const request = require('request-promise-native');
const cors = require('cors');
const { promisify } = require('util');

const workCache = [];
let getCache, putCache;

// Set up the webserver
const app = express();
app.use(cors());
app.use(express.json());

// Serve the production copy of the wallet
app.use(express.static('static'));
app.get('/*', (req, res) => res.sendFile(`${__dirname}/static/index.html`));

// Allow certain requests to the Nano RPC and cache work requests
app.post('/api/node-api', async (req, res) => {
  const allowedActions = [
    'account_history',
    'account_info',
    'accounts_frontiers',
    'accounts_balances',
    'accounts_pending',
    'block',
    'blocks',
    'block_count',
    'blocks_info',
    'delegators_count',
    'pending',
    'process',
    'representatives_online',
    'validate_account_number',
    'work_generate',
  ];
  if (!req.body.action || allowedActions.indexOf(req.body.action) === -1) {
    return res.status(500).json({ error: `Action ${req.body.action} not allowed` });
  }

  let workRequest = false;
  let representativeRequest = false;
  let repCacheKey = `online-representatives`;

  // Cache work requests
  if (req.body.action === 'work_generate') {
    if (!req.body.hash) return res.status(500).json({ error: `Requires valid hash to perform work` });

    const cachedWork = useRedisCache ? await getCache(req.body.hash) : getCache(req.body.hash); // Only redis is an async operation
    if (cachedWork && cachedWork.length) {
      return res.json({ work: cachedWork });
    }
    workRequest = true;
  }

  // Cache the online representatives request
  if (req.body.action === 'representatives_online') {
    const cachedValue = useRedisCache ? await getCache(repCacheKey) : getCache(repCacheKey); // Only redis is an async operation
    if (cachedValue && cachedValue.length) {
      return res.json(cachedValue);
    }
    representativeRequest = true;
  }

  // Send the request to the Nano node and return the response
  request({ method: 'post', uri: (workRequest || representativeRequest) ? nanoWorkNodeUrl : nanoNodeUrl, body: req.body, json: true })
    .then(proxyRes => {
      if (proxyRes) {
        if (workRequest && proxyRes.work) {
          putCache(req.body.hash, proxyRes.work);
        }
        if (representativeRequest && proxyRes.representatives) {
          putCache(repCacheKey, proxyRes, 5 * 60); // Cache online representatives for 5 minutes
        }
      }
      res.json(proxyRes)
    })
    .catch(err => res.status(500).json(err.toString()));
});

app.listen(listeningPort, () => console.log(`App listening on port ${listeningPort}!`));

// Configure the cache functions to work based on if we are using redis or not
if (useRedisCache) {
  const cacheClient = require('redis').createClient({
    host: redisCacheUrl,
  });
  cacheClient.on('ready', () => console.log(`Redis Work Cache: Connected`));
  cacheClient.on('error', (err) => console.log(`Redis Work Cache: Error`, err));
  cacheClient.on('end', () => console.log(`Redis Work Cache: Connection closed`));

  getCache = promisify(cacheClient.get).bind(cacheClient);
  putCache = (hash, work, time) => {
    cacheClient.set(hash, work, 'EX', time || redisCacheTime); // Store the work for 24 hours
  };
} else {
  getCache = hash => {
    const existingHash = workCache.find(w => w.hash === hash);
    return existingHash ? existingHash.work : null;
  };
  putCache = (hash, work, time) => {
    if (time) return; // If a specific time is specified, don't cache at all for now
    workCache.push({ hash, work });
    if (workCache.length >= memoryCacheLength) workCache.shift(); // If the list is too long, prune it.
  };
}