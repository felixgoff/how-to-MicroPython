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

	#port: SerialPort | undefined;
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

	async connect() {
		if (!navigator.serial) {
			this.error = "Webbläsaren saknar stöd för Web Serial. Använd Chrome eller Edge på dator.";
			return;
		}

		this.error = null;
		this.status = "connecting";
		try {
			const port = await navigator.serial.requestPort({
				filters: [{ usbVendorId: RASPBERRY_PI_VENDOR_ID }],
			});
			await port.open({ baudRate: 115200 });
			this.#port = port;
			this.#writer = port.writable?.getWriter();
			this.#reader = port.readable?.getReader();
			this.status = "connected";
			void this.#readLoop();
		} catch (error) {
			this.status = "disconnected";
			// Användaren stängde webbläsarens dialog – inget fel att visa
			if (error instanceof DOMException && error.name === "NotFoundError") return;
			this.error = error instanceof Error ? error.message : String(error);
		}
	}

	async disconnect() {
		try {
			await this.#reader?.cancel();
			this.#reader?.releaseLock();
			this.#writer?.releaseLock();
			await this.#port?.close();
		} catch {
			// Kortet kan redan vara urdraget
		}
		this.#reader = undefined;
		this.#writer = undefined;
		this.#port = undefined;
		this.status = "disconnected";
	}

	clearOutput() {
		this.output = "";
	}

	/** Ctrl-C – stoppar programmet som körs på kortet */
	async interrupt() {
		await this.#write(`\r${CTRL_C}${CTRL_C}`);
	}

	/** Skickar koden till kortet och kör den direkt (utan att spara) */
	async runCode(code: string) {
		await this.#withRawRepl(async () => {
			await this.#write(code.replace(/\r\n/g, "\n"));
			await this.#write(CTRL_D);
			await this.#waitFor("OK", 5000);
		});
	}

	/**
	 * Sparar koden som main.py på kortet, så att den startar av sig själv när
	 * Picon får ström. Koden skickas som base64 för att åäö ska överleva resan.
	 */
	async saveAsMain(code: string) {
		const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(code.replace(/\r\n/g, "\n"))));
		const script = [
			"import ubinascii",
			`with open('main.py', 'wb') as f:`,
			`    f.write(ubinascii.a2b_base64('${encoded}'))`,
			"print('main.py sparad')",
		].join("\n");

		await this.#withRawRepl(async () => {
			await this.#write(script);
			await this.#write(CTRL_D);
			await this.#waitFor("OK", 5000);
			await this.#waitFor("main.py sparad", 10_000);
		});
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
