require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

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
