import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';

export default function GradientBackground({ children }) {
  return (
    <View style={styles.container}>
      {/* Background image */}
      <ImageBackground
        source={require('../../assets/background-1.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      >
        {/* Purple overlay for color tint */}
        <View style={[StyleSheet.absoluteFillObject, styles.overlay]} />
      </ImageBackground>
      
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    backgroundColor: 'rgba(30, 10, 50, 0.85)', // Darker purple overlay
  },
});