module.exports = {
  Platform: {
    OS: "ios",
    select: jest.fn((obj) => obj.ios ?? obj.default),
  },
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(async () => {}),
  },
};
