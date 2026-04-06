import React from 'react';

// For Chrome Extensions, we often need to ensure paths are resolved correctly 
// although if bundled by Vite/Webpack, relative paths from public work similarly.
// We'll keep it consistent with the webapp but add a fallback or base path if needed.

export type MascotName = 
  | 'logo' 
  | 'sparkle' 
  | 'bot-avatar' 
  | 'thinking' 
  | 'greeting' 
  | 'historian' 
  | 'engineer' 
  | 'champion' 
  | 'success' 
  | 'error' 
  | 'scan_homework' 
  | 'scan_homework2';

interface MascotIconProps {
  name: MascotName;
  size?: number | string;
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
}

const MASCOT_MAP: Record<MascotName, string> = {
  'logo': '/app_icons/logo.png',
  'sparkle': '/app_icons/sparkle.png',
  'bot-avatar': '/app_icons/bot-avatar.png',
  'thinking': '/app_icons/thinking.png',
  'greeting': '/app_icons/greeting.png',
  'historian': '/app_icons/historian.png',
  'engineer': '/app_icons/engineer.png',
  'champion': '/app_icons/champion.png',
  'success': '/app_icons/success.png',
  'error': '/app_icons/error.png',
  'scan_homework': '/app_icons/scan_homework.png',
  'scan_homework2': '/app_icons/scan_homework2.png',
};

export const MascotIcon: React.FC<MascotIconProps> = ({ 
  name, 
  size = 24, 
  className = "", 
  alt,
  style
}) => {
  const src = MASCOT_MAP[name];
  const dimension = typeof size === 'number' ? `${size}px` : size;
  const logoClassName = name === 'logo' ? 'oryx-logo-clean' : '';

  return (
    <img 
      src={src} 
      alt={alt || `${name} mascot`}
      className={`object-contain inline-block shrink-0 ${logoClassName} ${className}`.trim()}
      style={{ 
        width: dimension, 
        height: dimension,
        ...style 
      }}
    />
  );
};
