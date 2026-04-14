import { Injectable } from '@nestjs/common';

@Injectable()
export class ZtncuiSessionService {
  private readonly cookies = new Map<number, string>();

  clear(controllerId: number) {
    this.cookies.delete(controllerId);
  }

  get(controllerId: number) {
    return this.cookies.get(controllerId) ?? null;
  }

  set(controllerId: number, cookieHeader: string) {
    this.cookies.set(controllerId, cookieHeader);
  }
}
