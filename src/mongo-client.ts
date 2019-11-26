import { MongoClient, Db, MongoCallback } from 'mongodb';

// generate database URL from environment
let databaseUrl = process.env.MONGO_URL;
if (!databaseUrl) {
  databaseUrl = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}` +
    `@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}`;
}

export default (cb: MongoCallback<MongoClient>): void =>
  MongoClient.connect(databaseUrl, {
    authSource: process.env.MONGO_AUTH_DATABASE,
    useUnifiedTopology: true,
    useNewUrlParser: true,
  }, cb);
