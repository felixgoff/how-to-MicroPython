import type { PinSnapshot, WorkerRequest, WorkerResponse } from "./simulator.worker.js";
import { MARKER, TRACKING_PRELUDE, instrumentLines } from "./instrument.js";
import { defaultSensorValues, type DeviceSpec, type DisplayFrame, type SensorValues } from "./devices.js";
import { RAM_FILESYSTEM, writeFileScript } from "./setup.js";

export type { PinSnapshot, DisplayFrame };

/**
 * "setup" när förberedande kod körs (filsystem, drivrutiner, radmarkörer),
 * "ready" när den är klar, och "program" medan elevens kod kör.
 */
type RawPhase = "idle" | "setup" | "ready" | "program";

export type RunOptions = {
	/** Visa vilken rad som körs */
	trackLines?: boolean;
	/** Filer som ska finnas på kortet, t.ex. drivrutiner: { "ssd1306.py": "..." } */
	files?: Record<string, string>;
};

export type SimulatorStatus = "idle" | "loading" | "booting" | "running" | "error";

/** Hur mycket text konsolen sparar innan den börjar kasta bort det äldsta */
const MAX_OUTPUT = 60_000;

/**
 * Kortet hinner köra flera rader mellan två USB-paket, så radmarkörerna kommer
 * ofta i klump. Därför spelas de upp en i taget – annars skulle bara den sista
 * raden i varje klump synas.
 *
 * Takten anpassas efter hur många rader som väntar: ju längre kön är, desto
 * snabbare går det, så att markeringen inte halkar efter. Raderna hinner ändå
 * synas eftersom de ligger kvar och tonar ut efteråt.
 */
const DRAIN_TARGET_MS = 150;
const MIN_STEP_MS = 10;
const MAX_STEP_MS = 30;
/**
 * Skyddsgräns för kod som kör tusentals rader i sekunden. Kön kan som mest
 * motsvara någon tiondels sekund; blir det fler hoppas de äldsta över, för
 * annars skulle markeringen visa gammal historik i stället för nuläget.
 */
const MAX_LINE_QUEUE = 12;

const base = import.meta.env.BASE_URL;

async function fetchBinary(path: string) {
	const response = await fetch(`${base}${path}`);
	if (!response.ok) throw new Error(`Kunde inte hämta ${path} (${response.status})`);
	return response.arrayBuffer();
}

/**
 * Kör en emulerad Raspberry Pi Pico WH med MicroPython i webbläsaren.
 * Själva emuleringen sker i en Web Worker; den här klassen är gränssnittet mot den.
 *
 * Obs: emulatorn har bara RP2040-chippet. WiFi-chippet (CYW43439), och därmed
 * den inbyggda lampan, finns inte – för det behövs ett riktigt kort.
 */
export class PicoSimulator {
	status = $state<SimulatorStatus>("idle");
	output = $state("");
	error = $state<string | null>(null);
	pins = $state<Record<number, PinSnapshot>>({});
	/** Raden i elevens kod som körs just nu, eller null när inget program kör */
	currentLine = $state<number | null>(null);
	/** Senaste bilden från en inkopplad OLED-skärm */
	display = $state.raw<DisplayFrame | null>(null);

	#worker: Worker | undefined;
	#devices: DeviceSpec[] = [];
	#sensors: SensorValues = { ...defaultSensorValues };
	/** Filsystemet och filerna som redan lagts på kortet sedan det startade */
	#filesystemReady = false;
	#writtenFiles = new Map<string, string>();
	/** Text som kan innehålla en halv radmarkör, sparad tills resten kommer */
	#pendingMarker = "";
	/**
	 * Var vi är i raw REPL: "prelude" medan hjälpfunktionen laddas, "program"
	 * medan elevens kod kör. MicroPython skickar två Ctrl-D (\x04) när en
	 * inskickad kodsnutt är färdig.
	 */
	#rawPhase: RawPhase = "idle";
	#endMarkersSeen = 0;
	/** Rader som tagits emot men ännu inte hunnit visas */
	#lineQueue: number[] = [];
	#lineTimer: ReturnType<typeof setTimeout> | undefined;
	/** Sant när programmet är slut men kön ska spelas klart först */
	#endAfterQueue = false;

	get running() {
		return this.status === "booting" || this.status === "running";
	}

