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

const mockFileSystem = {
  documentDirectory: 'file:///data/user/0/host.exp.exponent/files/',
  cacheDirectory: 'file:///data/user/0/host.exp.exponent/cache/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: true }),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
};

// Mock expo-file-system
jest.mock('expo-file-system', () => mockFileSystem);
jest.mock('expo-file-system/legacy', () => mockFileSystem);


// Mock expo-camera
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: jest.fn().mockResolvedValue({
          uri: 'file:///data/photos/test_captured.jpg',
          width: 1080,
          height: 1920,
        }),
      }));
      return React.createElement(View, { testID: 'mock-camera-view', ...props });
    }),
    useCameraPermissions: jest.fn(() => [
      { granted: true, canAskAgain: true, status: 'granted' },
      jest.fn().mockResolvedValue({ granted: true }),
    ]),
  };
});

