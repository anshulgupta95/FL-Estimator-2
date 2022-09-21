var { createLogger, format, transports } = require('winston');

let logger = createLogger({
    transports: [
        new (transports.Console)({
            // level: 'warn',
            timestamp: true
            // json: false
        }),
        new transports.File({
            level: 'error',
            // json: false,
            filename: 'logs/debug.log',
            format:format.combine(
                format.timestamp({format: 'MMM-DD-YYYY HH:mm:ss'}),
                format.align(),
                format.printf(info => `${info.level}: ${[info.timestamp]}: ${info.message}`),
            )
        })
    ],
    exceptionHandlers: [
        new (transports.Console)({
            // level: 'warn',
            // json: false
            timestamp: true
        }),
        new transports.File({
            // level: 'warn',
            // json: false,
            filename: 'logs/exceptions.log',
            format:format.combine(
                format.timestamp({format: 'MMM-DD-YYYY HH:mm:ss'}),
                format.align(),
                format.printf(info => `${info.level}: ${[info.timestamp]}: ${info.message}`),
            )
        })
    ],
    exitOnError: false
});

module.exports = logger;