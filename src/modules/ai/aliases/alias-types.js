/** @typedef {{apps?: string[], categories?: string[], domains?: string[]}} TokenBundle */

/** @typedef {{
 *  id: string,
 *  nickname: string,
 *  tokens: TokenBundle,
 *  synonyms?: string[],
 *  createdAt: number,
 *  updatedAt: number,
 *  usageCount: number,
 * }} Alias */

/** @typedef {{ [nickname: string]: Alias }} AliasesMap */

export {};