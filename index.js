const express = require('express');

const app = express();
const parser = require('body-parser');
const request = require('request-promise-native');
const cors = require('cors');

const proxyUrl = `http://172.31.23.38:7076`;
// const proxyUrl = `http://34.214.36.60:7076`;

app.use((req, res, next) => {
  if (req.headers['content-type']) return next();
  req.headers['content-type'] = 'application/json';
  next();
});
app.use(cors());
app.use(express.json());

app.post('/api/new-block', (req, res) => {
  const fullBlock = req.body;
  fullBlock.block = JSON.parse(fullBlock.block);

  console.log(`Got new block: `, fullBlock);

  res.send(200);
});

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
  request({ method: 'post', uri: proxyUrl, body: req.body, json: true })
    .then(proxyRes => res.json(proxyRes))
    .catch(err => res.status(500).json(err.toString()));
});

app.use(express.static('static'));

app.get('/*', (req, res) => {
  console.log(`${__dirname}/static/index.html`);
  res.sendFile(`${__dirname}/static/index.html`)
});

app.listen(9950, () => console.log(`App listening!`));