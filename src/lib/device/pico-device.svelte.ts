import { driversFor } from "$lib/sim/drivers/index.js";
import { writeFileScript } from "$lib/sim/setup.js";

/** Raspberry Pi Picons USB-tillverkar-id */
const RASPBERRY_PI_VENDOR_ID = 0x2e8a;

const MAX_OUTPUT = 60_000;

const CTRL_A = "\x01"; // Gå in i raw REPL
const CTRL_B = "\x02"; // Tillbaka till vanlig REPL
const CTRL_C = "\x03"; // Avbryt programmet som körs
const CTRL_D = "\x04"; // Kör koden / mjuk omstart

export type DeviceStatus = "disconnected" | "connecting" | "connected" | "busy";

/**
 * Pratar med en riktig Pico över USB med hjälp av Web Serial.
 *
 * Koden skickas via MicroPythons "raw REPL": Ctrl-A ställer kortet i ett läge
 * där det tar emot ett helt program utan att eka tillbaka varje tecken,
 * Ctrl-D kör det.
 */
export class PicoDevice {
	status = $state<DeviceStatus>("disconnected");
	output = $state("");
	error = $state<string | null>(null);
	/** Vad kortet håller på med just nu, t.ex. "Lägger ssd1306.py på kortet…" */
	activity = $state<string | null>(null);
	/** Användaren stängde enhetslistan utan att välja – oftast för att listan var tom */
	noPortFound = $state(false);
	/** Sant när det senaste försöket visade alla seriella enheter, inte bara Pico-kort */
	triedAllPorts = $state(false);

	#port: SerialPort | undefined;
	/** Drivrutiner som redan lagts på kortet under den här anslutningen */
	#installed = new Set<string>();
	#writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
	#reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	/** Allt som tagits emot sedan senaste väntan, används för att hitta svar */
	#buffer = "";

	static get supported() {
		return typeof navigator !== "undefined" && "serial" in navigator;
	}

	get connected() {
		return this.status === "connected" || this.status === "busy";
	}

	/**
	 * Öppnar webbläsarens lista över seriella enheter. Normalt visas bara
	 * Raspberry Pi-kort (MicroPython på både Pico, Pico W och Pico 2 annonserar
	 * samma tillverkar-id). Med `all` visas alla seriella enheter, vilket visar
	 * om kortet över huvud taget syns för datorn.
	 */
	async connect(options: { all?: boolean } = {}) {
		if (!navigator.serial) {
			this.error = "Webbläsaren saknar stöd för Web Serial. Använd Chrome eller Edge på dator.";
			return;
		}

		this.error = null;
		this.noPortFound = false;
		this.triedAllPorts = options.all ?? false;
		this.status = "connecting";
		try {
			const port = await navigator.serial.requestPort(
				options.all ? {} : { filters: [{ usbVendorId: RASPBERRY_PI_VENDOR_ID }] },
			);
			await port.open({ baudRate: 115200 });
			this.#port = port;
			this.#installed.clear();
			this.#writer = port.writable?.getWriter();
			this.#reader = port.readable?.getReader();
			this.status = "connected";
			void this.#readLoop();
		} catch (error) {
			this.status = "disconnected";
			// Dialogen stängdes utan val – ofta för att den var tom, så vi visar hjälp
			if (error instanceof DOMException && error.name === "NotFoundError") {
				this.noPortFound = true;
				return;
			}
			// Porten finns men går inte att öppna: ett annat program håller den
			if (error instanceof DOMException && error.name === "NetworkError") {
				this.error =
					"Det gick inte att öppna kortet. Ett annat program eller en annan flik använder det redan – stäng det och försök igen.";
				return;
			}
			this.error = error instanceof Error ? error.message : String(error);
		}
	}

	async disconnect() {
		// Ta loss allt först. Att avbryta läsaren väcker läsloopen, som annars
		// skulle anropa disconnect() en gång till och försöka stänga porten två
		// gånger.
		const reader = this.#reader;
		const writer = this.#writer;
		const port = this.#port;
		this.#reader = undefined;
		this.#writer = undefined;
		this.#port = undefined;
		this.status = "disconnected";
		this.activity = null;

		try {
			await reader?.cancel();
			reader?.releaseLock();
			writer?.releaseLock();
			await port?.close();
		} catch {
			// Kortet kan redan vara urdraget
		}
	}

