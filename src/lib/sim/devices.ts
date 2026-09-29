/**
 * Simulerade sensorer och skärmar som kopplas till den emulerade RP2040:n.
 *
 * Varje modell beter sig som den riktiga komponenten på signalnivå: DHT11 och
 * DS18B20 svarar med rätt tidsatta pulser, HC-SR04 skickar tillbaka en
 * ekopuls lika lång som ljudets väg, och OLED-skärmen tar emot kommandon och
 * pixeldata över I2C. Därför fungerar elevens vanliga MicroPython-kod – med
 * de inbyggda drivrutinerna dht, onewire, ds18x20 och ssd1306 – utan ändringar.
 */
import { GPIOPinState, I2CMode, type RPI2C, type Simulator } from "rp2040js";

export type SensorValues = {
	/** Ljus som faller på fotoresistorn, 0–100 % */
	light: number;
	/** Fukt i jorden, 0–100 % */
	moisture: number;
	/** Temperatur i °C */
	temperature: number;
	/** Luftfuktighet, 0–100 % */
	humidity: number;
	/** Avstånd till föremålet framför HC-SR04, cm */
	distance: number;
};

export const defaultSensorValues: SensorValues = {
	light: 60,
	moisture: 40,
	temperature: 22,
	humidity: 45,
	distance: 25,
};

export type DeviceSpec =
	| { kind: "ldr"; pin: 26 | 27 | 28 }
	| { kind: "soil"; pin: 26 | 27 | 28 }
	| { kind: "dht11"; pin: number }
	| { kind: "ds18b20"; pin: number }
	| { kind: "hcsr04"; trig: number; echo: number }
	| { kind: "ssd1306"; address: number; sda: number; scl: number };

export type DisplayFrame = {
	/** 128 × 8 sidor à 8 pixlar, precis som skärmens eget minne */
	buffer: Uint8Array;
	on: boolean;
	inverted: boolean;
};

export interface Device {
	/** Anropas när eleven drar i ett reglage */
	update?(values: SensorValues): void;
	dispose(): void;
}

type Context = {
	simulator: Simulator;
	values: () => SensorValues;
	onDisplay: (frame: DisplayFrame) => void;
};

const US = 1000; // nanosekunder per mikrosekund

/** ADC:n är 12-bitars: 0 V → 0, 3,3 V → 4095 */
function voltsToAdc(volts: number) {
	return Math.max(0, Math.min(4095, Math.round((volts / 3.3) * 4095)));
}

/**
 * Spelar upp en följd av nivåer på ett stift, med exakt tid mellan varje steg.
 * Tiden räknas i den simulerade klockan, så pulserna blir lika långa som
 * från en riktig sensor även om webbläsaren kör emulatorn långsammare.
 */
function playWaveform(simulator: Simulator, pin: number, steps: [delayNs: number, high: boolean][]) {
	const gpio = simulator.rp2040.gpio[pin];
	let index = 0;
	const alarm = simulator.clock.createAlarm(() => {
		const [, high] = steps[index];
		gpio.setInputValue(high);
		index++;
		if (index < steps.length) alarm.schedule(steps[index][0]);
	});
	if (steps.length > 0) alarm.schedule(steps[0][0]);
	return () => alarm.cancel();
}

/** Sant när stiftet drivs lågt av Picon själv (open drain / utgång låg) */
function isDrivenLow(state: GPIOPinState) {
	return state === GPIOPinState.Low;
}

// ---------------------------------------------------------------------------
// Analoga sensorer: värdet läggs direkt i ADC-kanalen

function analogDevice(ctx: Context, pin: 26 | 27 | 28, toVolts: (values: SensorValues) => number): Device {
	const channel = pin - 26;
	const adc = ctx.simulator.rp2040.adc;
	const apply = (values: SensorValues) => {
		adc.channelValues[channel] = voltsToAdc(toVolts(values));
	};
	apply(ctx.values());
	return {
		update: apply,
		dispose: () => {
			adc.channelValues[channel] = 0;
		},
	};
}

/**
 * Fotoresistor i spänningsdelare: 3V3 → LDR → ADC → 10 kΩ → GND.
 * Mer ljus ger lägre resistans i LDR:en och därmed högre spänning.
 */
