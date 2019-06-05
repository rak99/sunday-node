import mongoose from 'mongoose';
import config from '../config.json';

mongoose.Promise = global.Promise;

const options = {
  useMongoClient: true,
};

mongoose.connect(`mongodb://${config.mlabUsername}:${config.mlabPassword}@ds125183.mlab.com:25183/sundaystories`, options);

export const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

export default (callback) => {
  callback();
};
