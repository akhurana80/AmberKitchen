module.exports = {
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
};
