var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var methodOverride = require('method-override');
var aws = require('aws-sdk');
var formidable = require('formidable');
var fs = require('fs');
var moment = require('moment');
var flash = require('connect-flash');
var User = require('./models/user');
var Picture = require('./models/picture');

var app = express();

var cdnUrl = "https://d3qwq5pirj47dt.cloudfront.net";

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));
app.use(flash());

mongoose.connect('mongodb://localhost/astropix');

//PASSPORT CONFIGURATION
app.use(require('express-session')({
  secret: "Le Québec est la plus belle province du Canada",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(function(req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  next();
});

//AWS CONFIGURATION
aws.config.loadFromPath('config.json');
var s3Bucket = new aws.S3({params: {Bucket: 'astropix-pictures'}});


////////////////////////////////
// MIDDLEWARE FUNCTIONS
///////////////////////////////
var isLoggedIn = function(req, res, next) {
  if(req.isAuthenticated()) {
    return next();
  }
  req.flash('error', "You need to be logged in to do that");
  res.redirect('/gallery');
}

var checkPictureOwnership = function(req, res, next) {
  if(req.isAuthenticated()) {
    Picture.findById(req.params.id, function(err, foundPicture) {
      if(err) {
        req.flash('error', "Picture not found");
        res.redirect('back');
      } else {
        if(foundPicture.author.id.equals(req.user._id)) {
          next();
        } else {
          req.flash('error', "You do not have permission to do that");
          res.redirect('back');
        }
      }
    });
  } else {
    req.flash('error', "You need to be logged in to do that");
    res.redirect('back');
  }
}


////////////////////////////////
// ROUTES
///////////////////////////////

/* INDEX */
app.get('/', function(req, res) {
  // if there is a user logged in, go directly to the gallery page
  if(req.isAuthenticated()) {
    res.redirect('/gallery');
  }
  else { // if not, show landing page
    res.render('landing');
  }
});

/* SHOW GALLERY */
app.get('/gallery', function(req, res) {
  Picture.find({}, function(err, pictures) {
    if(err) {
      console.log("Error finding pictures");
      req.flash('error', "There was an error. Please try again later.");
      res.redirect('/gallery');
    } else {
      res.render('index', {pictures: pictures});
    }
  });
});

/* SHOW SIGN UP FORM */
app.get('/signup', function(req, res) {
  if(req.isAuthenticated()) {
    res.redirect('/gallery');
  } else {
    res.render('signup');
  }
});

/* PROCCESS SIGN UP */
app.post('/signup', function(req, res) {
  var newUser = new User({
    email: req.body.email,
    username: req.body.username
  });
  User.register(newUser, req.body.password, function(err, user) {
    if(err) {
      req.flash('error', "It was not possible to sign you up now. Please try again later.");
      return res.redirect('/signup');
    }
    res.redirect('/login');
  });
});

/* SHOW LOGIN FORM */
app.get('/login', function(req, res) {
  if(req.isAuthenticated()) {
    res.redirect('/gallery');
  } else {
    res.render('login');
  }
});

/* PROCCESS LOGIN */
app.post('/login', passport.authenticate("local", {
  successRedirect: '/gallery',
  failureRedirect: '/login'
}), function(req, res){
});

/* PROCCESS LOGOUT */
app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/gallery');
});

/* SHOW PROFILE PAGE */
app.get('/myprofile', isLoggedIn, function(req, res) {
  res.render('myprofile');
});

/* SHOW USER'S PICTURES PAGE */
app.get('/mypictures', isLoggedIn, function(req, res) {
  Picture.find({author: {id: mongoose.Types.ObjectId(req.user.id), username: req.user.username}}, function(err, pics) {
    if(err) {
      console.log(err);
    } else {
      res.render('mypictures', {pictures: pics});
    }
  });
});

/* DELETE A PICTURE */
app.delete('/picture/:id', checkPictureOwnership, function(req, res) {
  Picture.findById(req.params.id, function(err, foundPicture) {
    if(err) {
      req.flash('error', "Picture not deleted");
      res.redirect('/mypictures');
    } else {
      if(foundPicture.mediaType == "image") {
        s3Bucket.deleteObject({Key: foundPicture.fileName}, function(err, data) {
          if(err) {
            req.flash('error', "Picture not deleted");
            res.redirect('/mypictures');
          }
        });
      }
      Picture.findByIdAndRemove(req.params.id, function(err) {
        if(err) {
          req.flash('error', "Picture not deleted");
          res.redirect('/mypictures');
        } else {
          req.flash('success', "Picture deleted successfully");
          res.redirect('/mypictures');
        }
      });
    }
  });
});

/* SHOW EDIT PICTURE FORM */
app.get('/picture/:id/edit', checkPictureOwnership, function(req, res) {
  Picture.findById(req.params.id, function(err, foundPicture) {
    if(err) {
      req.flash('error', "Picture not found");
      res.redirect('mypictures');
    } else {
      res.render('editpicture', {picture: foundPicture});
    }
  });
});

/* PROCCESS EDIT PICTURE FORM */
app.put('/picture/:id/edit', checkPictureOwnership, function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    var picture = {
      title: fields.title,
      description: fields.description,
      date: fields.date,
      location: fields.location,
      techSpecs: {
        imgTelOrLens: fields.imgTelOrLens,
        imgCamera: fields.imgCamera,
        mount: fields.mount,
        guidingTelOrLens: fields.guidingTelOrLens,
        guidingCam: fields.guidingCam,
        resolution: fields.resolution
      }
    };
    Picture.findByIdAndUpdate(req.params.id, picture, function(err, updatedPicture) {
      if(err) {
        req.flash('error', "Failed to update picture");
        res.redirect('back');
      } else {
        console.log(updatedPicture);
        req.flash('success', "Picture updated successfully");
        res.redirect('/picture/' + updatedPicture._id);
      }
    });
  });
});

