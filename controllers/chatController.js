const asyncHandler = require('express-async-handler');
const Chat = require('../models/chatModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const accessChat = asyncHandler(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        throw new AppError('UserId param not send with request', 400);
    }
    // Check if the users are friends
    const areFriends = await User.exists({
        _id: req.user.id,
        friends: userId,
    });

    if (!areFriends) {
        console.log("Users are not friends");
        return res.sendStatus(400);
    }

    let isChat = await Chat.find({
        isGroupChat: false,
        $and: [
            { users: { $elemMatch: { $eq: req.user.id } } },
            { users: { $elemMatch: { $eq: userId } } },
        ],
    })
        .populate('users', '-password')
        .populate('latestMessage');

    isChat = await User.populate(isChat, {
        path: 'latestMessage.sender',
        select: 'name pic email',
    });

    if (isChat.length > 0) {
        res.status(200).json({
            status: 'success',
            data: {
                data: isChat[0],
            },
        });
    } else {
        const chatData = {
            chatName: 'sender',
            isGroupChat: false,
            users: [req.user._id, userId],
        };
        try {
            const createdChat = await Chat.create(chatData);
            const fullChat = await Chat.findOne({
                _id: createdChat._id,
            }).populate('users', '-password');
            res.status(200).json({
                status: 'success',
                data: {
                    data: fullChat,
                },
            });
        } catch (error) {
            throw new AppError(error.message, 400);
        }
    }
});

const fetchChats = asyncHandler(async (req, res) => {
    try {
        Chat.find({ users: { $elemMatch: { $eq: req.user.id } } })
            .populate('users', '-password')
            .populate('groupAdmin', '-password')
            .populate('latestMessage')
            .sort({ updatedAt: -1 })
            .then(async (results) => {
                results = await User.populate(results, {
                    path: 'latestMessage.sender',
                    select: 'name pic email',
                });
                res.status(200).json({
                    status: 'success',
                    results: results.length,
                    requestedAt: req.requestTime,
                    data: {
                        data: results,
                    },
                });
            });
    } catch (error) {
        throw new AppError(error.message, 400);
    }
});

const createGroupChat = asyncHandler(async (req, res) => {
    if (!req.body.users || !req.body.name) {
        return res.status(400).send({ message: 'Please fill all the fields' });
    }
    const users = req.body.users;
    if (users.length < 2) {
        return res.status(400).send({
            message: 'More than 2 users are required to form a group chat',
        });
    }
    if (!users.find((user) => user === req.user._id.toString()))
        users.push(req.user._id);

    try {
        const groupChat = await Chat.create({
            chatName: req.body.name,
            users: users,
            isGroupChat: true,
            groupAdmin: req.user,
        });

        const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
            .populate('users', '-password')
            .populate('groupAdmin', '-password');

        res.status(200).send({ data: fullGroupChat, status: 'success' });
    } catch (error) {
        throw new AppError(error.message, 400);
    }
});

const renameGroup = asyncHandler(async (req, res) => {
    const { chatId, chatName } = req.body;
    const updatedChat = await Chat.findByIdAndUpdate(
        chatId,
        {
            chatName,
        },
        {
            new: true,
        }
    )
        .populate('users', '-password')
        .populate('groupAdmin', '-password');

    if (!updatedChat) {
        throw new AppError('Chat not found', 404);
    } else {
        res.status(200).json({ status: 'success', data: updatedChat });
    }
});

const addToGroup = catchAsync(async (req, res, next) => {
    const { chatId, userIds } = req.body;
    const chat = await Chat.findById(chatId).populate('users', '_id');
    const user = chat.users.find((user) =>
        userIds.find((newUser) => user._id.toString() === newUser)
    );
    if (user) return next(new AppError('User already in room', 400));
    const added = await Chat.findByIdAndUpdate(
        chatId,
        {
            $push: { users: { $each: userIds } },
        },
        {
            new: true,
        }
    )
        .populate('users', '-password')
        .populate('groupAdmin', '-password');

    if (!added) {
        throw new AppError('Chat not found', 404);
    } else {
        res.status(200).json({ status: 'success', data: added });
    }
});

const removeFromGroup = asyncHandler(async (req, res) => {
    const { chatId, userId } = req.body;
    const removed = await Chat.findByIdAndUpdate(
        chatId,
        {
            $pull: { users: userId },
        },
        {
            new: true,
        }
    )
        .populate('users', '-password')
        .populate('groupAdmin', '-password');

    if (!removed) {
        throw new AppError('Chat not found', 404);
    } else {
        res.status(201).json({ status: 'success', data: removed });
    }
});

module.exports = {
    accessChat,
    fetchChats,
    createGroupChat,
    renameGroup,
    addToGroup,
    removeFromGroup,
};
