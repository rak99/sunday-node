import mongoose, { Schema } from 'mongoose';

const storySchema = Schema({
  text: String,
  imageUrl: String,
  timeCreated: String,
  weekCommencing: String,
  idOfCreator: String,
});

const Story = mongoose.model('Story', storySchema);

export default Story;
