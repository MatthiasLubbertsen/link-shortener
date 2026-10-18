export const quotes = [
  "does what it says on the tin.",
  "a radically simple link shortener.",
  "smaller links for bigger smiles",
  "shortens links. what more could you want?",
  "does one job, and does it well. kinda.",
];

export const getRandomQuote = () => {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
};

export const notFoundMessages = [
  "are you sure you typed that correctly?",
  "this link wandered off. we looked everywhere.",
  "nothing here but us tiny pixels.",
  "this short link got a bit too short.",
  "either it never existed, or it's very good at hiding.",
  "we shortened it so much it disappeared.",
];

export const getRandomNotFoundMessage = () =>
  notFoundMessages[Math.floor(Math.random() * notFoundMessages.length)];