function ldr(ctx: Context, pin: 26 | 27 | 28) {
	return analogDevice(ctx, pin, ({ light }) => {
		// LDR: ca 1 MΩ i mörker, ca 1 kΩ i starkt ljus (logaritmiskt)
		const ldrOhms = 1_000_000 * Math.pow(1000, -light / 100);
		return 3.3 * (10_000 / (10_000 + ldrOhms));
	});
}

/** Kapacitiv jordfuktighetssensor: torr jord ≈ 2,6 V, blöt ≈ 1,2 V */
function soil(ctx: Context, pin: 26 | 27 | 28) {
	return analogDevice(ctx, pin, ({ moisture }) => 2.6 - (moisture / 100) * 1.4);
}

/**
 * RP2040:ns inbyggda temperatursensor sitter på ADC-kanal 4. Den finns på
 * alla kort, så den uppdateras alltid – oavsett vilka komponenter som valts.
 */
export function internalTemperature(simulator: Simulator, values: SensorValues) {
	simulator.rp2040.adc.channelValues[4] = voltsToAdc(0.706 - (values.temperature - 27) * 0.001721);
}

// ---------------------------------------------------------------------------
// HC-SR04: en 10 µs puls på TRIG ger en puls på ECHO lika lång som ljudets
// väg fram och tillbaka (58 µs per centimeter).

function hcsr04(ctx: Context, trig: number, echo: number): Device {
	const { simulator } = ctx;
	simulator.rp2040.gpio[echo].setInputValue(false);
	let risingAt = -1;
	let cancel: (() => void) | undefined;

	const remove = simulator.rp2040.gpio[trig].addListener((state, previous) => {
		const now = simulator.clock.nanos;
		if (state === GPIOPinState.High) {
			risingAt = now;
		} else if (previous === GPIOPinState.High && risingAt >= 0) {
			const width = now - risingAt;
			risingAt = -1;
			if (width < 8 * US) return;

			// Utanför mätområdet (2–400 cm) håller en riktig modul ECHO hög i ca 38 ms
			const cm = ctx.values().distance;
			const echoNs = cm < 2 || cm > 400 ? 38_000 * US : cm * 58.3 * US;
			cancel?.();
			cancel = playWaveform(simulator, echo, [
				[250 * US, true], // modulen skickar först ut åtta ultraljudspulser
				[echoNs, false],
			]);
		}
	});

	return {
		dispose: () => {
			remove();
			cancel?.();
		},
	};
}

// ---------------------------------------------------------------------------
// DHT11: Picon drar datalinjen låg i ~18 ms och släpper den. Sensorn svarar
// med 80 µs låg, 80 µs hög och sedan 40 bitar: 50 µs låg följt av 26 µs hög
// för en nolla eller 70 µs hög för en etta.

function dht11(ctx: Context, pin: number): Device {
	const { simulator } = ctx;
	const gpio = simulator.rp2040.gpio[pin];
	gpio.setInputValue(true); // pull-up på modulen håller linjen hög
	let lowSince = -1;
	let cancel: (() => void) | undefined;

	const remove = gpio.addListener((state) => {
		const now = simulator.clock.nanos;
		if (isDrivenLow(state)) {
			lowSince = now;
			return;
		}
		if (lowSince < 0) return;
		const lowFor = now - lowSince;
		lowSince = -1;
		// Startsignalen är minst 18 ms; kortare pulser ignoreras
		if (lowFor < 1000 * US) return;

		const { humidity, temperature } = ctx.values();
		const rh = Math.round(Math.max(0, Math.min(99, humidity)));
		const t = Math.round(Math.max(0, Math.min(50, temperature)));
		const bytes = [rh, 0, t, 0];
		bytes.push((bytes[0] + bytes[1] + bytes[2] + bytes[3]) & 0xff);

		const steps: [number, boolean][] = [
			[20 * US, false],
			[80 * US, true],
			[80 * US, false],
		];
		for (const byte of bytes) {
			for (let bit = 7; bit >= 0; bit--) {
				const one = (byte >> bit) & 1;
				steps.push([50 * US, true]);
				steps.push([one ? 70 * US : 26 * US, false]);
			}
		}
		steps.push([50 * US, true]);

		cancel?.();
		cancel = playWaveform(simulator, pin, steps);
	});

	return {
		dispose: () => {
			remove();
			cancel?.();
		},
	};
}

