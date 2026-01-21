module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 'expo-router/babel', <--- REMOVED (It is now built into babel-preset-expo)
      
      // Keep this if you are using Reanimated
      'react-native-reanimated/plugin',
    ],
  };
};
