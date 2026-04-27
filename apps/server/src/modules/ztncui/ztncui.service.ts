import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ControllerConfig } from '../controllers/controllers.types';
import { parseControllerHome } from './parsers/controller.parser';
import { parseNetworkDetail, parseNetworkList } from './parsers/network.parser';
import { ZtncuiSessionService } from './ztncui-session.service';

interface ZtncuiRequestOptions {
  allowAnyRedirect?: boolean;
  form?: Record<string, string>;
  method: 'GET' | 'POST';
  path: string;
  timeoutMs?: number;
}

interface ZtncuiResponse {
  body: string;
  headers: Headers;
  status: number;
}

class ZtncuiRequestTimeoutError extends Error {}

const DEFAULT_ZTNCUI_REQUEST_TIMEOUT_MS = 10_000;
const MEMBER_NAME_UPDATE_TIMEOUT_MS = 8_000;
const MEMBER_NAME_UPDATE_RETRY_COUNT = 3;
const MEMBER_NAME_VERIFY_TIMEOUT_MS = 5_000;
const MEMBER_NAME_VERIFY_RETRY_COUNT = 3;
const MEMBER_NAME_VERIFY_INTERVAL_MS = 1_000;

function containsNonAscii(value: string) {
  return /[^\x00-\x7F]/.test(value);
}

@Injectable()
export class ZtncuiService {
  constructor(private readonly sessionService: ZtncuiSessionService) {}

  clearSession(controllerId: number) {
    this.sessionService.clear(controllerId);
  }

  async testConnection(controller: ControllerConfig) {
    const cookieHeader = await this.login(controller);
    const response = await this.fetchText(controller, {
      cookieHeader,
      method: 'GET',
      path: '/controller',
    });

    if (response.status >= 400) {
      throw new BadGatewayException('无法访问 ztncui 控制器首页');
    }

    return parseControllerHome(response.body);
  }

  async listNetworks(controller: ControllerConfig) {
    const response = await this.request(controller, {
      method: 'GET',
      path: '/controller/networks',
    });

    return parseNetworkList(response.body);
  }

  async getNetworkDetail(
    controller: ControllerConfig,
    networkId: string,
    options: { timeoutMs?: number } = {},
  ) {
    const response = await this.request(controller, {
      method: 'GET',
      path: `/controller/network/${networkId}`,
      timeoutMs: options.timeoutMs,
    });

    return parseNetworkDetail(response.body);
  }

  async createNetwork(controller: ControllerConfig, name: string) {
    const response = await this.request(
      controller,
      {
        form: {
          name,
        },
        method: 'POST',
        path: '/controller/network/create',
      },
      true,
    );

    const location = response.headers.get('location');
    if (!location) {
      throw new BadGatewayException('ztncui 创建网络后未返回重定向');
    }

    const match = location.match(/\/controller\/network\/([a-z0-9]{16})/i);
    if (!match) {
      throw new BadGatewayException('无法从 ztncui 响应中解析新建网络 ID');
    }

    return {
      networkId: match[1],
    };
  }

  async setNetworkPrivate(
    controller: ControllerConfig,
    networkId: string,
    isPrivate: boolean,
  ) {
    await this.request(controller, {
      form: {
        private: String(isPrivate),
      },
      method: 'POST',
      path: `/controller/network/${networkId}/private`,
    });
  }

  async easySetupNetwork(
    controller: ControllerConfig,
    networkId: string,
    payload: { networkCIDR: string; poolEnd: string; poolStart: string },
  ) {
    await this.request(controller, {
      form: payload,
      method: 'POST',
      path: `/controller/network/${networkId}/easy`,
    });
  }

  async renameNetwork(controller: ControllerConfig, networkId: string, name: string) {
    await this.request(controller, {
      form: {
        name,
      },
      method: 'POST',
      path: `/controller/network/${networkId}/name`,
    });
  }

