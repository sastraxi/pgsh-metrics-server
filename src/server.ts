import 'dotenv/config';

import crypto from 'crypto';
import express from 'express';
import Bottleneck from 'bottleneck';
import bodyParser from 'body-parser';

import mongoClient from './mongo-client';
import { MongoClient } from 'mongodb';

const METRICS_COLLECTION = 'metrics';

// the point here isn't to make it impossible for people to forge
// submissions to the metrics server -- it's just to make it so hard
// to do so, you'd really have to want to cause some damage.
const HMAC_KEY = '9abb6dfdfdfdf';

const hmac = (obj: any) =>
  crypto
    .createHmac('sha1', HMAC_KEY)
    .update(JSON.stringify(obj))
    .digest('hex');

const app = express();

const group = new Bottleneck.Group({
  // if we receive multiple 
  highWater: 1,
  strategy: Bottleneck.strategy.BLOCK,
  penalty: 60 * 1000, // penalize brute force attacks with a 60s delay
  
  // submitted metrics per hour (not requests!)
  reservoir: +process.env.RESERVOIR_AMOUNT,
  reservoirRefreshInterval: +process.env.RESERVOIR_REFRESH_SECONDS * 1000,
  reservoirRefreshAmount: +process.env.RESERVOIR_AMOUNT,

  // wait this amount of time between requests per ip
  minTime: +process.env.MIN_WAIT_TIME_SECONDS * 1000,

  // delete limiters after they've been inactive for an hour
  timeout: 60 * 60 * 1000,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'Ready to build something awesome?',
  });
});

mongoClient((err, mongo: MongoClient) => {
  app.post('/', async (req, res) => {
    const { metrics, signature } = req.body;

    if (!signature || hmac(metrics) !== signature) {
      return res.status(400).json({
        message: 'Invalid signature!',
      })
    }

    const limiter = group.key(req.ip);

    if (await limiter.currentReservoir() < metrics.length) {
      return res
        .status(429)
        .header('X-Rate-Limit-Remaining', `${await limiter.currentReservoir()}`)
        .json({
          status: 'Over rate limit!',
        });
    }

    return limiter.schedule({ weight: metrics.length }, async () => {
      try {
        const db = mongo.db();
        const collection = db.collection(METRICS_COLLECTION);
        const result = await collection.insertMany(metrics);
        return res
          .status(200)
          .header('X-Rate-Limit-Remaining', `${await limiter.currentReservoir()}`)
          .json({
            status: 'OK',
            result,
          });
      } catch (err) {
        console.error('mongo', err);
        return res.status(500).json({ status: 'Mongo errored out!' });
      }
    }).catch(console.error);
  });

  const port = process.env.PORT || 3000;
  app.listen(port , () =>
    console.log('Metrics server running at http://localhost:' + port));
});
