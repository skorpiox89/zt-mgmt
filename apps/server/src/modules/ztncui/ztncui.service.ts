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
}

interface ZtncuiResponse {
  body: string;
  headers: Headers;
  status: number;
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
      throw new BadGatewayException('Unable to reach ztncui controller home page');
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

  async getNetworkDetail(controller: ControllerConfig, networkId: string) {
    const response = await this.request(controller, {
      method: 'GET',
      path: `/controller/network/${networkId}`,
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
      throw new BadGatewayException('ztncui create network did not return a redirect');
    }

    const match = location.match(/\/controller\/network\/([a-z0-9]{16})/i);
    if (!match) {
      throw new BadGatewayException('Unable to parse created network id from ztncui response');
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
  ) {
    await this.request(controller, {
      form: {
        auth: String(authorized),
        id: memberId,
      },
      method: 'POST',
      path: `/controller/network/${networkId}/members`,
    });
  }

  async setMemberName(
    controller: ControllerConfig,
    networkId: string,
    memberId: string,
    memberName: string,
  ) {
    await this.request(controller, {
      form: {
        id: memberId,
        name: memberName,
      },
      method: 'POST',
      path: `/controller/network/${networkId}/members`,
    });
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
      throw new UnauthorizedException(
        `ztncui login failed for controller ${controller.name}`,
      );
    }

    const cookieHeader = this.extractCookieHeader(response.headers);
    if (!cookieHeader) {
      throw new UnauthorizedException(
        `ztncui login for controller ${controller.name} did not return a session cookie`,
      );
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
      throw new BadGatewayException(`ztncui request failed with status ${response.status}`);
    }

    if (response.status >= 300 && response.status < 400 && !allowAnyRedirect) {
      throw new BadGatewayException('Unexpected ztncui redirect response');
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

    if (options.cookieHeader) {
      headers.set('Cookie', options.cookieHeader);
    }

    if (options.form) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
      body = new URLSearchParams(options.form).toString();
    }

    const response = await fetch(this.buildUrl(controller.baseUrl, options.path), {
      body,
      headers,
      method: options.method,
      redirect: 'manual',
    });

    return {
      body: await response.text(),
      headers: response.headers,
      status: response.status,
    };
  }

  private buildUrl(baseUrl: string, path: string) {
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }
}
