// Development utility to seed test aliases for AI voice assistant testing
// Usage: Import and call seedDevAliases() in your dev build

import { upsertAlias } from '../modules/ai/aliases/alias-store';

export async function seedDevAliases() {
  try {
    // Social media alias with common bundle IDs
    await upsertAlias(
      'social',
      {
        apps: [
          'com.burbn.instagram',
          'com.atebits.Tweetie2',
          'com.facebook.Facebook',
          'com.zhiliaoapp.musically', // TikTok
          'com.reddit.Reddit',
        ],
        categories: [],
        domains: [],
      },
      ['social media', 'socials']
    );

    // Entertainment alias
    await upsertAlias(
      'entertainment',
      {
        apps: [
          'com.google.ios.youtube',
          'com.netflix.Netflix',
          'com.hulu.plus',
          'tv.twitch',
        ],
        categories: [],
        domains: [],
      },
      ['videos', 'streaming']
    );

    // News alias
    await upsertAlias(
      'news',
      {
        apps: [
          'com.apple.news',
          'com.reddit.Reddit',
          'flipboard.app',
        ],
        categories: [],
        domains: [],
      },
      []
    );

    // Shopping alias
    await upsertAlias(
      'shopping',
      {
        apps: [
          'com.amazon.Amazon',
          'com.ebay.iphone',
          'com.etsy.etsyforios',
        ],
        categories: [],
        domains: [],
      },
      ['shop', 'stores']
    );

    // For quick testing: Safari as a placeholder
    await upsertAlias(
      'safari',
      {
        apps: ['com.apple.mobilesafari'],
        categories: [],
        domains: [],
      },
      ['browser', 'web']
    );

    // Quick 2-minute test alias
    await upsertAlias(
      'test',
      {
        apps: ['com.apple.mobilesafari'],
        categories: [],
        domains: [],
      },
      ['quick test', '2min', 'two minutes']
    );

    console.log('[DevAliasSeeder] Successfully seeded 6 test aliases');
    return true;
  } catch (error) {
    console.error('[DevAliasSeeder] Failed to seed aliases:', error);
    return false;
  }
}

export async function clearDevAliases() {
  const { removeAlias } = await import('../modules/ai/aliases/alias-store');
  try {
    await removeAlias('social');
    await removeAlias('entertainment');
    await removeAlias('news');
    await removeAlias('shopping');
    await removeAlias('safari');
    await removeAlias('test');
    console.log('[DevAliasSeeder] Cleared test aliases');
    return true;
  } catch (error) {
    console.error('[DevAliasSeeder] Failed to clear aliases:', error);
    return false;
  }
}
