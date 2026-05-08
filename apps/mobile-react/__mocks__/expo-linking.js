module.exports = {
  openURL: jest.fn(async () => {}),
  createURL: jest.fn((path) => `amberkitchen://${path}`),
};
