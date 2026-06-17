import { Injectable } from '@nestjs/common';
import { CheckStatus } from '@service-monitor/shared';

@Injectable()
export class AppService {
  getHello(): string {
    return `service-monitor API up. default status=${CheckStatus.Up}`;
  }
}
