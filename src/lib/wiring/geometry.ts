import { leftPins, rightPins } from "$lib/data/pinout.js";
import type { Endpoint, Hole, Module, ModulePin, Row } from "./types.js";

/** Avstånd mellan två hål (0,1 tum på ett riktigt kopplingsdäck) */
export const PITCH = 18;
export const COLUMNS = 44;
/** Picons stift 1 och 40 står i kolumn 2 */
export const PICO_FIRST_COL = 2;

/**
 * Radernas lodräta läge i hålavstånd. Mittspåret mellan e och f är tre hål
 * brett, så att Picons stiftrader (c och h) hamnar 0,7 tum isär – precis som
 * på det riktiga kortet.
 */
export const ROW_Y: Record<Row, number> = {
	"top+": 0,
	"top-": 1,
	a: 3,
	b: 4,
	c: 5,
	d: 6,
	e: 7,
	f: 10,
	g: 11,
	h: 12,
	i: 13,
	j: 14,
	"bot-": 16,
	"bot+": 17,
};

/** Moduler ritas ovanför kopplingsdäcket; deras stift pekar nedåt mot det här läget */
export const MODULE_PIN_Y = -2.5;

export const MARGIN_X = 1.5;

export function holeX(col: number) {
	return (col + MARGIN_X) * PITCH;
}

export function holeY(row: Row) {
	return ROW_Y[row] * PITCH;
}

export function isModulePin(endpoint: Endpoint): endpoint is ModulePin {
	return "module" in endpoint;
}

export function point(endpoint: Endpoint, modules: Module[]): { x: number; y: number } {
	if (isModulePin(endpoint)) {
		const module = modules.find((item) => item.id === endpoint.module);
		const index = module ? module.pins.indexOf(endpoint.pin) : 0;
		return { x: holeX((module?.col ?? 0) + Math.max(0, index)), y: MODULE_PIN_Y * PITCH };
	}
	return { x: holeX(endpoint.col), y: holeY(endpoint.row) };
}

/** Kolumnen och sidan för ett av Picons fysiska stift (1–40) */
export function picoPinHole(pin: number): { col: number; top: boolean } {
	if (pin <= 20) return { col: PICO_FIRST_COL + (pin - 1), top: false };
	return { col: PICO_FIRST_COL + (40 - pin), top: true };
}

/** Ett ledigt hål i samma kolumn som Pico-stiftet, där en sladd kan sättas i */
export function nextToPico(pin: number, outer = true): Hole {
	const { col, top } = picoPinHole(pin);
	if (top) return { col, row: outer ? "a" : "b" };
	return { col, row: outer ? "j" : "i" };
}

/** Kortnamnet på ett Pico-stift, t.ex. "GP15" eller "GND" */
export function picoPinName(pin: number) {
	return [...leftPins, ...rightPins].find((item) => item.number === pin)?.name ?? `Stift ${pin}`;
}

/** Alla hål som hör ihop med ett visst hål (samma kolumn på samma halva, eller hela skenan) */
export function stripOf(hole: Hole): { col: number; rows: Row[] } | { rail: Row } {
	if (hole.row.startsWith("top") || hole.row.startsWith("bot")) return { rail: hole.row };
	const top: Row[] = ["a", "b", "c", "d", "e"];
	const bottom: Row[] = ["f", "g", "h", "i", "j"];
	return { col: hole.col, rows: top.includes(hole.row) ? top : bottom };
}

/**
 * En mjuk kurva mellan två punkter, som en sladd som ligger över
 * kopplingsdäcket. Sladdar från moduler faller rakt ned, korta sladdar på
 * kopplingsdäcket bågnar lite åt sidan.
 */
export function wirePath(a: { x: number; y: number }, b: { x: number; y: number }, fromModule: boolean) {
	if (fromModule) {
		const drop = (b.y - a.y) * 0.55;
		return `M ${a.x} ${a.y} C ${a.x} ${a.y + drop}, ${b.x} ${b.y - drop}, ${b.x} ${b.y}`;
	}
	const distance = Math.hypot(b.x - a.x, b.y - a.y);
	const lift = Math.min(70, Math.max(14, distance * 0.3));
	// Sladdar på nedre halvan bågnar nedåt, övriga uppåt, så att de inte korsar Picon
	const down = a.y >= ROW_Y.f * PITCH && b.y >= ROW_Y.f * PITCH;
	const direction = down ? 1 : -1;
	return `M ${a.x} ${a.y} C ${a.x} ${a.y + direction * lift}, ${b.x} ${b.y + direction * lift}, ${b.x} ${b.y}`;
}

export const WIRE_COLORS: Record<string, string> = {
	red: "#e5484d",
	black: "#2b2b2e",
	yellow: "#f2c21b",
	green: "#2f9e62",
	blue: "#3b7ddd",
	orange: "#f07a1a",
	white: "#f4f4f5",
	purple: "#8b5cf6",
};

/** Färgkoder för motstånd: siffra → färg */
export const BAND_COLORS: Record<string, string> = {
	black: "#1f1f1f",
	brown: "#7a4a1e",
	red: "#d23b2f",
	orange: "#f07a1a",
	yellow: "#f2c21b",
	green: "#2f9e62",
	blue: "#3b7ddd",
	violet: "#8b5cf6",
	grey: "#8a8a8a",
	white: "#f4f4f5",
	gold: "#c8a032",
};
