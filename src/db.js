import mongoose, { Schema } from 'mongoose';

mongoose.connect('mongodb://daniel:Hs8-kvW-BYZ-r2b@ds125183.mlab.com:25183/sundaystories');

const db = mongoose.connection;

const storySchema = Schema({
  text: String,
});
const Story = mongoose.model('Story', storySchema);

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('something');
});

export const createStory = (text) => {
  const story = new Story({ text });
  story.save((err) => {
    if (err) console.log(err);
  });
};

export default (callback) => {
  callback();
};
