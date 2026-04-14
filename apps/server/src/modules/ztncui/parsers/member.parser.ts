import type { CheerioAPI } from 'cheerio';
import { ZtncuiMember } from '../ztncui.types';

function parsePeerStatus(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const online = normalized.includes('ONLINE');
  const versionMatch = normalized.match(/\(v([^)]+)\)/i);

  return {
    online,
    peerStatus: normalized,
    version: versionMatch?.[1] ?? null,
  };
}

function parsePeerAddress(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return {
      latency: null,
      physicalAddress: null,
    };
  }

  const addressMatch = normalized.match(/^([^\s/()]+)/);
  const latencyMatch = normalized.match(/\((\d+)\s*ms\)/i);

  return {
    latency: latencyMatch ? Number(latencyMatch[1]) : null,
    physicalAddress: addressMatch?.[1] ?? null,
  };
}

export function parseMembersTable($: CheerioAPI, rows: unknown[]) {
  const members: ZtncuiMember[] = [];

  for (const row of rows) {
    const cells = $(row as never).find('td');
    if (cells.length < 8) {
      continue;
    }

    const memberId = $(cells[2]).find('a').text().trim();
    const memberName =
      $(cells[1]).find('input').attr('value')?.trim() ||
      $(cells[1]).text().trim();
    const authorized = $(cells[3]).find('input').is(':checked');
    const activeBridge = $(cells[4]).find('input').is(':checked');
    const ipAssignments = $(cells[5])
      .text()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const peerStatus = parsePeerStatus($(cells[6]).text());
    const peerAddress = parsePeerAddress($(cells[7]).text());

    members.push({
      activeBridge,
      authorized,
      ipAssignments,
      latency: peerAddress.latency,
      memberId,
      memberName,
      online: peerStatus.online,
      peerStatus: peerStatus.peerStatus,
      physicalAddress: peerAddress.physicalAddress,
      version: peerStatus.version,
    });
  }

  return members;
}
