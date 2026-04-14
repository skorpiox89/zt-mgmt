import { load } from 'cheerio';
import { ZtncuiControllerInfo } from '../ztncui.types';

export function parseControllerHome(html: string): ZtncuiControllerInfo {
  const $ = load(html);
  const bodyText = $('body').text();

  const addressMatch = bodyText.match(/ZeroTier address of\s+([a-z0-9]+)/i);
  const versionMatch = bodyText.match(/ZeroTier version\s+([0-9.]+)/i);

  return {
    controllerAddress: addressMatch?.[1] ?? null,
    version: versionMatch?.[1] ?? null,
  };
}