// ---------------------------------------------------------------------------
// DS18B20 på 1-Wire-bussen

/** Dallas/Maxim CRC-8, samma som onewire.crc8() i MicroPython */
function crc8(data: number[]) {
	let crc = 0;
	for (let byte of data) {
		for (let i = 0; i < 8; i++) {
			const mix = (crc ^ byte) & 0x01;
			crc >>= 1;
			if (mix) crc ^= 0x8c;
			byte >>= 1;
		}
	}
	return crc;
}

function ds18b20(ctx: Context, pin: number): Device {
	const { simulator } = ctx;
	const gpio = simulator.rp2040.gpio[pin];
	gpio.setInputValue(true); // 4,7 kΩ pull-up håller bussen hög

	const romBody = [0x28, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f];
	const rom = [...romBody, crc8(romBody)];
	const romBits = rom.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >> i) & 1));

	/**
	 * Vad sensorn gör i nästa tidslucka. Vid "read" väntar den på bitar från
	 * Picon; vid "send" lägger den ut egna bitar; "search" är ROM-sökningen där
	 * varje bit skickas, sedan dess invers, och sedan läses Picons val.
	 */
	type Phase =
		| { mode: "idle" }
		| { mode: "read"; bits: number[]; count: number; then: (value: number[]) => void }
		| { mode: "send"; bits: number[] }
		| { mode: "search"; index: number; step: 0 | 1 | 2 };

	let phase: Phase = { mode: "idle" };
	let lowSince = -1;
	let cancelSlot: (() => void) | undefined;
	/** Sant under en lästidslucka – då ska slutet av luckan inte tolkas som en skriven bit */
	let readSlot = false;

	const readBytes = (count: number, then: (bytes: number[]) => void): Phase => ({
		mode: "read",
		bits: [],
		count: count * 8,
		then: (bits) => {
			const bytes: number[] = [];
			for (let i = 0; i < bits.length; i += 8) {
				bytes.push(bits.slice(i, i + 8).reduce((sum, bit, j) => sum | (bit << j), 0));
			}
			then(bytes);
		},
	});

	const scratchpad = () => {
		const raw = Math.round(ctx.values().temperature * 16) & 0xffff;
		const body = [raw & 0xff, raw >> 8, 0x4b, 0x46, 0x7f, 0xff, 0x0c, 0x10];
		return [...body, crc8(body)];
	};

	const functionCommand = (): Phase =>
		readBytes(1, ([command]) => {
			if (command === 0xbe) {
				// Read Scratchpad: 9 byte med temperaturen först
				phase = { mode: "send", bits: scratchpad().flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> i) & 1)) };
			} else {
				// 0x44 Convert T – mätningen är klar direkt i simulatorn
				phase = { mode: "idle" };
			}
		});

	const romCommand = (): Phase =>
		readBytes(1, ([command]) => {
			switch (command) {
				case 0xcc: // Skip ROM
					phase = functionCommand();
					break;
				case 0x55: // Match ROM – läs 8 byte och kolla att det är vi
					phase = readBytes(8, (bytes) => {
						phase = bytes.every((b, i) => b === rom[i]) ? functionCommand() : { mode: "idle" };
					});
					break;
				case 0x33: // Read ROM
					phase = { mode: "send", bits: [...romBits] };
					break;
				case 0xf0: // Search ROM
					phase = { mode: "search", index: 0, step: 0 };
					break;
				default:
					phase = { mode: "idle" };
			}
		});

	/** Lägger ut en nolla genom att hålla bussen låg en stund */
	const sendBit = (bit: number) => {
		if (bit) return;
		gpio.setInputValue(false);
		cancelSlot?.();
		cancelSlot = playWaveform(simulator, pin, [[30 * US, true]]);
	};

	const remove = gpio.addListener((state) => {
		const now = simulator.clock.nanos;

		if (isDrivenLow(state)) {
			lowSince = now;
			// En lästidslucka börjar när Picon drar bussen låg – då ska vi svara direkt
			readSlot = false;
			if (phase.mode === "send") {
				readSlot = true;
				sendBit(phase.bits.shift() ?? 1);
				if (phase.bits.length === 0) phase = { mode: "idle" };
			} else if (phase.mode === "search" && phase.step < 2) {
				readSlot = true;
				const bit = romBits[phase.index];
				sendBit(phase.step === 0 ? bit : bit ^ 1);
				phase.step = phase.step === 0 ? 1 : 2;
			}
			return;
		}

		if (lowSince < 0) return;
		const lowFor = now - lowSince;
		lowSince = -1;
		const wasReadSlot = readSlot;
		readSlot = false;

		// Återställningspuls (minst 480 µs): svara med närvaropuls
		if (lowFor >= 400 * US) {
			cancelSlot?.();
			cancelSlot = playWaveform(simulator, pin, [
				[15 * US, false],
				[120 * US, true],
			]);
			phase = romCommand();
			return;
		}

		if (wasReadSlot) return;

		// Skrivlucka: kort låg = 1, lång låg = 0
		const bit = lowFor < 15 * US ? 1 : 0;
		if (phase.mode === "read") {
			phase.bits.push(bit);
			if (phase.bits.length === phase.count) phase.then(phase.bits);
		} else if (phase.mode === "search" && phase.step === 2) {
			// Picon valde en gren – fortsätt bara om den matchar vår ROM
			if (bit !== romBits[phase.index]) {
				phase = { mode: "idle" };
			} else {
				const index = phase.index + 1;
				phase = index === 64 ? { mode: "idle" } : { mode: "search", index, step: 0 };
			}
		}
	});

	return {
		dispose: () => {
			remove();
			cancelSlot?.();
		},
	};
}

