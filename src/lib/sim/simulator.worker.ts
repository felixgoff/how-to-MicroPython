/// <reference lib="webworker" />
// Emuleringen körs i en Web Worker så att webbsidan inte hakar upp sig medan
// RP2040:n körs. Workern skickar tillbaka seriell utdata och stiftens status.
import { ConsoleLogger, GPIOPinState, LogLevel, Simulator, USBCDC } from "rp2040js";
import {
	createDevice,
	defaultSensorValues,
	internalTemperature,
	type Device,
	type DeviceSpec,
	type DisplayFrame,
	type SensorValues,
} from "./devices.js";

export type WorkerRequest =
	| { type: "start"; bootrom: ArrayBuffer; firmware: ArrayBuffer }
	| { type: "serial"; text: string }
	| { type: "input"; pin: number; high: boolean }
	| { type: "devices"; devices: DeviceSpec[] }
	| { type: "sensors"; values: SensorValues }
	| { type: "stop" };

export type PinSnapshot = { value: boolean; duty: number; frequency: number };

export type WorkerResponse =
	| { type: "booting" }
	| { type: "serial"; text: string }
	| { type: "pins"; pins: Record<number, PinSnapshot> }
	| { type: "display"; frame: DisplayFrame }
	| { type: "stopped" }
	| { type: "error"; message: string };

const PIN_COUNT = 30;
const FLUSH_INTERVAL_MS = 100;

type PinTracker = {
	high: boolean;
	/** Simulerad tid (ns) då stiftet senast bytte värde */
	changedAt: number;
	nanosHigh: number;
	nanosLow: number;
	edges: number;
	reported: PinSnapshot;
};

let simulator: Simulator | undefined;
let cdc: USBCDC | undefined;
let flushTimer: ReturnType<typeof setInterval> | undefined;
let trackers: PinTracker[] = [];
let windowStart = 0;

let deviceSpecs: DeviceSpec[] = [];
let devices: Device[] = [];
let sensorValues: SensorValues = { ...defaultSensorValues };

/**
 * USB-bufferten i emulatorn rymmer bara 512 byte och kastar det som inte får
 * plats. Därför köar vi det som ska skickas och fyller på först när kortet
 * läser – annars skulle långa program klippas av.
 */
let serialQueue = new Uint8Array(0);
let serialIndex = 0;

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function post(message: WorkerResponse) {
	self.postMessage(message);
}

function emptyTracker(): PinTracker {
	return {
		high: false,
		changedAt: 0,
		nanosHigh: 0,
		nanosLow: 0,
		edges: 0,
		reported: { value: false, duty: 0, frequency: 0 },
	};
}

function refillSerial() {
	if (!cdc) return;
	while (serialIndex < serialQueue.length && !cdc.txFIFO.full) cdc.sendSerialByte(serialQueue[serialIndex++]);
}

function queueSerial(text: string) {
	const bytes = encoder.encode(text);
	const rest = serialQueue.subarray(serialIndex);
	const next = new Uint8Array(rest.length + bytes.length);
	next.set(rest);
	next.set(bytes, rest.length);
	serialQueue = next;
	serialIndex = 0;
	refillSerial();
}

function attachDevices() {
	for (const device of devices) device.dispose();
	devices = [];
	if (!simulator) return;
	const context = {
		simulator,
		values: () => sensorValues,
		onDisplay: (frame: DisplayFrame) => post({ type: "display", frame }),
	};
	devices = deviceSpecs.map((spec) => createDevice(spec, context));
	internalTemperature(simulator, sensorValues);
}