  async deleteNetwork(controller: ControllerConfig, networkId: string) {
    await this.request(controller, {
      form: {},
      method: 'POST',
      path: `/controller/network/${networkId}/delete`,
    });
  }

  async setMemberAuthorized(
    controller: ControllerConfig,
    networkId: string,
    memberId: string,
    authorized: boolean,
    options: { timeoutMs?: number } = {},
  ) {
    await this.request(controller, {
      form: {
        auth: String(authorized),
        id: memberId,
      },
      method: 'POST',
      path: `/controller/network/${networkId}/members`,
      timeoutMs: options.timeoutMs,
    });
  }

  async setMemberName(
    controller: ControllerConfig,
    networkId: string,
    memberId: string,
    memberName: string,
  ) {
    const directResult = await this.trySetMemberName(
      controller,
      networkId,
      memberId,
      memberName,
    );
    if (directResult.confirmed || !containsNonAscii(memberName)) {
      return directResult;
    }

    const asciiBridgeName = `zt-${memberId}`;
    const bridgeResult = await this.trySetMemberName(
      controller,
      networkId,
      memberId,
      asciiBridgeName,
    );
    if (!bridgeResult.confirmed) {
      return {
        confirmed: false,
        requestTimedOut: directResult.requestTimedOut || bridgeResult.requestTimedOut,
      };
    }

    const finalResult = await this.trySetMemberName(
      controller,
      networkId,
      memberId,
      memberName,
    );
    if (finalResult.confirmed) {
      return finalResult;
    }

    return {
      confirmed: false,
      requestTimedOut:
        directResult.requestTimedOut ||
        bridgeResult.requestTimedOut ||
        finalResult.requestTimedOut,
    };
  }

  async verifyMemberName(
    controller: ControllerConfig,
    networkId: string,
    memberId: string,
    memberName: string,
  ) {
    return this.verifyMemberNameApplied(
      controller,
      networkId,
      memberId,
      memberName,
    );
  }

  async deleteMember(controller: ControllerConfig, networkId: string, memberId: string) {
    await this.request(controller, {
      form: {},
      method: 'POST',
      path: `/controller/network/${networkId}/member/${memberId}/delete`,
    });
  }

  private async ensureSession(controller: ControllerConfig) {
    const existingCookieHeader = this.sessionService.get(controller.id);
    if (existingCookieHeader) {
      return existingCookieHeader;
    }

    return this.login(controller);
  }

  private async login(controller: ControllerConfig) {
    const response = await this.fetchText(controller, {
      form: {
        password: controller.password,
        username: controller.username,
      },
      method: 'POST',
      path: '/login',
    });

    if (response.status !== 302 || response.headers.get('location') !== '/controller') {
      throw new UnauthorizedException(`控制器 ${controller.name} 的 ztncui 登录失败`);
    }

    const cookieHeader = this.extractCookieHeader(response.headers);
    if (!cookieHeader) {
      throw new UnauthorizedException(`控制器 ${controller.name} 登录后未返回会话 Cookie`);
    }

    this.sessionService.set(controller.id, cookieHeader);
    return cookieHeader;
  }

  private async request(
    controller: ControllerConfig,
    options: ZtncuiRequestOptions,
    allowAnyRedirect = false,
  ): Promise<ZtncuiResponse> {
    const cookieHeader = await this.ensureSession(controller);
    const response = await this.fetchText(controller, {
      ...options,
      cookieHeader,
    });

    if (this.isUnauthenticatedResponse(response)) {
      this.sessionService.clear(controller.id);
      const retryCookieHeader = await this.login(controller);
      const retryResponse = await this.fetchText(controller, {
        ...options,
        cookieHeader: retryCookieHeader,
      });

      this.ensureValidResponse(retryResponse, allowAnyRedirect);
      return retryResponse;
    }

    this.ensureValidResponse(response, allowAnyRedirect);
    return response;
  }

