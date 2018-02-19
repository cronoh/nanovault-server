const express = require('express');
const request = require('request-promise-native');
const cors = require('cors');
const cacheClient = require('redis').createClient({
  host: `172.31.23.61`,
});

const app = express();

const proxyUrl = `http://172.31.23.38:7076`;
const workCache = [];

app.use(cors());
app.use(express.json());

app.post('/api/node-api', (req, res) => {
  const allowedActions = [
    'account_history',
    'account_info',
    'accounts_frontiers',
    'accounts_balances',
    'accounts_pending',
    'block',
    'blocks',
    'blocks_info',
    'pending',
    'process',
    'validate_account_number',
    'work_generate',
  ];
  if (!req.body.action || allowedActions.indexOf(req.body.action) === -1) {
    return res.status(500).json({ error: `Action ${req.body.action} not allowed` });
  }

  let workRequest = false;
  if (req.body.action === 'work_generate') {
    if (!req.body.hash) return res.status(500).json({ error: `Requires valid hash to perform work` });
    // const cachedWork = cacheClient.get(req.body.hash);
    // if (cachedWork && cachedWork.length) {
    //   return res.json({ work: cachedWork });
    // }
    const existingHash = workCache.find(w => w.hash === req.body.hash);
    if (existingHash) {
      return res.json({ work: existingHash.work });
    }
    workRequest = true;
  }
  request({ method: 'post', uri: proxyUrl, body: req.body, json: true })
    .then(proxyRes => {
      if (workRequest && proxyRes && proxyRes.work) {

        // cacheClient.set(req.body.hash, proxyRes.work, 'EX', 60 * 60 * 24); // Store the work for 24 hours

        workCache.push({ hash: req.body.hash, work: proxyRes.work });
        // If the list is too long, prune it.
        if (workCache.length >= 800) {
          workCache.shift();
        }
      }
      res.json(proxyRes)
    })
    .catch(err => res.status(500).json(err.toString()));
});

app.use(express.static('static'));

app.get('/*', (req, res) => res.sendFile(`${__dirname}/static/index.html`));

app.listen(9950, () => console.log(`App listening!`));

cacheClient.on('ready', () => console.log(`Redis Work Cache: Connected`));
cacheClient.on('error', (err) => console.log(`Redis Work Cache: Error`, err));
cacheClient.on('end', () => console.log(`Redis Work Cache: Connection closed`));