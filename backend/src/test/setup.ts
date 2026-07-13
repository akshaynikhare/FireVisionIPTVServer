import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  // Build schema indexes (incl. unique constraints) up front so tests that rely on
  // them — e.g. duplicate-key handling — are deterministic instead of racing the
  // background autoIndex build.
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