  private ensureValidResponse(response: ZtncuiResponse, allowAnyRedirect: boolean) {
    if (response.status >= 400) {
      throw new BadGatewayException(`ztncui 请求失败，状态码 ${response.status}`);
    }

    if (response.status >= 300 && response.status < 400 && !allowAnyRedirect) {
      throw new BadGatewayException('ztncui 返回了未预期的重定向响应');
    }
  }

  private isUnauthenticatedResponse(response: ZtncuiResponse) {
    if (response.status === 302 && response.headers.get('location')?.startsWith('/login')) {
      return true;
    }

    return (
      response.status === 200 &&
      response.body.includes('<title>Login</title>') &&
      response.body.includes('name="username"')
    );
  }

  private extractCookieHeader(headers: Headers) {
    const setCookies = headers.getSetCookie();
    if (!setCookies.length) {
      return null;
    }

    return setCookies.map((entry) => entry.split(';', 1)[0]).join('; ');
  }

  private async fetchText(
    controller: ControllerConfig,
    options: ZtncuiRequestOptions & { cookieHeader?: string },
  ): Promise<ZtncuiResponse> {
    const headers = new Headers();
    let body: string | undefined;
    const timeoutMs = options.timeoutMs ?? DEFAULT_ZTNCUI_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    if (options.cookieHeader) {
      headers.set('Cookie', options.cookieHeader);
    }

    if (options.form) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      headers.set('X-Requested-With', 'XMLHttpRequest');
      body = new URLSearchParams(options.form).toString();
    }

    try {
      const response = await fetch(this.buildUrl(controller.baseUrl, options.path), {
        body,
        headers,
        method: options.method,
        redirect: 'manual',
        signal: abortController.signal,
      });

      return {
        body: await response.text(),
        headers: response.headers,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ZtncuiRequestTimeoutError('ztncui 请求超时');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildUrl(baseUrl: string, path: string) {
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async verifyMemberNameApplied(
    controller: ControllerConfig,
    networkId: string,
    memberId: string,
    memberName: string,
  ) {
    for (let attempt = 1; attempt <= MEMBER_NAME_VERIFY_RETRY_COUNT; attempt += 1) {
      try {
        this.clearSession(controller.id);
        const detail = await this.getNetworkDetail(controller, networkId, {
          timeoutMs: MEMBER_NAME_VERIFY_TIMEOUT_MS,
        });
        const member = detail.members.find((item) => item.memberId === memberId);
        if (member?.memberName === memberName) {
          return true;
        }
      } catch {
        // Ignore transient verification failures and retry.
      }

      if (attempt < MEMBER_NAME_VERIFY_RETRY_COUNT) {
        await this.sleep(MEMBER_NAME_VERIFY_INTERVAL_MS);
      }
    }

    return false;
  }

  private async trySetMemberName(
    controller: ControllerConfig,
    networkId: string,
    memberId: string,
    memberName: string,
  ) {
    let lastRequestTimedOut = false;

    for (let attempt = 1; attempt <= MEMBER_NAME_UPDATE_RETRY_COUNT; attempt += 1) {
      try {
        this.clearSession(controller.id);
        await this.request(controller, {
          form: {
            id: memberId,
            name: memberName,
          },
          method: 'POST',
          path: `/controller/network/${networkId}/members`,
          timeoutMs: MEMBER_NAME_UPDATE_TIMEOUT_MS,
        });
        lastRequestTimedOut = false;
      } catch (error) {
        if (!(error instanceof ZtncuiRequestTimeoutError)) {
          throw error;
        }
        lastRequestTimedOut = true;
      }

      const verified = await this.verifyMemberNameApplied(
        controller,
        networkId,
        memberId,
        memberName,
      );
      if (verified) {
        return {
          confirmed: true,
          requestTimedOut: false,
        };
      }

      if (attempt < MEMBER_NAME_UPDATE_RETRY_COUNT) {
        await this.sleep(MEMBER_NAME_VERIFY_INTERVAL_MS);
      }
    }

    return {
      confirmed: false,
      requestTimedOut: lastRequestTimedOut,
    };
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
