/**
 * JournalAPI
 *
 * An API for storing journal entries along with
 * location data, mood data, and weather data.
 *
 * This file handles all the journal entry information routes,
 * and should enable our users to create update, get, and delete
 * their entries.
 *
 * CIS 371 - Fall 2021
 *
 */

/**********
 * Load all the libraries we need.
 **********/

var express = require('express');
var router = express.Router();
var user = require('./users.js');
var checkAuth = user.checkAuth;

/**
 * Create the schemas we will need.
 * Point is just a GEOJson lat/long coordinate.
 * Entry is a journal entry.
 */

// Pull in the mongoose library
const mongoose = require('mongoose');
const { Schema } = mongoose;

const pointSchema = new Schema({
	type: {
		type: String,
		enum: ['Point'],
		required: true
	},
	coordinates: {
		type: [Number],
		required: true
	}
});

const entrySchema = new Schema({
	userId: mongoose.ObjectId,
        date: {
		type: Date,
		default: Date.now
	},
	mood: {
		type: String,
		required: true
	},
	entry: {
		type: String,
		required: true
	},
	location: {
		type: pointSchema
		// required: true
	},
	weather: String
});

// Really don't need the one for Point, but eh...
const Point = mongoose.model('Point', pointSchema);
const Entry = mongoose.model('Entry', entrySchema);

/* GET full entry listing for logged in user. */
router.get('/', checkAuth, async function(req, res, next) {
	var entries = await Entry.find({ userId: req.user._id });
	res.status(200);
	res.json(entries);
});

/**
 * Get single entry for logged in user
 */

router.get('/:entryId', checkAuth, async function(req, res, next){
	var entry = await Entry.findOne({
		_id : req.params.entryId
	});
	if(entry.userId == req.user._id || req.user.admin == true){
		res.json(entry);
	} else {
		var error = new Error("Not found. Cannot make entry.");
		error.status = 404;
			throw error;
	}
});

/**
 * Allow logged in user to create new entry.
 */
router.post('/', async function(req, res, next){
	if(!(req.body.entry && req.body.mood)){
		var error = new Error('Missing required information.');
		error.status = 400;
		throw error;
	}
	var entry = new Entry({
		userId: req.user._id,
		entry: req.body.entry,
		mood: req.body.mood
		// location: req.body.location
	});
	entry.save();
	res.status(200);
	res.redirect('/journal');
});

/**
 * Allow a user to modify their own entry.
 */
router.post('/modify/:entryId', async function(req, res, next){
	var entry = await Entry.findOne({
		userId : req.user._id,
		_id : req.params.entryId
	});

	if(!entry){
		var error = new Error('Entry not found.');
		error.status = 404;
		throw error;
	}

	try {
		if (req.body.entry == '' && req.body.mood == '') {
			// set both to previous values
			console.log("NO PARAMS BRO");
			req.body.entry = entry.entry;
			req.body.mood = entry.mood;
			var newEntry = await Entry.findByIdAndUpdate(req.params.entryId, req.body);
		} else if (req.body.mood == '' && req.body.entry != '') {
			// set mood to prev mood
			req.body.mood = entry.mood;
			var newEntry = await Entry.findByIdAndUpdate(req.params.entryId, req.body);
		} else if (req.body.entry == '' && req.body.mood != '') {
			// set entry to prev entry
			req.body.entry = entry.entry;
			var entry = await Entry.findByIdAndUpdate(req.params.entryId, req.body);
		} else {
			// update both
			var entry = await Entry.findByIdAndUpdate(req.params.entryId, req.body);
		}
		res.status(200);
		res.redirect('/journal');
	} catch {
		res.sendStatus(404);
	}

});

/**
 * Allow a user to delete one of their own entries.
 */
router.post('/delete/:entryId', checkAuth, async function(req, res,next){
	
	// make sure the entry exists and is owned by user
	const entries = await Entry.find({ 
		$and: [
			{ userId: req.user._id },
			{ _id: req.params.entryId }
		]
	});
 
	// if no entries found somehow, 404
	if(entries.length == 0){
		res.status(404).send("No notes to delete...");
		return;
	}
 
	// otherwise, delete the entry
	try {
		var entry = await Entry.findByIdAndRemove(req.params.entryId);
		res.status(200);
		res.redirect('/journal')
	} catch {
		res.status(404).redirect('/journal')
	}
});

module.exports = { router, Entry };
