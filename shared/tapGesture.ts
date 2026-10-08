type Point = { pageX: number; pageY: number };

// Once a finger travels, returning to its starting point must not turn it into a tap.
export class TapGesture {
  private origin: Point | null = null;
  private moved = false;
  begin(point: Point, touches = 1) { this.origin = { pageX: point.pageX, pageY: point.pageY }; this.moved = touches !== 1; }
  move(point: Point, touches = 1) {
    if (this.origin && (touches !== 1 || Math.hypot(point.pageX - this.origin.pageX, point.pageY - this.origin.pageY) > 10)) this.moved = true;
  }
  allows(point?: Point) { if (point) this.move(point); return !this.moved; }
  cancel() { this.moved = true; }
}

type ActivationEvent = { nativeEvent?: ActivationEvent; type?: string; key?: string; detail?: number; pageX?: number; pageY?: number };
export function tapActivation(event?: ActivationEvent) {
  const native = event?.nativeEvent || event;
  // Missing nativeEvent/coordinates is not proof of keyboard input. Native
  // accessibility activation still uses the gesture's cancellation history.
  const keyboard = native?.type?.startsWith('key') === true && (native.key === 'Enter' || native.key === ' ');
  const point = Number.isFinite(native?.pageX) && Number.isFinite(native?.pageY)
    ? { pageX: native!.pageX!, pageY: native!.pageY! } : undefined;
  return { keyboard, point };
}
