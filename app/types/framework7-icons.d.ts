declare module 'framework7-icons/react' {
  import type { ComponentType, SVGProps } from 'react';

  type F7Icon = ComponentType<SVGProps<SVGSVGElement>>;

  export const Timer: F7Icon;
  export const GearAlt: F7Icon;
  export const DocPlaintext: F7Icon;
  export const DocText: F7Icon;
  export const Clock: F7Icon;
  export const StarFill: F7Icon;
  export const Thermometer: F7Icon;
  export const Wind: F7Icon;
  export const DropFill: F7Icon;
  export const Checkmark: F7Icon;
  export const ChevronRight: F7Icon;
  export const CloudUpload: F7Icon;
  export const Cube: F7Icon;
  export const AntFill: F7Icon;

  const icons: Record<string, F7Icon>;
  export default icons;
}
