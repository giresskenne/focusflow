// Pure decision helper for sync direction
function decideSyncAction({ hasLocal, hasCloud, migratedFlag }) {
  // If user already migrated, don't prompt; prefer not to overwrite
  if (migratedFlag) {
    if (!hasLocal && hasCloud) return 'pull';
    return 'noop';
  }
  // First-time sign-in
  if (hasLocal && !hasCloud) return 'prompt-upload';
  if (!hasLocal && hasCloud) return 'pull';
  if (hasLocal && hasCloud) return 'prompt-merge';
  return 'noop';
}

describe('decideSyncAction', () => {
  it('pulls when no local but cloud data exists', () => {
    expect(decideSyncAction({ hasLocal: false, hasCloud: true, migratedFlag: false })).toBe('pull');
  });
  it('prompts upload when only local exists and not migrated', () => {
    expect(decideSyncAction({ hasLocal: true, hasCloud: false, migratedFlag: false })).toBe('prompt-upload');
  });
  it('prompts merge when both exist and not migrated', () => {
    expect(decideSyncAction({ hasLocal: true, hasCloud: true, migratedFlag: false })).toBe('prompt-merge');
  });
  it('noops when migrated and local exists', () => {
    expect(decideSyncAction({ hasLocal: true, hasCloud: true, migratedFlag: true })).toBe('noop');
  });
  it('pulls when migrated and local empty but cloud exists', () => {
    expect(decideSyncAction({ hasLocal: false, hasCloud: true, migratedFlag: true })).toBe('pull');
  });
});