// ---------------------------------------------------------------------------
// SSD1306 OLED-skärm, 128 × 64 pixlar, på I2C

/** Antal argument som följer efter varje kommando */
const SSD1306_ARGS: Record<number, number> = {
	0x20: 1, 0x21: 2, 0x22: 2, 0x81: 1, 0x8d: 1, 0xa8: 1, 0xad: 1,
	0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1,
};

/**
 * Svarar på I2C på stiftnivå. MicroPythons i2c.scan() kan inte göra tomma
 * skrivningar med RP2040:ns I2C-hårdvara, så den "bit-bangar" SDA och SCL för
 * hand i stället. Då måste enheten svara med en ACK-bit precis som en riktig
 * krets: dra SDA låg under den nionde klockpulsen när dess adress passerar.
 */
function i2cPinResponder(simulator: Simulator, sdaPin: number, sclPin: number, address: number) {
	const sda = simulator.rp2040.gpio[sdaPin];
	const scl = simulator.rp2040.gpio[sclPin];
	// Pull-up-motstånden på skärmmodulen håller båda linjerna höga
	sda.setInputValue(true);
	scl.setInputValue(true);

	let sdaDriven = false;
	let sclDriven = false;
	let acking = false;
	let mode: "idle" | "address" | "ack" | "ignore" = "idle";
	let bits = 0;
	let value = 0;

	const removeScl = scl.addListener((state) => {
		const low = isDrivenLow(state);
		if (low === sclDriven) return;
		sclDriven = low;
		if (!low) {
			// Stigande flank: läs av en bit
			if (mode === "address") {
				value = (value << 1) | (sdaDriven || acking ? 0 : 1);
				bits++;
			}
			return;
		}
		// Fallande flank: dags att svara eller släppa
		if (mode === "address" && bits === 8) {
			if (value >> 1 === address) {
				acking = true;
				sda.setInputValue(false);
			}
			mode = "ack";
		} else if (mode === "ack") {
			if (acking) {
				acking = false;
				sda.setInputValue(true);
			}
			mode = "ignore";
		}
	});

	const removeSda = sda.addListener((state) => {
		const low = isDrivenLow(state);
		if (low === sdaDriven) return;
		sdaDriven = low;
		if (sclDriven) return;
		// SDA ändras medan SCL är hög: start- eller stoppvillkor
		if (low) {
			mode = "address";
			bits = 0;
			value = 0;
		} else {
			mode = "idle";
		}
	});

	return () => {
		removeScl();
		removeSda();
	};
}

