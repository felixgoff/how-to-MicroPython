import { led } from "./led.js";
import { buzzer } from "./buzzer.js";
import { ldr } from "./ldr.js";
import { temperature } from "./temperature.js";
import { humidity } from "./humidity.js";
import { distance } from "./distance.js";
import { display } from "./display.js";

export type { ComponentGuide, SensorControl } from "./types.js";

/** De sju komponenterna, i samma ordning som i uppgiften */
export const componentGuides = [led, buzzer, ldr, temperature, humidity, distance, display];

export function guideFor(slug: string) {
	return componentGuides.find((guide) => guide.slug === slug);
}
