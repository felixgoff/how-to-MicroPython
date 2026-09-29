// Testar de simulerade sensorerna mot MicroPythons riktiga drivrutiner.
// Kör med: bun run test-devices
import { readFileSync } from "node:fs";
import { ConsoleLogger, LogLevel, Simulator, USBCDC } from "rp2040js";
import {
	createDevice,
	defaultSensorValues,
	internalTemperature,
	type Device,
	type DeviceSpec,
	type DisplayFrame,
	type SensorValues,
} from "../src/lib/sim/devices";
import { RAM_FILESYSTEM, writeFileScript } from "../src/lib/sim/setup";

const bootrom = new Uint32Array(readFileSync("public/sim/bootrom.bin").buffer.slice(0) as ArrayBuffer);
const firmware = new Uint8Array(readFileSync("public/sim/micropython.bin"));
const ssd1306Driver = readFileSync("src/lib/sim/drivers/ssd1306.py", "utf8");

const simulator = new Simulator();
const mcu = simulator.rp2040;
mcu.loadBootrom(bootrom);
mcu.logger = new ConsoleLogger(LogLevel.Error);
mcu.flash.set(firmware, 0);

// Seriell ström med flödeskontroll – samma upplägg som i simulatorns worker
const cdc = new USBCDC(mcu.usbCtrl);
let pending = new Uint8Array(0);
let pendingIndex = 0;
const refill = () => {
	while (pendingIndex < pending.length && !cdc.txFIFO.full) cdc.sendSerialByte(pending[pendingIndex++]);
};
const read = mcu.usbCtrl.onEndpointRead;
mcu.usbCtrl.onEndpointRead = (endpoint, size) => {
	refill();
	read(endpoint, size);
};
const send = (text: string) => {
	const bytes = new TextEncoder().encode(text);
	const rest = pending.slice(pendingIndex);
	pending = new Uint8Array(rest.length + bytes.length);
	pending.set(rest);
	pending.set(bytes, rest.length);
	pendingIndex = 0;
	refill();
};

let output = "";
cdc.onDeviceConnected = () => send("\r\n");
cdc.onSerialData = (data) => {
	output += new TextDecoder().decode(data);
};

const values: SensorValues = { ...defaultSensorValues };
let lastFrame: DisplayFrame | undefined;
const ctx = { simulator, values: () => values, onDisplay: (frame: DisplayFrame) => (lastFrame = frame) };

mcu.core.PC = 0x10000000;
simulator.execute();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Kör kod i raw REPL och returnerar utskriften (eller felet) */
async function run(code: string, timeoutMs = 20_000) {
	output = "";
	send("\r\x03\x03");
	await delay(150);
	send("\x01");
	await delay(150);
	output = "";
	send(`${code}\x04`);
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if ((output.match(/\x04/g) ?? []).length >= 2) break;
		await delay(20);
	}
	send("\x02");
	const [stdout = "", stderr = ""] = output.replace(/^OK/, "").split("\x04");
	return (stdout + stderr).trim();
}

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
	console.log(`${ok ? "OK  " : "FEL "} ${name}: ${detail}`);
	if (!ok) failures++;
}

function attach(spec: DeviceSpec): Device {
	return createDevice(spec, ctx);
}

await delay(4000);

// --- Analoga sensorer -------------------------------------------------------
{
	const device = attach({ kind: "ldr", pin: 26 });
	values.light = 10;
	device.update?.(values);
	const dark = Number(await run("from machine import ADC\nprint(ADC(26).read_u16())"));
	values.light = 90;
	device.update?.(values);
	const bright = Number(await run("from machine import ADC\nprint(ADC(26).read_u16())"));
	check("LDR", bright > dark * 3, `mörkt ${dark}, ljust ${bright}`);
	device.dispose();
}
{
	const device = attach({ kind: "soil", pin: 27 });
	values.moisture = 5;
	device.update?.(values);
	const dry = Number(await run("from machine import ADC\nprint(ADC(27).read_u16())"));
	values.moisture = 95;
	device.update?.(values);
	const wet = Number(await run("from machine import ADC\nprint(ADC(27).read_u16())"));
	check("Jordfukt", dry > wet, `torr ${dry}, blöt ${wet}`);
	device.dispose();
}
{
	values.temperature = 22;
	internalTemperature(simulator, values);
	const t = Number(
		await run("from machine import ADC\nv = ADC(4).read_u16() * 3.3 / 65535\nprint(round(27 - (v - 0.706) / 0.001721, 1))"),
	);
	check("Inbyggd temperatur", Math.abs(t - 22) < 1, `${t} °C`);
}

