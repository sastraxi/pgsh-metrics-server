import { MongoClient, Db } from 'mongodb';

// generate database URL from environment
let databaseUrl = process.env.MONGO_URL;
if (!databaseUrl) {
  databaseUrl = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}` +
    `@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}`;
}

export default async (): Promise<Db> => {
  console.log(databaseUrl);
  const client = await MongoClient.connect(databaseUrl, {
    authSource: 'admin',
  });
  return client.db();
};
