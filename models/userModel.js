const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Notification = require('./notificationModel');

const Schema = mongoose.Schema;

const friendRequestSchema = new Schema({
    requester: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: Number,
        required: true,
        default: 0 // 0= not requested, 1 = requested, 2 = accepted, 3 = rejected
    },
    time: {
        type: Date,
        default: Date.now
    }
});

const userSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Please tell us your name'],
        maxLength: [40, 'A name must have less than or equal to 40 chars'],
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        validate: {
            validator: (val) => validator.isEmail(val),
            message: 'Invalid email',
        },
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: [true, 'An user should have a password'],
        minLength: [6, 'A password must have more than or equal to 6 chars'],
        select: false,
    },
    passwordConfirm: {
        type: String,
        required: true,
        validate: {
            validator: function (val) {
                return val === this.password;
            },
            message: 'Password and confirm password must be the same',
        },
    },
    photo: {
        type: String,
        default: 'images/default.jpg',
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
        type: Boolean,
        default: true,
        select: false,
    },
    friends: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordConfirm = undefined;
    next();
});

userSchema.pre('save', function (next) {
    if (!this.isModified('password') || this.isNew) return next();
    this.passwordChangedAt = Date.now() - 1000;
    next();
});

userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

userSchema.methods.createPasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    return resetToken;
};

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);
const User = mongoose.model('User', userSchema);

module.exports = { User, FriendRequest};
