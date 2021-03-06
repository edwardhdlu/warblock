// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var UserSchema = mongoose.Schema({
	username		 : { type: String, 
		                 unique: true,
		                 minlength: [3, 'Username must be at least 3 characters.'],
		                 maxlength: [15, 'Username cannot exceed 15 characters.']
		               },
	uid				 : Number,
	
    local            : {
        email        : String,
        password     : String
    },
    
    facebook         : {
        id           : String,
        token        : String,
        email        : String,
        name         : String
    },

    google 			 : {
    	id           : String,
        token        : String,
        email        : String,
        name         : String
    }
});

// SCHEMA TO HOLD AUTO INCREMENTING COUNT
var CounterSchema = mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 1 }
});
var counter = mongoose.model('counter', CounterSchema);


// UPDATE USER ON SAVE
UserSchema.pre('save', function(next) {
	var user = this;
	if (this.isNew) {
	    counter.findByIdAndUpdate({_id: 'uid'}, {$inc: { seq: 1} }, function(error, counter)   {
	        if(error)
	            return next(error);
	        
	        user.uid = counter.seq;
	        user.username = "user" + counter.seq;
	        next();
	    });
	}
});


// methods ======================
// generating a hash
UserSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
UserSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', UserSchema);