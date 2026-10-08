import Svg, { Path, Circle, Rect } from 'react-native-svg';
export type IconName = 'comment' | 'star' | 'send' | 'reels' | 'bookmark' | 'discover' | 'heart' | 'bag' | 'store' | 'user' | 'search' | 'arrow' | 'back' | 'down' | 'up' | 'close' | 'plus' | 'minus' | 'check' | 'share' | 'play' | 'pause' | 'mute' | 'sound' | 'upload' | 'box' | 'logout';
export function Icon({ name, size = 24, color = '#F4F5F6', filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  const paths: Partial<Record<IconName, string>> = {
    comment: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 1.5-6A8.5 8.5 0 1 1 21 11.5Z', star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z', send: 'm22 2-7 20-4-9-9-4L22 2ZM11 13 22 2',
    reels: 'M4 3h16a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM2 8h20M7 3l4 5m4-5 4 5', bookmark: 'M6 3h12v19l-6-4-6 4V3Z',
    discover: 'M16 8l-2.5 5.5L8 16l2.5-5.5L16 8Z', heart: 'M20.8 4.9a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z',
    bag: 'M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2', store: 'M3 10v11h18V10M2 10l2-7h16l2 7M2 10c1 3 4 3 5 0 1 3 4 3 5 0 1 3 4 3 5 0 1 3 4 3 5 0M9 21v-7h6v7', user: 'M4 21v-2a8 8 0 0 1 16 0v2', search: 'm16 16 5 5', arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'M20 12H4m6-6-6 6 6 6', down: 'm6 9 6 6 6-6', up: 'm6 15 6-6 6 6', close: 'm6 6 12 12M6 18 18 6', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'm5 12 4 4L19 6', share: 'M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8', play: 'm8 4 12 8-12 8V4Z', pause: 'M8 4v16M16 4v16', mute: 'M11 4 6 8H2v8h4l5 4V4Zm5 5 6 6m0-6-6 6', sound: 'M11 4 6 8H2v8h4l5 4V4Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14', upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5', box: 'm3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7.5 4.5l9 5', logout: 'M9 3H3v18h6m6-14 5 5-5 5M9 12h11',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {name === 'reels' && <Path d="m10 12 6 3.5-6 3.5V12Z" fill={filled ? color : 'none'} />}
    {name === 'discover' && <Circle cx={12} cy={12} r={10} />}
    {name === 'user' && <Circle cx={12} cy={7} r={4} />}
    {name === 'search' && <Circle cx={10.5} cy={10.5} r={6.5} />}
    {paths[name] ? <Path d={paths[name]} fill={filled && ['heart', 'play', 'discover', 'bookmark', 'star'].includes(name) ? color : 'none'} /> : <Rect x={4} y={4} width={16} height={16} />}
  </Svg>;
}