function ssd1306(ctx: Context, address: number, sdaPin: number, sclPin: number): Device {
	const buffer = new Uint8Array(128 * 8);
	let on = false;
	let inverted = false;
	let column = 0;
	let page = 0;
	let columnRange: [number, number] = [0, 127];
	let pageRange: [number, number] = [0, 7];

	let command: number | null = null;
	let args: number[] = [];

	let selected = false;
	let expectControl = true;
	let isData = false;
	let singleByte = false;
	let dirty = false;

	const runCommand = (cmd: number, params: number[]) => {
		if (cmd === 0xae) on = false;
		else if (cmd === 0xaf) on = true;
		else if (cmd === 0xa6) inverted = false;
		else if (cmd === 0xa7) inverted = true;
		else if (cmd === 0x21) {
			columnRange = [params[0] & 0x7f, params[1] & 0x7f];
			column = columnRange[0];
		} else if (cmd === 0x22) {
			pageRange = [params[0] & 0x07, params[1] & 0x07];
			page = pageRange[0];
		}
		dirty = true;
	};

	const writeCommandByte = (value: number) => {
		if (command === null) {
			const needed = SSD1306_ARGS[value] ?? 0;
			if (needed === 0) runCommand(value, []);
			else {
				command = value;
				args = [];
			}
			return;
		}
		args.push(value);
		if (args.length === (SSD1306_ARGS[command] ?? 0)) {
			runCommand(command, args);
			command = null;
		}
	};

	const writeDataByte = (value: number) => {
		buffer[page * 128 + column] = value;
		column++;
		if (column > columnRange[1]) {
			column = columnRange[0];
			page = page >= pageRange[1] ? pageRange[0] : page + 1;
		}
		dirty = true;
	};

	const attach = (i2c: RPI2C) => {
		i2c.onStart = () => i2c.completeStart();
		i2c.onConnect = (addr, mode) => {
			selected = addr === address && mode === I2CMode.Write;
			expectControl = true;
			i2c.completeConnect(selected);
		};
		i2c.onWriteByte = (value) => {
			if (selected) {
				if (expectControl) {
					// Kontrollbyte: bit 6 = data (1) eller kommando (0), bit 7 = bara en byte följer
					isData = (value & 0x40) !== 0;
					singleByte = (value & 0x80) !== 0;
					expectControl = false;
				} else {
					if (isData) writeDataByte(value);
					else writeCommandByte(value);
					if (singleByte) expectControl = true;
				}
			}
			i2c.completeWrite(selected);
		};
		i2c.onReadByte = () => i2c.completeRead(0xff);
		i2c.onStop = () => {
			selected = false;
			i2c.completeStop();
		};
	};

	const buses = ctx.simulator.rp2040.i2c;
	for (const bus of buses) attach(bus);
	const removePins = i2cPinResponder(ctx.simulator, sdaPin, sclPin, address);

	// Skicka en ny bild till webbsidan högst 30 gånger i sekunden
	const timer = setInterval(() => {
		if (!dirty) return;
		dirty = false;
		ctx.onDisplay({ buffer: buffer.slice(), on, inverted });
	}, 33);

	return {
		dispose: () => {
			clearInterval(timer);
			removePins();
			for (const bus of buses) {
				bus.onStart = () => bus.completeStart();
				bus.onConnect = () => bus.completeConnect(false);
				bus.onWriteByte = () => bus.completeWrite(false);
				bus.onReadByte = () => bus.completeRead(0xff);
				bus.onStop = () => bus.completeStop();
			}
		},
	};
}

export function createDevice(spec: DeviceSpec, ctx: Context): Device {
	switch (spec.kind) {
		case "ldr":
			return ldr(ctx, spec.pin);
		case "soil":
			return soil(ctx, spec.pin);
		case "dht11":
			return dht11(ctx, spec.pin);
		case "ds18b20":
			return ds18b20(ctx, spec.pin);
		case "hcsr04":
			return hcsr04(ctx, spec.trig, spec.echo);
		case "ssd1306":
			return ssd1306(ctx, spec.address, spec.sda, spec.scl);
	}
}
