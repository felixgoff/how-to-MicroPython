/**
 * Komponenterna som är inkopplade i den simulerade kopplingen. Eleven väljer
 * själv vilka som sitter på kortet och på vilka stift.
 *
 * Pico WH:s inbyggda lampa styrs av WiFi-chippet, som inte finns i simulatorn.
 * Därför byggs kopplingen med egna komponenter på vanliga GPIO-stift – precis
 * som på en kopplingsplatta.
 */
export type PartKind = "led" | "buzzer" | "button";

export type Part = {
	id: string;
	kind: PartKind;
	/** GPIO-numret komponenten sitter på */
	pin: number;
	/** Färg för lysdioder */
	color?: string;
};

export type CatalogEntry = {
	kind: PartKind;
	label: string;
	/** Kort beskrivning av hur den kopplas */
	wiring: (pin: number) => string;
	/** Så här skrivs stiftet i MicroPython */
	code: (pin: number) => string;
	/** Utgång (kortet styr) eller ingång (komponenten påverkar kortet) */
	direction: "out" | "in";
	defaultPin: number;
	defaultColor?: string;
};

export const catalog: CatalogEntry[] = [
	{
		kind: "led",
		label: "Lysdiod",
		wiring: (pin) => `GP${pin} → 330 Ω → LED → GND`,
		code: (pin) => `Pin(${pin}, Pin.OUT)`,
		direction: "out",
		defaultPin: 15,
		defaultColor: "red",
	},
	{
		kind: "buzzer",
		label: "Buzzer",
		wiring: (pin) => `GP${pin} → buzzer → GND`,
		code: (pin) => `PWM(Pin(${pin}))`,
		direction: "out",
		defaultPin: 16,
	},
	{
		kind: "button",
		label: "Knapp",
		wiring: (pin) => `GP${pin} → knapp → GND`,
		code: (pin) => `Pin(${pin}, Pin.IN, Pin.PULL_UP)`,
		direction: "in",
		defaultPin: 14,
	},
];

export const ledColors = [
	{ value: "red", label: "Röd" },
	{ value: "green", label: "Grön" },
	{ value: "yellow", label: "Gul" },
	{ value: "blue", label: "Blå" },
	{ value: "white", label: "Vit" },
];

/**
 * Stiften som går ut till kanten på ett Pico WH. GP23–GP25 och GP29 saknas –
 * de används internt av WiFi-chippet.
 */
export const availablePins = [...Array.from({ length: 23 }, (_, i) => i), 26, 27, 28];

export function entryFor(kind: PartKind): CatalogEntry {
	return catalog.find((item) => item.kind === kind) ?? catalog[0];
}

/** Kopplingen som är förvald första gången kodlabbet öppnas */
export const defaultParts: Part[] = [
	{ id: "led-15", kind: "led", pin: 15, color: "red" },
	{ id: "led-14", kind: "led", pin: 14, color: "green" },
	{ id: "buzzer-16", kind: "buzzer", pin: 16 },
	{ id: "button-13", kind: "button", pin: 13 },
];

/** Första lediga stiftet, så att en ny komponent inte krockar med en befintlig */
export function firstFreePin(parts: Part[], preferred: number) {
	const taken = new Set(parts.map((part) => part.pin));
	if (!taken.has(preferred)) return preferred;
	return availablePins.find((pin) => !taken.has(pin)) ?? preferred;
}
