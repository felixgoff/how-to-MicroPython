import type { Diagram } from "$lib/wiring/types.js";
import type { DeviceSpec, SensorValues } from "$lib/sim/devices.js";
import type { Part } from "$lib/sim/parts.js";

export type SensorControl = keyof SensorValues;

/** Allt som behövs för att bygga en komponentsida */
export type ComponentGuide = {
	slug: string;
	/** Namnet i menyn och rubriken */
	title: string;
	/** En mening om vad komponenten gör */
	tagline: string;
	/** Typ och protokoll, visas som etiketter */
	tags: string[];
	facts: { label: string; value: string }[];
	needs: { item: string; note?: string }[];
	/** Hur komponenten fungerar, ett stycke per rad */
	how: string[];
	diagram: Diagram;
	/** Snabböversikt: vilket ben går vart */
	connections: { from: string; to: string }[];
	code: {
		filename: string;
		source: string;
		/** Förklaringar till utvalda rader */
		notes: { lines: string; text: string }[];
	};
	pitfalls: { title: string; text: string }[];
	/** Hur simulatorn längst ned på sidan ska vara kopplad */
	sim: {
		/** Lysdioder, buzzers och knappar */
		parts?: Part[];
		/** Sensorer och skärmar */
		devices?: DeviceSpec[];
		/** Reglage för värdena sensorerna mäter */
		controls?: SensorControl[];
		/** Egna gränser för reglagen, om sensorn mäter ett mindre område */
		ranges?: Partial<Record<SensorControl, [number, number]>>;
		/** Filer som måste finnas på kortet, t.ex. drivrutiner */
		files?: Record<string, string>;
		/** Visa en OLED-skärm */
		display?: boolean;
	};
};
