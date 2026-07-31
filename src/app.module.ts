import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoreModule } from './common/core.module';
import { ConfigModule } from './config/config.module';
import { DatabaseConfig } from './config/configuration';

@Module({
  imports: [
    ConfigModule,
    CoreModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const database = config.getOrThrow<DatabaseConfig>('database');

        return {
          uri: database.uri,
          dbName: database.name,
          ...(database.username
            ? {
                authSource: 'admin',
                auth: {
                  username: database.username,
                  password: database.password,
                },
              }
            : {}),
        };
      },
    }),
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
