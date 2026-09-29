/**
 * Beskrivning av ett kopplingsschema på ett kopplingsdäck. Allt anges i hål:
 * kolumn (0–43) och rad (a–j eller en av strömskenorna).
 *
 * Kopplingsdäcket ligger på bredden med Pico WH i vänstra delen, USB-kontakten
 * åt vänster. Varje kolumn med fem hål (a–e eller f–j) är ihopkopplad under
 * plasten – det är därför en sladd i samma kolumn som ett stift når stiftet.
 */
export type Row = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "top+" | "top-" | "bot+" | "bot-";

export type Hole = { col: number; row: Row };

/** Ett stift på en modul som sitter ovanför kopplingsdäcket */
export type ModulePin = { module: string; pin: string };

export type Endpoint = Hole | ModulePin;

export type WireColor = "red" | "black" | "yellow" | "green" | "blue" | "orange" | "white" | "purple";

export type BoardPart =
	| { id: string; kind: "led"; color: string; anode: Hole; cathode: Hole }
	| { id: string; kind: "resistor"; from: Hole; to: Hole; ohms: string; bands: string[] }
	| { id: string; kind: "buzzer"; plus: Hole; minus: Hole }
	| { id: string; kind: "ldr"; a: Hole; b: Hole }
	| { id: string; kind: "to92"; label: string; legs: [Hole, Hole, Hole]; legNames: [string, string, string] };

export type ModuleKind = "dht11" | "hcsr04" | "oled";

/** En modul (sensorkort, skärm) som kopplas med sladdar från ovansidan */
export type Module = {
	id: string;
	kind: ModuleKind;
	/** Kolumnen som modulens första stift står rakt ovanför */
	col: number;
	pins: string[];
};

export type Wire = { id: string; from: Endpoint; to: Endpoint; color: WireColor };

export type Step = {
	title: string;
	text: string;
	/** Id för delar, moduler och sladdar som dyker upp i det här steget */
	show: string[];
	/** Punkter som pulserar för att dra blicken dit */
	focus?: Endpoint[];
	/** Kolumner på kopplingsdäcket som lyses upp för att visa vad som hänger ihop */
	strips?: Hole[];
	/** En etikett som pekar på en punkt */
	callout?: { at: Endpoint; text: string };
};

export type Diagram = {
	parts: BoardPart[];
	modules: Module[];
	wires: Wire[];
	steps: Step[];
	/** Etiketter för strömskenorna, t.ex. { "top+": "3,3 V" } */
	railLabels?: Partial<Record<Row, string>>;
	/** Beskrivning av hela den färdiga kopplingen, för skärmläsare */
	description: string;
};
