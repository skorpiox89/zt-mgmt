import { Injectable } from '@nestjs/common';

export interface AllocatedSubnet {
  networkCIDR: string;
  poolEnd: string;
  poolStart: string;
}

function ipv4ToInt(ip: string) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function intToIpv4(num: number) {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

function parseCidr(cidr: string) {
  const [ip, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  const hostBits = 32 - prefix;
  const mask = prefix === 0 ? 0 : ((0xffffffff << hostBits) >>> 0) >>> 0;
  const start = ipv4ToInt(ip) & mask;
  const size = 2 ** hostBits;
  const end = start + size - 1;

  return {
    end,
    prefix,
    size,
    start,
  };
}

@Injectable()
export class SubnetService {
  allocateNext(poolCidr: string, targetPrefix: number, usedCidrs: string[]): AllocatedSubnet {
    const pool = parseCidr(poolCidr);
    const blockSize = 2 ** (32 - targetPrefix);
    const usedStarts = new Set(
      usedCidrs
        .map((cidr) => {
          try {
            const parsed = parseCidr(cidr);
            return parsed.prefix === targetPrefix ? parsed.start : null;
          } catch {
            return null;
          }
        })
        .filter((value): value is number => value !== null),
    );

    for (let current = pool.start; current <= pool.end; current += blockSize) {
      const blockEnd = current + blockSize - 1;
      if (blockEnd > pool.end) {
        break;
      }

      if (!usedStarts.has(current)) {
        return {
          networkCIDR: `${intToIpv4(current)}/${targetPrefix}`,
          poolEnd: intToIpv4(blockEnd - 1),
          poolStart: intToIpv4(current + 1),
        };
      }
    }

    throw new Error(`No available /${targetPrefix} subnet left in ${poolCidr}`);
  }
}
