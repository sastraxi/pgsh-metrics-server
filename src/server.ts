import 'dotenv/config';

import express from 'express';
import bodyParser from 'body-parser';

import mongo from './mongo';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'Ready to build something awesome?',
  });
});

app.post('/', (req, res) => {
  console.log('POST', req.body);
});

const port = process.env.PORT || 3000;
app.listen(port , () =>
  console.log('App running at http://localhost:' + port));
