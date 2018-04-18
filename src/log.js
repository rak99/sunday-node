import winston from 'winston';
import timber from 'timber';

const transport = new timber.transports.HTTPS(
  '2687_89c5c219d4f311ac:389409bb0987067a7af1e6f10f2cc4b617558df4b083223a91db01e7245726f8',
);
timber.install(transport);

const log = winston.createLogger({
  transports: [
  ],
});

log.add(
  new winston.transports.Console({
    format: winston.format.simple(),
  }),
);

export default log;