	async start() {
		if (this.running || this.status === "loading") return;
		this.status = "loading";
		this.error = null;
		this.output = "";
		this.pins = {};
		this.display = null;
		this.#filesystemReady = false;
		this.#writtenFiles.clear();

		try {
			const [bootrom, firmware] = await Promise.all([
				fetchBinary("sim/bootrom.bin"),
				fetchBinary("sim/micropython.bin"),
			]);

			const worker = new Worker(new URL("./simulator.worker.ts", import.meta.url), { type: "module" });
			worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.#handle(event.data);
			worker.onerror = (event) => {
				this.error = event.message || "Simulatorn kraschade";
				this.status = "error";
			};
			this.#worker = worker;
			// Komponenterna kopplas in innan kortet startar, precis som i verkligheten
			this.#send({ type: "devices", devices: this.#devices });
			this.#send({ type: "sensors", values: this.#sensors });
			this.#send({ type: "start", bootrom, firmware }, [bootrom, firmware]);
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			this.status = "error";
		}
	}

	stop() {
		this.#send({ type: "stop" });
		this.#worker?.terminate();
		this.#worker = undefined;
		this.status = "idle";
		this.pins = {};
		this.#stopLinePlayback();
		this.#endAfterQueue = false;
		this.currentLine = null;
		this.#rawPhase = "idle";
		this.#endMarkersSeen = 0;
		this.#pendingMarker = "";
	}

	/** Skickar tangenttryck till MicroPythons REPL */
	write(text: string) {
		this.#send({ type: "serial", text });
	}

	/** Sätter nivån på ett ingångsstift, t.ex. när en knapp trycks ner */
	setInput(pin: number, high: boolean) {
		this.#send({ type: "input", pin, high });
	}

	/** Vilka sensorer och skärmar som sitter på kortet */
	setDevices(devices: DeviceSpec[]) {
		this.#devices = devices;
		this.#send({ type: "devices", devices });
	}

	/** Värdena sensorerna ska mäta, t.ex. när eleven drar i ett reglage */
	setSensors(values: SensorValues) {
		this.#sensors = values;
		this.#send({ type: "sensors", values });
	}

	clearOutput() {
		this.output = "";
	}

	/**
	 * Kör kod i simulatorn. Koden skickas via MicroPythons "raw REPL" (Ctrl-A),
	 * där kortet tar emot ett helt program utan att eka tillbaka det – så syns
	 * bara programmets egna utskrifter i konsolen.
	 *
	 * Med `trackLines` läggs osynliga radmarkörer in i koden först, så att
	 * editorn kan visa vilken rad som körs. `files` läggs på kortet innan
	 * koden körs, t.ex. drivrutiner som inte ingår i MicroPython.
	 */
	async runCode(code: string, options: RunOptions = {}) {
		const { trackLines = true, files = {} } = options;
		if (!this.running) {
			await this.start();
			await this.#waitForPrompt();
		}

		const program = trackLines ? instrumentLines(code) : code.replace(/\r\n/g, "\n");
		this.#stopLinePlayback();
		this.#endAfterQueue = false;
		this.currentLine = null;
		this.#endMarkersSeen = 0;

		// Avbryt det som eventuellt kör och gå in i raw REPL
		this.write("\r\x03\x03");
		await this.#delay(150);
		this.write("\x01");
		await this.#delay(150);

		if (!this.#filesystemReady) {
			await this.#runSetup(RAM_FILESYSTEM);
			this.#filesystemReady = true;
		}
		for (const [name, content] of Object.entries(files)) {
			if (this.#writtenFiles.get(name) === content) continue;
			await this.#runSetup(writeFileScript(name, content));
			this.#writtenFiles.set(name, content);
		}
		// Hjälpfunktionen skickas som en egen snutt, så att elevens kod får
		// radnummer som börjar på 1
		if (trackLines) await this.#runSetup(TRACKING_PRELUDE);

		this.#rawPhase = "program";
		this.write(`${program}\x04`);
	}

	/** Kör förberedande kod i raw REPL och väntar tills den är klar */
	async #runSetup(snippet: string) {
		this.#rawPhase = "setup";
		this.#endMarkersSeen = 0;
		this.write(`${snippet}\x04`);
		await this.#waitForPhase("ready", 15_000);
	}

	/** Ctrl-C: avbryter programmet men låter simulatorn fortsätta köra */
	interrupt() {
		this.write("\x03");
		this.#stopLinePlayback();
		this.#endAfterQueue = false;
		this.currentLine = null;
	}

	#waitForPhase(phase: RawPhase, timeoutMs = 5000) {
		const startedAt = Date.now();
		return new Promise<void>((resolve) => {
			const check = () => {
				if (this.#rawPhase === phase || Date.now() - startedAt > timeoutMs) return resolve();
				setTimeout(check, 30);
			};
			check();
		});
	}

