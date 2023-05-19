require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const ChatEvent = {
    SETUP: 'SET_UP',
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    JOIN_CHAT: 'JOIN_CHAT',
    NEW_MESSAGE: 'NEW_MESSAGE',
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

io.on('connection', (socket) => {
    console.log('connected to socket io');
    socket.on(ChatEvent.SETUP, (userData) => {
        console.log('userData connect with socket.id:', socket.id);

        socket.join(userData._id);
        socket.emit('connected');
    });

    socket.on(ChatEvent.JOIN_CHAT, (room) => {
        socket.join(room);
        console.log(socket.id);
        console.log('User joined room : ' + room);
    });

    socket.on(ChatEvent.NEW_MESSAGE, (newMessage) => {
        const chat = newMessage.chat;
        console.log(chat);
        if (!chat.users) return console.log('chat.users not defined');
        chat.users.forEach((user) => {
            if (user._id === newMessage.sender._id) return;
            socket.in(user._id).emit(ChatEvent.MESSAGE_RECEIVED, newMessage);
        });
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
    console.log('Uncaught exception');
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
