import 'dotenv/config';

import createDebugger from 'debug';
import crypto from 'crypto';
import express from 'express';
import Bottleneck from 'bottleneck';
import bodyParser from 'body-parser';

const debug = createDebugger('metrics');

import mongoClient from './mongo-client';
import { MongoClient } from 'mongodb';

const METRICS_COLLECTION = 'metrics';

const { HMAC_KEY } = process.env;

const hmac = (s: string) =>
  crypto
    .createHmac('sha1', HMAC_KEY)
    .update(s)
    .digest('hex');

const app = express();

app.use(bodyParser.text({ type: "*/*" }));

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

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'Ready to build something awesome?',
  });
});

try {
  mongoClient((err, mongo: MongoClient) => {
    if (err) {
      console.error(err);
    }

    app.post('/', async (req, res) => {
      const body: string = Array.isArray(req.body) ? req.body.join('\n') : req.body;
      console.log(req.body);

      const signature = req.headers["x-pgsh-signature"];
      if (!signature || hmac(body) !== signature) {
        // TODO: debug(...)
        console.error(`- invalid sig: ${signature}, expected: ${hmac(body)}`);
        return res.status(400).json({
          message: 'Invalid signature!',
        })
      }

      const limiter = group.key(req.ip);
      const metrics = body.split('\n')
        .filter(x => x.trim() !== '')
        .map(x => JSON.parse(x));

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
          // TODO: debug(...)
          console.log(`Inserted ${metrics.length} records!`);
          return res
            .status(200)
            .header('X-Rate-Limit-Remaining', `${await limiter.currentReservoir()}`)
            .json({
              status: 'OK',
              insert: metrics.length,
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
} catch (err) {
  // TODO: debug(...)
  console.error('Received error at top-level!', err);
}
