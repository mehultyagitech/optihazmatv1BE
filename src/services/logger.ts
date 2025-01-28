import { createLogger, format, transports, Logger } from "winston";
import path from "path";
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "blue",
  },
};

const logger: Logger = createLogger({
  levels: customLevels.levels,
  format: format.combine(
    format.colorize({ all: true }),
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`)
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(__dirname, "logs", "custom.log") }),
  ],
});

export default logger;
