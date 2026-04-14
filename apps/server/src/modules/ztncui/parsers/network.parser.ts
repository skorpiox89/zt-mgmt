import { load } from 'cheerio';
import { parseMembersTable } from './member.parser';
import {
  ZtncuiIpAssignmentPool,
  ZtncuiNetworkDetail,
  ZtncuiNetworkListItem,
  ZtncuiRoute,
} from '../ztncui.types';

function parseJsonCode<T>(raw: string, fallback: T): T {
  const normalized = raw.trim();
  if (!normalized) {
    return fallback;
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return fallback;
  }
}

function parseBoolean(raw: string) {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null;
}

export function parseNetworkList(html: string): ZtncuiNetworkListItem[] {
  const $ = load(html);
  const items: ZtncuiNetworkListItem[] = [];
  const rows = $('table tr').slice(1).toArray();

  for (const row of rows) {
    const cells = $(row).find('td');
    if (cells.length < 6) {
      continue;
    }

    const networkName = $(cells[1]).find('a').text().trim();
    const networkId = $(cells[2]).text().trim();
    const detailPath = $(cells[3]).find('a').attr('href') ?? null;
    const membersPath = $(cells[5]).find('a').attr('href') ?? null;

    if (!networkId) {
      continue;
    }

    items.push({
      detailPath,
      membersPath,
      networkId,
      networkName,
    });
  }

  return items;
}

export function parseNetworkDetail(html: string): ZtncuiNetworkDetail {
  const $ = load(html);
  const title = $('h2').first();
  const networkName = $('#name').text().trim() || title.find('a').first().text().trim();
  const titleText = title.text().replace(/\s+/g, ' ').trim();
  const idMatch = titleText.match(/\(([a-z0-9]{16})\)/i);
  const networkId = idMatch?.[1] ?? '';

  const membersHeader = $('h3#members').first().text().trim();
  const memberCountMatch = membersHeader.match(/\((\d+)\)/);
  const memberRows = $('h3#members').nextAll('form').first().find('table tr').slice(1).toArray();
  const members = parseMembersTable($, memberRows);

  let routes: ZtncuiRoute[] = [];
  let ipAssignmentPools: ZtncuiIpAssignmentPool[] = [];
  let privateValue: boolean | null = null;

  $('h3#detail')
    .nextAll('div.row')
    .each((_index, row) => {
      const label = $(row).find('.col-sm-2').first().text().replace(':', '').trim();
      const valueNode = $(row).find('.col-sm-10').first();
      const codeText = valueNode.find('code').text().trim();
      const plainText = valueNode.text().trim();

      if (label === 'routes') {
        routes = parseJsonCode(codeText, []);
      }

      if (label === 'ipAssignmentPools') {
        ipAssignmentPools = parseJsonCode(codeText, []);
      }

      if (label === 'private') {
        privateValue = parseBoolean(plainText);
      }
    });

  return {
    ipAssignmentPools,
    memberCount: memberCountMatch ? Number(memberCountMatch[1]) : members.length,
    members,
    networkId,
    networkName,
    private: privateValue,
    routes,
  };
}
