import mongoose from 'mongoose';

mongoose.Promise = global.Promise;

const options = {
  useMongoClient: true,
};

mongoose.connect('mongodb://louis:!u$S8*UX+/E<PMBq@ds125183.mlab.com:25183/sundaystories', options);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

export default (callback) => {
  callback();
};