/* SHOW ADD NEW PICTURE FORM */
app.get('/newpicture', isLoggedIn, function(req, res) {
  res.render('newpicture');
});

/* PROCCESS NEW PICTURE FORM */
app.post('/newpicture', isLoggedIn, function(req, res) {
  var form = new formidable.IncomingForm();
  //form.keepExtensions = true;
  form.parse(req, function(err, fields, files) {
    var picture = {
      title: fields.title,
      description: fields.description,
      date: fields.date,
      location: fields.location,
      tags: fields.tags.split(','),
      mediaType: fields.mediaType,
      techSpecs: {
        imgTelOrLens: fields.imgTelOrLens,
        imgCamera: fields.imgCamera,
        mount: fields.mount,
        guidingTelOrLens: fields.guidingTelOrLens,
        guidingCam: fields.guidingCam,
        resolution: fields.resolution
      },
      author: {
        id: req.user._id,
        username: req.user.username
      }
    };

    if(fields.mediaType == "image") {
      var fileType = files.imageFile.type;
      if(fileType != "image/jpeg" && fileType != "image/png") {
        //Invalid file
        console.log("Invalid file type. Please upload a JPEG or PNG image.");
        res.redirect('/newpicture');
      } else {
        var imgExtension;
        if(fileType == "image/jpeg") {
          imgExtension = ".jpg";
        } else {
          imgExtension = ".png";
        }
        fs.readFile(files.imageFile.path, function(err, data) {
          if(err) {
            console.log("Error reading image file. Please try again.");
            res.redirect('/newpicture');
          } else {
            var fileName = 'gustavohc' + '_' + moment().format('YYYYMMDDHHmmss') + imgExtension;
            s3Bucket.upload({Key: fileName, Body: data}, function(err, data) {
              if(err) {
                console.log("Error uploading image to server. Please try again.");
                res.redirect('/newpicture');
              } else {
                picture.url = cdnUrl + "/" + fileName;
                picture.fileName = fileName;
                // Add picture to database
                Picture.create(picture, function(err, createdPicture) {
                  if(err) {
                    console.log("It was not possible to save picture to the database. Please try again.");
                    res.redirect('/newpicture');
                  } else {
                    console.log("Successfully created new picture");
                    res.redirect('/picture/' + createdPicture._id);
                  }
                });
              }
            });
          }
        });
      }
    }
    else { // it's video type
      picture.url = "https://www.youtube.com/embed/" + fields.videoId;
      picture.thumbUrl = "https://img.youtube.com/vi/" + fields.videoId + "/0.jpg"
      Picture.create(picture, function(err, createdPicture) {
        if(err) {
          console.log("It was not possible to save picture to the database. Please try again.");
          res.redirect('/newpicture');
        } else {
          console.log("Successfully created new picture");
          res.redirect('/picture/' + createdPicture._id);
        }
      });
    }
  });
});

/* SHOW SPECIFIC PICTURE PAGE */
app.get('/picture/:id', function(req, res) {
  Picture.findById(req.params.id, function(err, foundPicture) {
    if(err) {
      console.log("Error while trying to find picture.");
      res.render('index');
    } else {
      res.render('picture', {picture: foundPicture});
    }
  });
});


/* START SERVER */
app.listen(8080, 'localhost', function() {
  console.log("astropix server is running...");
});
