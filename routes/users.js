/**
 * JournalAPI
 *
 * An API for storing journal entries along with
 * location data, mood data, and weather data.
 *
 * This file handles all the user information routes,
 * and should enable our users to create (if they are
 * an admin), update, get, and delete user data.
 *
 * CIS 371 - Fall 2021
 *
 */

/**********
 * Load all the libraries we need.
 **********/
var crypto = require('crypto');
var express = require('express');
var passport = require('passport');
var Strategy = require('passport-http').BasicStrategy
var pbkdf2 = require('pbkdf2');
var router = express.Router();

/**
 * Pull in the mongoose library and create a schema
 * to base our user model off.
 */
const mongoose = require('mongoose');

// User schema
const { Schema } = mongoose;

const userSchema = new Schema({
    email: {
		type: String,
		required: true
	},
    password: {
		type: String,
		required: true
	},
    salt: String,
    date: { 
		type: Date,
		default: Date.now },
    admin: {
		type: Boolean,
		default: false }
	
});

// User model
const User = mongoose.model('User', userSchema);

/**
 * Create a function that will check the information passed
 * in from the client headers (through the Passport library)
 * to see if it is the same information we have stored for
 * the user in the database.
 */
const validPassword = function(password, salt, hash){
	let key = pbkdf2.pbkdf2Sync(password, salt, 1, 32, 'sha512');

	if(key.toString('hex') != hash){
		return false;
	}
	return true;
}

/**
 * Teach passport what authorization means for our app.  There are
 * so many different things people may want to do, so we specify
 * how it works with our API here.
 */
passport.use(new Strategy(
	function(email, password, done) {
	  User.findOne({ email: email }, function (err, user) {
		  // Can't connect to Db?  We're done.
		if (err) {
			return done(err);
		}
		// User doesn't exist?  We're done.
		if (!user) { 
			console.log("No user found.");
			return done(null, false);
		}
		// Got this far?  Check the password.
		if (!validPassword(password, user.salt, user.password)) { 
			console.log("Wrong password.");
			return done(null, false);
		}
		// Otherwise, let them in and store the user in req.
		return done(null, user);
	  });
	}
  )
);

// I don't want to type this passport.authenticate, blah, blah line
// every time, so I'm aliasing it.
const checkAuth = passport.authenticate('basic', { session: false });

/**
 * Routes
 */

/**
 * GET users listing.
 * This will get all users, and should only be usable by an admin.
 */
router.get('/', checkAuth, async function(req, res, next) {
	if(req.user.admin){
		var users = await User.find({})
		res.json(users);
	} else {
		var error = new Error("Not authorized.");
		error.status = 401;
		throw err;
	}
});

/**
 * GET a single user.
 * This function may be used by an administrator, or by a user
 * ONLY IF they are asking for their own information.
 */
router.get('/:userId', checkAuth, async function(req, res, next){
	if(req.user.admin || req.user._id == req.params.userId){
		var user = await User.findOne({ _id : req.params.userId });
		res.json(user);
	} else {
		var error = new Error("Not authorized.");
		error.status = 401;
		throw error;
	}
});

/**
 * POST a new user.
 * Anyone can register a new user.
 * Only admins can register new admin users.
 */
router.post('/', async function(req, res, next){
	console.log(req.body);
	
	var newUser = User();
	newUser.email = req.body.email;
	newUser.salt = crypto.randomBytes(32).toString('hex');
	console.log("Received: " + req.body.password);
	newUser.password = pbkdf2.pbkdf2Sync(req.body.password, newUser.salt, 1, 32, 'sha512').toString('hex');
	if (req.body.admin)
		newUser.admin = req.body.admin;
	newUser.save();
	res.redirect('/addUserSuccess');
});

router.post('/update/:userEmail', async function(req, res, next){

	// try {

	var user = await User.findOne({
		email: req.params.userEmail
	})

		if (req.body.email){
			var user = await User.updateOne(
				{ email: req.params.userEmail },
				{ $set: { email: req.body.email } }
			);
		}

		if (req.body.password){
			let password = pbkdf2.pbkdf2Sync(req.body.password, user.salt, 1, 32, 'sha512').toString('hex');
			var user = await User.updateOne(
				{ email: req.params.userEmail },
				{ $set: { password: password } }
			);
		}

		if (req.body.admin){
			var user = await User.updateOne(
				{ email: req.params.userEmail },
				{ $set: { admin: req.body.admin } }
			);
		}
		
		res.redirect('/settings');

	// } catch {
	// 	res.sendStatus(500);
	// }
});

router.post('/delete/:userEmail', async function(req, res, next){
	if(!req.isAuthenticated()) {
		res.status(404);
		console.log("User not authenticated.");
		res.redirect('/settings');
		return;
	} else {

	// try to delete the user
	try {
		var user = await User.deleteOne({ 
			email: req.params.userEmail 
		});

	} catch {
		res.status(404).redirect('/settings')
	}

	res.redirect('/settings')
}
});


module.exports = { checkAuth, router, User, validPassword };