function start(bootrom: ArrayBuffer, firmware: ArrayBuffer) {
	simulator = new Simulator();
	const mcu = simulator.rp2040;
	mcu.loadBootrom(new Uint32Array(bootrom));
	mcu.logger = new ConsoleLogger(LogLevel.Error);
	mcu.flash.set(new Uint8Array(firmware), 0);

	cdc = new USBCDC(mcu.usbCtrl);
	cdc.onDeviceConnected = () => queueSerial("\r\n"); // så att MicroPython skriver ut sin prompt
	cdc.onSerialData = (buffer) => post({ type: "serial", text: decoder.decode(buffer, { stream: true }) });
	const readEndpoint = mcu.usbCtrl.onEndpointRead;
	mcu.usbCtrl.onEndpointRead = (endpoint, size) => {
		refillSerial();
		readEndpoint?.(endpoint, size);
	};

	trackers = Array.from({ length: PIN_COUNT }, emptyTracker);
	for (let index = 0; index < PIN_COUNT; index++) {
		const tracker = trackers[index];
		mcu.gpio[index].addListener((state) => {
			const high = state === GPIOPinState.High;
			if (high === tracker.high) return;
			const now = simulator!.clock.nanos;
			const elapsed = now - tracker.changedAt;
			if (tracker.high) tracker.nanosHigh += elapsed;
			else tracker.nanosLow += elapsed;
			tracker.changedAt = now;
			tracker.high = high;
			tracker.edges++;
		});
	}

	attachDevices();

	windowStart = 0;
	flushTimer = setInterval(flushPins, FLUSH_INTERVAL_MS);

	mcu.core.PC = 0x10000000;
	post({ type: "booting" });
	simulator.execute();
}

/**
 * Räknar ut om stiften ändrats sedan förra gången. Utöver av/på tar vi fram
 * pulskvot och frekvens, så att PWM syns som ljusstyrka och toner.
 */
function flushPins() {
	if (!simulator) return;
	const now = simulator.clock.nanos;
	const windowNanos = now - windowStart;
	if (windowNanos <= 0) return;

	const changed: Record<number, PinSnapshot> = {};
	for (let index = 0; index < trackers.length; index++) {
		const tracker = trackers[index];
		const elapsed = now - tracker.changedAt;
		const high = tracker.nanosHigh + (tracker.high ? elapsed : 0);
		const low = tracker.nanosLow + (tracker.high ? 0 : elapsed);
		const total = high + low;

		const snapshot: PinSnapshot = {
			value: tracker.high,
			duty: total > 0 ? high / total : 0,
			// Två flanker per period
			frequency: tracker.edges > 1 ? (tracker.edges / 2 / windowNanos) * 1e9 : 0,
		};

		const previous = tracker.reported;
		if (
			snapshot.value !== previous.value ||
			Math.abs(snapshot.duty - previous.duty) > 0.02 ||
			Math.abs(snapshot.frequency - previous.frequency) > 1
		) {
			tracker.reported = snapshot;
			changed[index] = snapshot;
		}

		tracker.nanosHigh = 0;
		tracker.nanosLow = 0;
		tracker.edges = 0;
		tracker.changedAt = now;
	}

	windowStart = now;
	if (Object.keys(changed).length > 0) post({ type: "pins", pins: changed });
}

function stop() {
	for (const device of devices) device.dispose();
	devices = [];
	simulator?.stop();
	simulator = undefined;
	cdc = undefined;
	serialQueue = new Uint8Array(0);
	serialIndex = 0;
	if (flushTimer) clearInterval(flushTimer);
	flushTimer = undefined;
	post({ type: "stopped" });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const message = event.data;
	try {
		switch (message.type) {
			case "start":
				if (simulator) stop();
				start(message.bootrom, message.firmware);
				break;
			case "serial":
				queueSerial(message.text);
				break;
			case "input":
				// Så här "trycks" en knapp: stiftet dras till jord eller släpps upp
				simulator?.rp2040.gpio[message.pin]?.setInputValue(message.high);
				break;
			case "devices":
				deviceSpecs = message.devices;
				attachDevices();
				break;
			case "sensors":
				sensorValues = message.values;
				for (const device of devices) device.update?.(sensorValues);
				if (simulator) internalTemperature(simulator, sensorValues);
				break;
			case "stop":
				stop();
				break;
		}
	} catch (error) {
		post({ type: "error", message: error instanceof Error ? error.message : String(error) });
	}
};
