module.exports = {
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///mock/image.jpg" }],
  })),
  MediaTypeOptions: { Images: "Images" },
};
