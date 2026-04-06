import React from 'react';

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
  size = 32, 
  className = "", 
  alt,
  style
}) => {
  const src = MASCOT_MAP[name];
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <img 
      src={src} 
      alt={alt || `${name} mascot`}
      className={`object-contain inline-block shrink-0 ${className}`}
      style={{ 
        width: dimension, 
        height: dimension,
        ...style 
      }}
    />
  );
};
