// Babel config exists exclusively to register the reanimated plugin.
// Expo SDK 54's default config is otherwise sufficient.
//
// IMPORTANT: react-native-reanimated/plugin MUST be the LAST item in
// the plugins array. Reanimated documents this requirement explicitly;
// any plugin appended after it will silently break worklet compilation.
// If new plugins are added in future, they go BEFORE reanimated.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
