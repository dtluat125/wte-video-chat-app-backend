const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const promises = require('fs').promises;
const { promisify } = require('util');

const signAccessToken = (id) => {
    return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRE,
    });
};

const signRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRE,
    });
};

exports.signup = catchAsync(async (req, res, next) => {
    const existEmail = await User.findOne({ email: req.body.email });
    if (existEmail) return next(new AppError('Email already taken!', 409));

    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        passwordChangedAt: req.body.passwordChangedAt,
        role: req.body.role,
        passwordResetToken: req.body.passwordResetToken,
        passwordResetExpires: req.body.passwordResetExpires,
    });
    const url = `${req.protocol}://${req.get('host')}/me`;
    createAndSendToken(newUser, 201, req, res);
});

const createAndSendToken = (user, statusCode, req, res) => {
    const accessToken = signAccessToken(user._id);

    const cookieOptions = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 50 * 1000
        ),
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        httpOnly: true,
    };
    res.cookie('jwt', accessToken, cookieOptions);
    res.status(statusCode).json({
        success: true,
        status: 'success',
        token: accessToken,
        data: {
            user,
        },
    });
};

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password)
        return next(new AppError('PLease provide email and password', 400));
    // If user exist and password is correct
    const user = await User.findOne({ email: email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password)))
        return next(new AppError('Incorrect email or password', 401));
    // Send token to client if things are okay
    createAndSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
    //Getting token
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(
            new AppError(
                'You are not logged in, please log in to get access',
                401
            )
        );
    }
    //Verification token
    const decoded = await promisify(jwt.verify)(
        token,
        process.env.ACCESS_TOKEN_SECRET
    );
    //Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(
            new AppError(
                'The user belonging to this token no longer exist',
                401
            )
        );
    }
    //Check if user change password after jwt was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(
            new AppError(
                'The password for this account has been changed, please login again',
                401
            )
        );
    }
    // Grant access to protected routes
    req.user = currentUser;
    next();
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
    //get user based on posted email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return next(
            new AppError('There is no user with this email address.', 404)
        );
    }
    //generate random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    //send it to user email

    try {
        const resetURL = `${req.protocol}://${req.get(
            'host'
        )}/api/v1/users/resetPassword/${resetToken}`;
        // await new Email(user, resetURL).sendPasswordReset();

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email',
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(
            new AppError(
                'There was an error sending the mail. Try again later',
                500
            )
        );
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    //get user based on the token
    const resetToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');
    const user = await User.findOne({
        passwordResetToken: resetToken,
        passwordResetExpires: {
            $gte: Date.now(),
        },
    });
    //if token has not expired, and there is user, set new password
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();
    createAndSendToken(user, 200, req, res);

    //Update changePasswordAt property
    //Log the user in
});

exports.updatePassword = catchAsync(async (req, res, next) => {
    //  get user from collection
    const { user } = req;
    const docUser = await User.findById(user._id).select('+password');
    // check if posted password is correct
    const correct = await docUser.correctPassword(
        req.body.passwordCurrent,
        docUser.password
    );

    if (!correct) {
        return next(new AppError('Incorrect password! Please try again', 401));
    }
    // update password
    docUser.password = req.body.password;
    docUser.passwordConfirm = req.body.passwordConfirm;
    await docUser.save();
    // Log user in, send jwt
    createAndSendToken(docUser, 200, req, res);
});
