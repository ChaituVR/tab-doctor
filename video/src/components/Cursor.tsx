export function Cursor({ x, y, pressed = false }: { x: number; y: number; pressed?: boolean }) {
  return (
    <svg style={{ position: 'absolute', left: x, top: y, zIndex: 20, transform: pressed ? 'scale(.9)' : undefined, transformOrigin: '0 0' }} width="28" height="36" viewBox="0 0 28 36">
      <path d="M2 2 L2 28 L9 21 L14 33 L19 31 L14 19 L24 19 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
