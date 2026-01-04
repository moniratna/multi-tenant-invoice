import { Module } from '@nestjs/common';
import { AiExplanationService } from './ai-explanation.service';
import { AiExplanationController } from './ai-explanation.controller';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockAiProvider } from './providers/mock.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [AiExplanationController],
  providers: [
    AiExplanationService,
    DatabaseService,
    OpenAiProvider,
    AnthropicProvider,
    MockAiProvider,
  ],
  exports: [AiExplanationService],
})
export class AiExplanationModule {}
