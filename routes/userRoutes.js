const express = require('express');

const userController = require('../controllers/userControlller');
const authController = require('../controllers/authController');

const router = express.Router();
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

router.use(authController.protect);

router.patch('/updatePassword', authController.updatePassword);
router.patch(
    '/updateMe',
    userController.uploadUserPhoto,
    userController.resizeUserPhoto,
    userController.updateMe
);
router.delete('/deleteMe', userController.deleteMe);


router
    .route('/')
    .get(userController.getAllUsers)
    .post(userController.createUser);
router.route('/me').get(userController.getMe, userController.getUser);
router
    .route('/:id')
    .get(userController.getUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);


// Friend request routes
router.post('/friend-request', userController.sendFriendRequest);
router.patch('/friend-request/:id/accept', userController.acceptFriendRequest);
router.patch('/friend-request/:id/reject', userController.rejectFriendRequest);

// Notification routes
router.get('/notifications', userController.getNotifications);
router.patch('/notifications/:id/mark-as-read', userController.markNotificationAsRead);


module.exports = router;
