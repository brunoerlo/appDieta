// Mock expo-haptics (virtual mock until installed in M3)
jest.mock(
  'expo-haptics',
  () => ({
    impactAsync: jest.fn().mockResolvedValue(undefined),
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    selectionAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  }),
  { virtual: true }
);

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    name: 'IronTrack',
    slug: 'irontrack',
    version: '1.0.0',
  },
}));

// Mock expo-sqlite module for any direct callers
let mockTestDbInstance: any = null;

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => {
    if (!mockTestDbInstance) {
      const { createTestDatabase } = require('./helpers/inMemoryDb');
      mockTestDbInstance = await createTestDatabase();
    }
    return mockTestDbInstance;
  }),
  useSQLiteContext: jest.fn(() => mockTestDbInstance),
}));
