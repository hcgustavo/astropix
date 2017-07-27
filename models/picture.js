var mongoose = require('mongoose');

var pictureSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: String,
  location: String,
  tags: [String],
  mediaType: String,
  url: String,
  thumbUrl: String,
  techSpecs: {
    imgTelOrLens: String,
    imgCamera: String,
    mount: String,
    guidingTelOrLens: String,
    guidingCam: String,
    resolution: String
  },
  author: {
    id: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
    username: String
  }
});

module.exports = mongoose.model('Picture', pictureSchema);
