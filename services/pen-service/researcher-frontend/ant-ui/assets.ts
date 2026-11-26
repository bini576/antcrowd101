import antCrowdMark from './assets/images/antcrowd-mark-official.png';
import antCrowdWordmark from './assets/images/antcrowd-wordmark-official.png';
import heroSecurityTeam from './assets/images/hero-security-team.jpg';
import journeyBuyer from './assets/images/journey-buyer.jpg';
import journeyResearcher from './assets/images/journey-researcher.jpg';

export const brandAssets = {
  antCrowdLogo: antCrowdMark,
  antCrowdMark,
  antCrowdWordmark,
  heroSecurityTeam,
  journeyBuyer,
  journeyResearcher
};

export function resolveBrandAsset(key?: string | null) {
  if (!key) return '';
  if (key in brandAssets) {
    return brandAssets[key as keyof typeof brandAssets];
  }
  return key;
}
