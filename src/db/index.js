import mongoose from 'mongoose';

mongoose.Promise = global.Promise;

const options = {
  useMongoClient: true,
};

mongoose.connect('mongodb://daniel:Hs8-kvW-BYZ-r2b@ds125183.mlab.com:25183/sundaystories', options);

// http://mongoosejs.com/docs/2.7.x/docs/methods-statics.html

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

export default (callback) => {
  callback();
};
