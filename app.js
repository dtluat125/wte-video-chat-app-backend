const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');
const userRouter = require('./routes/userRoutes');

const app = express();

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
//1 Middleware
// Set security https header
app.use(compression());
app.enable('trust proxy');

app.set('views', path.join(__dirname, 'views'));

// Implement CORS
app.use(cors());
app.options('*', cors());

app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
    })
);

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'", 'data:', 'blob:'],

            baseUri: ["'self'"],

            fontSrc: ["'self'", 'https:', 'data:'],

            scriptSrc: [
                "'self'",
                'https://*.cloudflare.com',
                'http:',
                'https://*.mapbox.com',
                'data:',
            ],

            frameSrc: ["'self'", 'https://*.stripe.com'],

            objectSrc: ["'none'"],

            styleSrc: ["'self'", 'https:', 'unsafe-inline'],

            workerSrc: ["'self'", 'data:', 'blob:'],

            childSrc: ["'self'", 'blob:'],

            imgSrc: ["'self'", 'data:', 'blob:'],

            connectSrc: ["'self'", 'blob:', 'https://*.mapbox.com'],

            upgradeInsecureRequests: [],
        },
    })
);

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}
// Limit request from the same api
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour',
});
app.use('/api', limiter);
// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

app.use(cookieParser());

app.use(express.urlencoded({ extended: true, limit: '10kb' }));

//Data sanitization against NoSQL query injection
app.use(mongoSanitize());
//Data sanitization against XSS
app.use(xss());
// hpp
app.use(
    hpp({
        whitelist: [
            'duration',
            'ratingsQuantity',
            'ratingsAverage',
            'maxGroupSize',
            'difficulty',
            'price',
        ],
    })
);

// Serving static files
app.use(express.static(`${__dirname}/public`));

// Test middleware
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});

app.use('/api/v1/users', userRouter);

app.all('*', (req, res, next) => {
    // err.statusCode = 404;
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);
//4 Server
module.exports = app;
