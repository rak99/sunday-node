import mongoose from 'mongoose';

mongoose.connect('mongodb://daniel:Hs8-kvW-BYZ-r2b@ds125183.mlab.com:25183/sundaystories');

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

export default (callback) => {
  callback();
};
