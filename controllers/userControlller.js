const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const multer = require('multer');
const sharp = require('sharp');
const FriendRequest = require('../models/userModel');
const Notification = require('../models/notificationModel')

const asyncHandler = require('express-async-handler');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image', 400));
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);
  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};
exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'Error',
    message: 'This route is not yet defined',
  });
};

exports.updateUser = factory.updateOne(User);

exports.deleteUser = factory.deleteOne(User);

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user post password data
  if (req.body.password || req.body.passwordCofirm) {
    return next(new AppError('This route is not for updating password!'));
  }
  // 2) Update user document
  // filter out unwanted fields
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) filteredBody.photo = req.file.filename;
  const updateUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    status: 'success',
    data: { updateUser },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Send Friend Request
exports.sendFriendRequest = asyncHandler(async (req, res) => {
  const { recipientId } = req.body;

  if (!recipientId) {
    return res.status(400).json({ message: 'Recipient ID is required' });
  }

  const recipient = await User.findById(recipientId);

  if (!recipient) {
    return res.status(404).json({ message: 'Recipient not found' });
  }

  const friendRequest = await FriendRequest.create({
    requester: req.user._id,
    recipient: recipientId,
    status: 1, // 1 = requested
  });

  // Create notification for the recipient
  const notification = await Notification.create({
    user: recipientId,
    message: `${req.user.name} sent you a friend request`,
    type: 'friend_request',
  });

  res.status(201).json({ friendRequest, notification });
});

// Accept Friend Request
exports.acceptFriendRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const friendRequest = await FriendRequest.findByIdAndUpdate(
    id,
    { status: 2 }, // 2 = accepted
    { new: true }
  );

  if (!friendRequest) {
    return res.status(404).json({ message: 'Friend request not found' });
  }

  const requester = await User.findById(friendRequest.requester);
  const recipient = await User.findById(friendRequest.recipient);

  // Add users to each other's friends list
  requester.friends.push(recipient._id);
  recipient.friends.push(requester._id);

  await requester.save();
  await recipient.save();

  // Create notification for the requester
  const notification = await Notification.create({
    user: friendRequest.requester,
    message: `${recipient.name} accepted your friend request`,
    type: 'friend_accept',
  });

  res.status(200).json({ friendRequest, notification });
});

// Reject Friend Request
exports.rejectFriendRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const friendRequest = await FriendRequest.findByIdAndUpdate(
    id,
    { status: 3 }, // 3 = rejected
    { new: true }
  );

  if (!friendRequest) {
    return res.status(404).json({ message: 'Friend request not found' });
  }

  const recipient = await User.findById(friendRequest.recipient);

  // Create notification for the requester
  const notification = await Notification.create({
    user: friendRequest.requester,
    message: `${recipient.name} rejected your friend request`,
    type: 'friend_reject',
  });

  res.status(200).json({ friendRequest, notification });
});

// Get Notifications
exports.getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('user', 'name');

  res.status(200).json(notifications);
});

// Mark Notification as Read
exports.markNotificationAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndUpdate(
    id,
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.status(200).json(notification);
});





