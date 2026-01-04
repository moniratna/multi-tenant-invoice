import { Module, Global } from '@nestjs/common';
import { PythonBackendClient } from './python-backend.client';

@Global()
@Module({
  providers: [PythonBackendClient],
  exports: [PythonBackendClient],
})
export class ClientsModule {}