	clearOutput() {
		this.output = "";
	}

	/** Ctrl-C – stoppar programmet som körs på kortet */
	async interrupt() {
		await this.#write(`\r${CTRL_C}${CTRL_C}`);
	}

	/**
	 * Skickar koden till kortet och kör den direkt (utan att spara). Behöver
	 * koden en drivrutin som inte följer med MicroPython läggs den på först.
	 */
	async runCode(code: string) {
		await this.#withRawRepl(async () => {
			await this.#installDrivers(code);
			await this.#write(code.replace(/\r\n/g, "\n"));
			await this.#write(CTRL_D);
			await this.#waitFor("OK", 5000);
		});
	}

	/**
	 * Sparar koden som main.py på kortet, så att den startar av sig själv när
	 * Picon får ström. Drivrutiner som koden behöver sparas också, annars skulle
	 * programmet inte kunna starta utan dator.
	 */
	async saveAsMain(code: string) {
		await this.#withRawRepl(async () => {
			await this.#installDrivers(code);
			this.activity = "Sparar main.py på kortet…";
			await this.#writeFile("main.py", code.replace(/\r\n/g, "\n"));
		});
	}

	/** Lägger de drivrutiner koden behöver på kortet, en gång per anslutning */
	async #installDrivers(code: string) {
		for (const [file, source] of Object.entries(driversFor(code))) {
			if (this.#installed.has(file)) continue;
			this.activity = `Lägger drivrutinen ${file} på kortet…`;
			await this.#writeFile(file, source);
			this.#installed.add(file);
		}
	}

	/**
	 * Skriver en fil på kortet via raw REPL. Innehållet skickas som base64 så
	 * att åäö och specialtecken klarar resan oförändrade.
	 */
	async #writeFile(name: string, content: string) {
		const done = `${name} sparad`;
		await this.#write(`${writeFileScript(name, content)}print('${done}')`);
		await this.#write(CTRL_D);
		await this.#waitFor("OK", 5000);
		await this.#waitFor(done, 20_000);
		// Vänta tills kortet är redo för nästa kodsnutt
		await this.#waitFor(`${CTRL_D}>`, 5000);
	}

	/** Startar om kortet, som när man drar ur och i strömmen */
	async reset() {
		await this.#write(`\r${CTRL_C}${CTRL_C}`);
		await this.#write(`\r${CTRL_D}`);
	}

	async #withRawRepl(action: () => Promise<void>) {
		if (!this.connected) throw new Error("Ingen Pico är ansluten");
		this.status = "busy";
		this.error = null;
		try {
			await this.#write(`\r${CTRL_C}${CTRL_C}`);
			await this.#delay(60);
			this.#buffer = "";
			await this.#write(CTRL_A);
			await this.#waitFor("raw REPL", 3000);
			await action();
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
		} finally {
			// Tillbaka till vanlig REPL så att utskrifter syns i konsolen
			await this.#write(CTRL_B).catch(() => {});
			this.status = this.#port ? "connected" : "disconnected";
			this.activity = null;
		}
	}

	async #write(text: string) {
		if (!this.#writer) throw new Error("Ingen Pico är ansluten");
		await this.#writer.write(new TextEncoder().encode(text));
	}

	async #readLoop() {
		const decoder = new TextDecoder();
		try {
			while (this.#reader) {
				const { value, done } = await this.#reader.read();
				if (done) break;
				if (!value) continue;
				const text = decoder.decode(value, { stream: true });
				this.#buffer += text;
				this.output = (this.output + text).slice(-MAX_OUTPUT);
			}
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
		}
		if (this.status !== "disconnected") await this.disconnect();
	}

	async #waitFor(token: string, timeoutMs: number) {
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			if (this.#buffer.includes(token)) {
				this.#buffer = this.#buffer.slice(this.#buffer.indexOf(token) + token.length);
				return;
			}
			await this.#delay(20);
		}
		throw new Error(`Picon svarade inte som väntat (väntade på "${token}")`);
	}

	#delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
