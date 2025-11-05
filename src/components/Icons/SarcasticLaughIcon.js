import * as React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

const SarcasticLaughIcon = ({ size = 64, color = '#FFD700' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    {/* Face circle */}
    <Circle cx="32" cy="32" r="30" fill={color} stroke="#000" strokeWidth="2" />
    
    {/* Left eye (squinting) */}
    <Path
      d="M20 26 L26 26"
      stroke="#000"
      strokeWidth="3"
      strokeLinecap="round"
    />
    
    {/* Right eye (squinting) */}
    <Path
      d="M38 26 L44 26"
      stroke="#000"
      strokeWidth="3"
      strokeLinecap="round"
    />
    
    {/* Sarcastic wide grin */}
    <Path
      d="M16 38 Q32 50 48 38"
      stroke="#000"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    
    {/* Teeth lines for extra sarcasm */}
    <Path d="M22 42 L22 45" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M27 44 L27 47" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M32 45 L32 48" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M37 44 L37 47" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M42 42 L42 45" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

export default SarcasticLaughIcon;