// --- HC-SR04 ----------------------------------------------------------------
{
	const device = attach({ kind: "hcsr04", trig: 3, echo: 2 });
	const code = `from machine import Pin, time_pulse_us
import time
trig = Pin(3, Pin.OUT)
echo = Pin(2, Pin.IN)
trig.low()
time.sleep_us(2)
trig.high()
time.sleep_us(10)
trig.low()
d = time_pulse_us(echo, 1, 30000)
print(round(d * 0.0343 / 2, 1))`;
	values.distance = 25;
	const near = Number(await run(code));
	values.distance = 150;
	const far = Number(await run(code));
	check("HC-SR04", Math.abs(near - 25) < 1.5 && Math.abs(far - 150) < 3, `25 cm → ${near}, 150 cm → ${far}`);
	device.dispose();
}

// --- DHT11 --------------------------------------------------------------------
{
	const device = attach({ kind: "dht11", pin: 15 });
	values.temperature = 23;
	values.humidity = 61;
	const result = await run(`import dht
from machine import Pin
import time
s = dht.DHT11(Pin(15))
time.sleep(1)
s.measure()
print(s.temperature(), s.humidity())`);
	check("DHT11", result === "23 61", JSON.stringify(result));
	device.dispose();
}

// --- DS18B20 ------------------------------------------------------------------
{
	const device = attach({ kind: "ds18b20", pin: 16 });
	const code = `import onewire, ds18x20
from machine import Pin
import time
ds = ds18x20.DS18X20(onewire.OneWire(Pin(16)))
roms = ds.scan()
ds.convert_temp()
time.sleep_ms(750)
print(len(roms), ds.read_temp(roms[0]))`;
	values.temperature = 21.5;
	const warm = await run(code);
	values.temperature = -5.25;
	const cold = await run(code);
	check("DS18B20", warm === "1 21.5" && cold === "1 -5.25", `${JSON.stringify(warm)} / ${JSON.stringify(cold)}`);
	device.dispose();
}

// --- SSD1306 ------------------------------------------------------------------
{
	const device = attach({ kind: "ssd1306", address: 0x3c, sda: 4, scl: 5 });
	await run(RAM_FILESYSTEM);
	const saved = await run(`${writeFileScript("ssd1306.py", ssd1306Driver)}print('ok')`);
	const result = await run(`from machine import Pin, I2C
from ssd1306 import SSD1306_I2C
i2c = I2C(0, sda=Pin(4), scl=Pin(5), freq=400000)
print(i2c.scan())
oled = SSD1306_I2C(128, 64, i2c)
oled.fill(0)
oled.text("Hej!", 0, 0)
oled.show()`);
	await delay(200);
	const lit = lastFrame ? lastFrame.buffer.reduce((sum, byte) => sum + (byte ? 1 : 0), 0) : 0;
	if (lastFrame) {
		// Rita de översta 8 pixelraderna och 40 kolumnerna som text
		for (let y = 0; y < 8; y++) {
			let row = "";
			for (let x = 0; x < 40; x++) row += (lastFrame.buffer[x] >> y) & 1 ? "#" : ".";
			console.log("   " + row);
		}
	}
	check("SSD1306", saved === "ok" && result === "[60]" && !!lastFrame?.on && lit > 5, `skanning ${result}, tända kolumner ${lit}`);
	device.dispose();
}

// --- Långt program (flödeskontroll) -------------------------------------------
{
	const lines = Array.from({ length: 80 }, (_, i) => `x${i} = ${i}  # rad med lite text för att bli lång`);
	const result = await run(`${lines.join("\n")}\nprint(x79, 'åäö')`);
	check("Långt program + åäö", result === "79 åäö", JSON.stringify(result));
}

simulator.stop();
console.log(failures === 0 ? "\nAlla tester gick igenom." : `\n${failures} test misslyckades.`);
process.exit(failures === 0 ? 0 : 1);
