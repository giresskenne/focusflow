// Productivity quotes organized by category for shield display
export const PRODUCTIVITY_QUOTES = {
  focus: [
    'Small steps add up to big wins.',
    'Deep work now, freedom later.',
    'What you focus on grows.',
    'Distraction is the enemy of progress.',
    'The art of being wise is knowing what to overlook.',
    'Focus on being productive instead of busy.',
    'Your attention is your most valuable asset.',
    'Single-tasking is the new superpower.'
  ],
  motivation: [
    'Protect your time. It protects your future.',
    'Momentum beats motivation.',
    'Success is the sum of small efforts repeated.',
    'The way to get started is to quit talking and begin doing.',
    'Don\'t wait for opportunity. Create it.',
    'Excellence is never an accident.',
    'Progress, not perfection.',
    'Every master was once a disaster.'
  ],
  discipline: [
    'Discipline is freedom.',
    'Self-control is strength. Right thought is mastery.',
    'The price of discipline weighs ounces. Regret weighs tons.',
    'Discipline is choosing between what you want now and what you want most.',
    'Champions don\'t become champions in the ring. They become champions in their training.',
    'Small disciplines repeated with consistency lead to great achievements.',
    'The successful warrior is the average person with laser-like focus.',
    'Discipline is the bridge between goals and accomplishment.'
  ],
  time: [
    'Time is what we want most, but what we use worst.',
    'Lost time is never found again.',
    'The key is not to prioritize what\'s on your schedule, but to schedule your priorities.',
    'Time management is life management.',
    'You have been assigned this mountain to show others it can be moved.',
    'Until you value yourself, you won\'t value your time.',
    'Time is the scarcest resource; unless it is managed, nothing else can be managed.',
    'Ordinary people think merely of spending time. Great people think of using it.'
  ],
  success: [
    'Success usually comes to those who are too busy to be looking for it.',
    'The only impossible journey is the one you never begin.',
    'Success is walking from failure to failure with no loss of enthusiasm.',
    'Don\'t be afraid to give up the good to go for the great.',
    'The future depends on what you do today.',
    'Believe you can and you\'re halfway there.',
    'It does not matter how slowly you go as long as you do not stop.',
    'Success is not final, failure is not fatal: it is the courage to continue that counts.'
  ]
};

// Get a random quote from a specific category or all categories
export function getRandomQuote(category = null) {
  if (category && PRODUCTIVITY_QUOTES[category]) {
    const quotes = PRODUCTIVITY_QUOTES[category];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
  
  // Get from all categories
  const allQuotes = Object.values(PRODUCTIVITY_QUOTES).flat();
  return allQuotes[Math.floor(Math.random() * allQuotes.length)];
}

// Get a different quote from the last one used
let lastQuote = null;
export function getRotatedQuote(category = null) {
  let quote;
  let attempts = 0;
  
  do {
    quote = getRandomQuote(category);
    attempts++;
  } while (quote === lastQuote && attempts < 10); // Avoid infinite loop
  
  lastQuote = quote;
  return quote;
}

// Get quote based on session context
export function getContextualQuote(sessionMinutes) {
  if (sessionMinutes <= 5) {
    return getRandomQuote('focus');
  } else if (sessionMinutes <= 15) {
    return getRandomQuote('discipline');
  } else if (sessionMinutes <= 30) {
    return getRandomQuote('time');
  } else {
    return getRandomQuote('success');
  }
}