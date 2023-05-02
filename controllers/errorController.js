const AppError = require('../utils/appError');

const handleJWTError = (err) =>
  new AppError('Invalid token, please login again', 401);

const handleJWTExpiredError = (err) =>
  new AppError('Your token has expired, please try again', 401);

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (error) => {
  //   const value = error.message?.match(/(?<=\[)(.*?)(?=\])/);
  const value = [];
  const keys = Object.keys(error.keyValue);
  for (let i = 0; i < keys.length; i += 1) {
    value.push(error.keyValue[keys[i]]);
  }
  const valueStr = value.toString();
  const message = `Duplicate field value: '${valueStr}'. Please use another value`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (error) => {
  const errors = Object.values(error.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};
const sendErrorDev = (err, req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      message: err.message,
    });
  }
};

const sendErrorProd = (err, req, res) => {
  //Operational, trusted error: send to client
  if (req.originalUrl.startsWith('/api/')) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
      //Programming or unknown error
    }
    // console.log('ERROR\n', err);
    return res.status(500).json({
      status: 'error',
      message: 'Some thing went wrong',
    });
  }
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      message: err.message,
    });
  }

  return res.status(500).render('error', {
    title: 'Something went wrong!',
    message: 'Please try again later.',
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJWTError(error);
    if (err.name === 'TokenExpiredError') {
      error = handleJWTExpiredError(error);
    }
    sendErrorProd(error, req, res);
  }
  next();
};
