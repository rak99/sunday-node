import mongoose from 'mongoose';
import config from '../config.json';

mongoose.Promise = global.Promise;

const options = {
  reconnectTries: 30,
  reconnectInterval: 1000,
  useNewUrlParser: true
};

mongoose.set('useCreateIndex', true);

mongoose.connect(`mongodb://${config.mlabUsername}:${config.mlabPassword}@ds125183.mlab.com:25183/sundaystories`, options);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

export default (callback) => {
  callback();
};
