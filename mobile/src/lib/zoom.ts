/**
 * Zoom stops for 13's segmented control — only the lenses the phone really has.
 *
 * The camera runs on the phone's *virtual* rear device: several lenses behind
 * one zoom range, with the points where it changes lens reported as
 * `zoomLensSwitchFactors`. A stop is one of those points (or the bottom of the
 * range), so it is always a real optical switch and never a digital crop.
 *
 * The labels are ratios to the wide lens rather than the raw factors, because
 * what "1" means on the raw scale depends on the device: with an ultra-wide the
 * range starts *below* the wide lens, so the wide lens is the first switch
 * point; without one, the range starts on it. Dividing by the wide lens's
 * factor gives 0.5× / 1× / 3× either way — and the telephoto's true factor,
 * whatever this phone's is.
 *
 * A phone with one rear lens, and the front camera, have nothing to switch
 * between: no stops, the control is not drawn, pinch still zooms.
 */

export type ZoomStop = {
  /** What the pill says. */
  label: string;
  /** The device zoom factor to set — `CameraDevice`'s own scale. */
  zoom: number;
};

/** The parts of a `CameraDevice` the stops are derived from. */
export type ZoomDevice = {
  minZoom: number;
  maxZoom: number;
  zoomLensSwitchFactors: number[];
  physicalDevices: { type: string }[];
};

/** "0.5×", "1×", "2.5×" — one decimal, and none when it is whole. */
function label(ratio: number): string {
  const rounded = Math.round(ratio * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}×`;
}

/** The zoom factor at which this device is on its wide (1×) lens. */
export function wideZoom(device: ZoomDevice): number {
  const hasUltraWide = device.physicalDevices.some((lens) => lens.type === 'ultra-wide-angle');
  const firstSwitch = device.zoomLensSwitchFactors[0];
  return hasUltraWide && firstSwitch !== undefined ? firstSwitch : device.minZoom;
}

/**
 * The stops to draw for a device. Empty when there is nothing to switch
 * between.
 */
export function stopsForDevice(device: ZoomDevice): ZoomStop[] {
  const switches = device.zoomLensSwitchFactors.filter(
    (factor) => factor > device.minZoom && factor <= device.maxZoom
  );
  if (switches.length === 0) return [];

  const wide = wideZoom(device);
  return [device.minZoom, ...switches].map((zoom) => ({ zoom, label: label(zoom / wide) }));
}

/** Where a pinch lands: the start factor scaled, kept inside the device's range. */
export function pinchZoom(from: number, scale: number, device: ZoomDevice): number {
  return Math.min(device.maxZoom, Math.max(device.minZoom, from * scale));
}

/** The stop a zoom factor sits on, if it sits on one. */
export function stopAt(stops: ZoomStop[], zoom: number): ZoomStop | undefined {
  return stops.find((stop) => Math.abs(stop.zoom - zoom) < 0.01);
}
