const listeners = {};

const mockSocket = {
  emit: jest.fn(),
  on: jest.fn((event, cb) => { listeners[event] = cb; }),
  disconnect: jest.fn(),
  _trigger: (event, data) => listeners[event]?.(data),
};

module.exports = {
  io: jest.fn(() => mockSocket),
  _mockSocket: mockSocket,
};
