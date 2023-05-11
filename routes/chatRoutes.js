const express = require('express'); //
const userController = require('../controllers/userControlller');
const authController = require('../controllers/authController');
const { accessChat } = require('../controllers/chatController');

const router = express.Router();

router.route('/').post(authController.protect, accessChat);
//router.route('/').get(authController.protect, fetchChats);
//router.route('/group').post(authController.protect, createGroupChat);
//router.route('/rename').put(authController.protect, renameGroup);
//router.route('/groupremove').put(authController.protect, removeFromGroup);
//router.route('/groupadd').put(authController.protect, addToGroup);

module.exports = router;