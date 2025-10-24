// Centralized premium gating utilities

export const FREE_REMINDER_LIMIT = 5;

// Returns true if user can add another reminder given current count and premium status
export function canAddReminder(isPremium, currentCount) {
  return !!isPremium || (currentCount ?? 0) < FREE_REMINDER_LIMIT;
}
