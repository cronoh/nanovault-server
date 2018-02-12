const express = require('express');
const request = require('request-promise-native');
const cors = require('cors');

const app = express();

const proxyUrl = `http://172.31.23.38:7076`;
const workCache = [];

app.use(cors());
app.use(express.json());

app.post('/api/node-api', (req, res) => {
  const allowedActions = [
    'accounts_frontiers',
    'accounts_balances',
    'accounts_pending',
    'work_generate',
    'process',
    'account_history',
    'account_info',
    'validate_account_number',
    'pending',
    'krai_to_raw',
    'krai_from_raw',
    'mrai_to_raw',
    'mrai_from_raw',
    'rai_to_raw',
    'rai_from_raw',
  ];
  if (!req.body.action || allowedActions.indexOf(req.body.action) === -1) {
    return res.status(500).json({ error: `Action ${req.body.action} not allowed` });
  }

  let workRequest = false;
  if (req.body.action === 'work_generate') {
    if (!req.body.hash) return res.status(500).json({ error: `Requires valid hash to perform work` });
    const existingHash = workCache.find(w => w.hash === req.body.hash);
    if (existingHash) {
      return res.json({ work: existingHash.work });
    }
    workRequest = true;
  }
  request({ method: 'post', uri: proxyUrl, body: req.body, json: true })
    .then(proxyRes => {
      if (workRequest && proxyRes && proxyRes.work) {
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