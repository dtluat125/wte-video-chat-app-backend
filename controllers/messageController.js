const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const Chat = require('../models/chatModel');

exports.sendMessage = catchAsync(async (req, res, next) => {
    const { content, chatId } = req.body;
    if (!content || !chatId)
        return next(new AppError('Invalid data passed into request', 400));
    const newMessage = {
        sender: req.user._id,
        content,
        chat: chatId,
    };

    let message = await Message.create(newMessage);
    message = await message.populate('sender', 'name photo');
    message = await message.populate('chat');
    message = await User.populate(message, {
        path: 'chat.users',
        select: 'name photo email',
    });

    await Chat.findByIdAndUpdate(req.body.chatId, {
        latestMessage: message,
    });

    res.status(201).json({
        status: 'success',
        data: message,
    });
});

exports.getAllMessages = catchAsync(async (req, res, next) => {
    const messages = await Message.find({ chat: req.params.chatId }).populate(
        'sender',
        'name photo email'
    );
    res.status(200).json({
        status: 'success',
        data: messages,
    });
});
