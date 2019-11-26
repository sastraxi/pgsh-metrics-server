import 'dotenv/config';

import express from 'express';
import bodyParser from 'body-parser';

import mongo from './mongo';

const METRICS_COLLECTION = 'metrics';
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'Ready to build something awesome?',
  });
});

app.post('/', async (req, res) => {
  const metrics = req.body;
  try {
    const db = await mongo();
    const collection = db.collection(METRICS_COLLECTION);

    const result = await collection.insertMany(metrics);
    res.status(200).json({
      status: 'ok',
      result,
    });
  } catch (err) {
    console.error('mongo', err);
    res.status(429).json({ status: 'try again soon' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port , () =>
  console.log('App running at http://localhost:' + port));
