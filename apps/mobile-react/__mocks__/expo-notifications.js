module.exports = {
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test-token]" })),
  setNotificationHandler: jest.fn(),
};