	#delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	#waitForPrompt(timeoutMs = 30_000) {
		const startedAt = Date.now();
		return new Promise<void>((resolve, reject) => {
			const check = () => {
				if (this.status === "running") return resolve();
				if (this.status === "error") return reject(new Error(this.error ?? "Simulatorn kunde inte starta"));
				if (Date.now() - startedAt > timeoutMs) return reject(new Error("Simulatorn svarar inte"));
				setTimeout(check, 100);
			};
			check();
		});
	}

	#handle(message: WorkerResponse) {
		switch (message.type) {
			case "booting":
				this.status = "booting";
				break;
			case "serial":
				this.#receive(message.text);
				break;
			case "pins":
				this.pins = { ...this.pins, ...message.pins };
				break;
			case "display":
				this.display = message.frame;
				break;
			case "stopped":
				this.status = "idle";
				break;
			case "error":
				this.error = message.message;
				this.status = "error";
				break;
		}
	}

	/**
	 * Plockar ut radmarkörerna ur den seriella strömmen och lägger resten i
	 * konsolen. En markör kan komma i två delar, därför sparas svansen.
	 */
	#receive(chunk: string) {
		const text = this.#pendingMarker + chunk;
		this.#pendingMarker = "";
		let visible = "";
		let index = 0;

		while (index < text.length) {
			const start = text.indexOf(MARKER, index);
			if (start === -1) {
				visible += text.slice(index);
				break;
			}
			visible += text.slice(index, start);
			const end = text.indexOf(MARKER, start + 1);
			if (end === -1) {
				const tail = text.slice(start);
				// Rimlig markör är som mest några tecken; annars är det vanlig text
				if (tail.length <= 8) this.#pendingMarker = tail;
				else visible += tail;
				break;
			}
			const line = Number(text.slice(start + 1, end));
			if (Number.isInteger(line)) this.#queueLine(line);
			index = end + 1;
		}

		// Varje inskickad kodsnutt avslutas med två Ctrl-D (\x04)
		if (this.#rawPhase !== "idle") {
			this.#endMarkersSeen += (visible.match(/\x04/g) ?? []).length;
			if (this.#endMarkersSeen >= 2) {
				this.#endMarkersSeen = 0;
				if (this.#rawPhase === "setup") {
					this.#rawPhase = "ready";
				} else if (this.#rawPhase === "program") {
					// Programmet är klart – tillbaka till den vanliga REPL:en så att
					// konsolen går att skriva i igen
					this.#rawPhase = "idle";
					// Korta program hinner köra klart innan raderna visats – låt
					// kön spelas färdigt innan markeringen släcks
					if (this.#lineTimer) this.#endAfterQueue = true;
					else this.currentLine = null;
					setTimeout(() => this.write("\x02"), 50);
				}
			}
		}
		// Kvitteringar från raw REPL ska inte synas i konsolen
		visible = visible
			.replace(/\x04+>?/g, "")
			.replace(/^OK/, "")
			.replace(/raw REPL; CTRL-B to exit\r?\n?>?/g, "");

		this.output = (this.output + visible).slice(-MAX_OUTPUT);
		// MicroPythons prompt betyder att kortet har startat klart
		if (this.status === "booting" && this.output.includes(">>>")) this.status = "running";
	}

	/** Lägger raden sist i kön, om den inte redan står på tur */
	#queueLine(line: number) {
		const last = this.#lineQueue.at(-1) ?? this.currentLine;
		if (last === line) return;

		this.#lineQueue.push(line);
		// Ligger vi långt efter kastar vi de äldsta raderna hellre än att släpa
		if (this.#lineQueue.length > MAX_LINE_QUEUE) {
			this.#lineQueue.splice(0, this.#lineQueue.length - MAX_LINE_QUEUE);
		}

		this.#playNextLine();
	}

	#playNextLine() {
		if (this.#lineTimer) return;

		const step = () => {
			const next = this.#lineQueue.shift();
			if (next !== undefined) {
				this.currentLine = next;
				this.#lineTimer = setTimeout(step, this.#stepDelay());
				return;
			}
			// Kön är tom: har programmet tagit slut släcks markeringen nu
			this.#lineTimer = undefined;
			if (this.#endAfterQueue) {
				this.#endAfterQueue = false;
				this.currentLine = null;
			}
		};

		this.#lineTimer = setTimeout(step, this.#stepDelay());
	}

	/** Kort väntan när många rader står på kö, längre när det är lugnt */
	#stepDelay() {
		const even = Math.round(DRAIN_TARGET_MS / (this.#lineQueue.length + 1));
		return Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, even));
	}

	#stopLinePlayback() {
		clearTimeout(this.#lineTimer);
		this.#lineTimer = undefined;
		this.#lineQueue = [];
	}

	#send(message: WorkerRequest, transfer: Transferable[] = []) {
		this.#worker?.postMessage(message, transfer);
	}
}
