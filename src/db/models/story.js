import mongoose, { Schema } from 'mongoose';

const storySchema = Schema({
  text: String,
});

const Story = mongoose.model('Story', storySchema);

export default Story;
