import mongoose, { Schema } from 'mongoose';
import config from '../../config.json';

const storySchema = Schema({
  text: String,
  imageUrl: String,
  timeCreated: String,
  weekCommencing: String,
  idOfCreator: String,
});

let storyModelName = 'Story';

if (config.dev || config.testmode) {
  storyModelName = 'test-Story';
}

const Story = mongoose.model(storyModelName, storySchema);

export default Story;
