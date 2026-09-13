import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProjectsModule } from './projects/projects.module';
import { ObservationsModule } from './observations/observations.module';
import { MilestonesModule } from './milestones/milestones.module';
import { AuthModule } from './auth/auth.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ProjectsController } from './projects/projects.controller';
import { ObservationsController } from './observations/observations.controller';
import { MilestonesController } from './milestones/milestones.controller';
import { AuthController } from './auth/auth.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ProjectsModule,
    ObservationsModule,
    MilestonesModule,
    AuthModule,
    ConfigModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes(
        ProjectsController,
        ObservationsController,
        MilestonesController,
        AuthController,
      );
  }
}
