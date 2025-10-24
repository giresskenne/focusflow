import React from 'react';
import { Switch as RNSwitch, Platform } from 'react-native';
import { colors } from '../../theme';

export default function Switch({ value, onValueChange, ...props }) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ 
        false: colors.border,
        true: colors.primary 
      }}
      thumbColor="#fff"
      ios_backgroundColor={colors.border}
      {...props}
    />
  );
}
