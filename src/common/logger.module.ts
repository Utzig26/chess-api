import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.getOrThrow<AppConfig>('app');
        const isProduction = app.environment === 'production';

        return {
          pinoHttp: {
            level: app.logLevel,
            genReqId: (request: IncomingMessage) =>
              request.headers['x-request-id']?.toString() ?? randomUUID(),
            autoLogging: app.environment !== 'test',
            quietReqLogger: true,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                '*.password',
                '*.accessToken',
                '*.refreshToken',
              ],
              censor: '[redacted]',
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
