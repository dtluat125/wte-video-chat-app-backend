const express = require('express'); //
const authController = require('../controllers/authController');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.post('/', authController.protect, messageController.sendMessage);
router.get(
    '/:chatId',
    authController.protect,
    messageController.getAllMessages
);

module.exports = router;
