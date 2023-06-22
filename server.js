require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const ChatEvent = {
    SETUP: 'SET_UP',
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    JOIN_CHAT: 'JOIN_CHAT',
    NEW_MESSAGE: 'NEW_MESSAGE',
    TYPING: 'TYPING',
    STOP_TYPING: 'STOP_TYPING',
    ACTIVE: 'ACTIVE',
    GLOBAL_ACTIVE: 'GLOBAL_ACTIVE',
    INACTIVE: 'INACTIVE',
};

const mongoString = process.env.MONGO_URI;
mongoose
    .connect(mongoString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log('DB connections successfull!');
    });

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.log(`App running on port ${port}...`);
});

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    },
});
const activeUserIds = [];

io.on('connection', (socket) => {
    console.log('connected to socket io');
    let userId;
    socket.on(ChatEvent.SETUP, (userData) => {
        console.log('userData connect with socket.id:', socket.id);
        console.log('socket join roomID:', userData._id);
        socket.join(userData._id);
        userId = userData._id;
        if (!activeUserIds.find((userId) => userId === userData._id))
            activeUserIds.push(userData._id);
        socket.emit('connected');
        console.log(activeUserIds);
        socket.emit(ChatEvent.ACTIVE, activeUserIds);
        io.emit(ChatEvent.GLOBAL_ACTIVE, activeUserIds);
    });

    socket.on(ChatEvent.JOIN_CHAT, (room) => {
        socket.join(room);
        console.log('User joined room : ' + room);
    });

    socket.on(ChatEvent.NEW_MESSAGE, (newMessage) => {
        const chat = newMessage.chat;
        if (!chat.users) return console.log('chat.users not defined');
        chat.users.forEach((user) => {
            // if (user._id === newMessage.sender._id) return;
            io.to(user._id).emit(ChatEvent.MESSAGE_RECEIVED, newMessage);
            console.log('sender', newMessage.sender._id);
            console.log(
                'Socket in: ',
                user._id,
                ' - ',
                io.sockets.adapter.rooms.get(user._id)
            );
        });
    });

    socket.on(ChatEvent.TYPING, (room, sender) => {
        room.users.forEach((user) => {
            io.to(user._id).emit(ChatEvent.TYPING, room._id);
        });
    });

    socket.on(ChatEvent.STOP_TYPING, (room) => {
        room.users.forEach((user) => {
            io.to(user._id).emit(ChatEvent.STOP_TYPING, room._id);
        });
    });

    socket.on('disconnect', () => {
        console.log(
            'client disconnected',
            userId,
            io?.sockets?.adapter?.rooms?.get(userId)
        );
        if (
            !io?.sockets?.adapter?.rooms?.get(userId) ||
            io?.sockets?.adapter?.rooms?.get(userId)?.size === 0
        ) {
            io.emit(ChatEvent.INACTIVE, userId);
            const index = activeUserIds.findIndex((id) => id === userId);
            activeUserIds.splice(index, 1);
        }
    });
}).on('error', (err) => {
    console.log(err.message);
});

process.on('unhandledRejection', (err) => {
    console.log(err.name, err.message);
    console.log('UNHANDLED REJECTION');
    server.close(() => {
        process.exit(1);
    });
});

process.on('uncaughtException', (err) => {
    console.log('Uncaught exception', err);
    server.close(() => {
        process.exit(1);
    });
});

process.on('SIGTERM', () => {
    console.log('SIGTERM RECEIVED, shutting down!');
    server.close(() => {
        console.log('Process terminated');
    });
});
