// Testar Kodlabbets USB-väg (PicoDevice) utan riktigt kort: Web Serial byts mot
// en låtsasport som är kopplad till den emulerade Picon, som pratar samma raw
// REPL som ett riktigt kort. Kollar att drivrutiner läggs på kortet automatiskt.
// Kräver att `bun run dev` körs. Kör med: node scripts/check-device.mjs [url]
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:5173/";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
page.on("pageerror", (error) => console.log("[sidfel]", error.message));
await page.goto(base, { waitUntil: "networkidle" });

const result = await page.evaluate(async () => {
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const until = async (check, ms, what) => {
		const started = Date.now();
		while (!check()) {
			if (Date.now() - started > ms) throw new Error(`Tidsgräns: ${what}`);
			await sleep(50);
		}
	};

	// Den emulerade Picon, med en OLED-skärm inkopplad på GP20/GP21
	const worker = new Worker("/src/lib/sim/simulator.worker.ts", { type: "module" });
	const encoder = new TextEncoder();
	let fromBoard;
	const readable = new ReadableStream({ start: (controller) => (fromBoard = controller) });
	let raw = "";
	worker.onmessage = ({ data }) => {
		if (data.type !== "serial") return;
		raw += data.text;
		fromBoard.enqueue(encoder.encode(data.text));
	};
	const [bootrom, firmware] = await Promise.all(
		["sim/bootrom.bin", "sim/micropython.bin"].map((file) => fetch(`/${file}`).then((r) => r.arrayBuffer())),
	);
	worker.postMessage({ type: "devices", devices: [{ kind: "ssd1306", address: 0x3c, sda: 20, scl: 21 }] });
	worker.postMessage({ type: "start", bootrom, firmware }, [bootrom, firmware]);
	await until(() => raw.includes(">>>"), 60_000, "MicroPython startar");

	// Ett riktigt kort har ett filsystem i flash; emulatorn får ett i RAM
	const { RAM_FILESYSTEM } = await import("/src/lib/sim/setup.ts");
	const send = (text) => worker.postMessage({ type: "serial", text });
	send("\r\x03\x03");
	await sleep(200);
	send("\x01");
	await sleep(200);
	const before = raw.length;
	send(`${RAM_FILESYSTEM}\x04`);
	await until(() => raw.slice(before).includes("\x04>"), 20_000, "filsystem");
	send("\x02");
	await sleep(500);

	// Låtsas-Web Serial som skickar allt till den emulerade Picon
	const port = {
		readable,
		writable: new WritableStream({ write: (chunk) => send(new TextDecoder().decode(chunk)) }),
		open: async () => {},
		close: async () => {},
		getInfo: () => ({}),
	};
	Object.defineProperty(navigator, "serial", {
		configurable: true,
		value: { requestPort: async () => port, getPorts: async () => [port] },
	});

	const { PicoDevice } = await import("/src/lib/device/pico-device.svelte.ts");
	const { display } = await import("/src/lib/data/components/display.ts");
	const device = new PicoDevice();
	await device.connect();

	const count = (text) => raw.split(text).length - 1;
	const report = {};

	// 1. Skärmkoden: drivrutinen ska läggas på kortet först
	await device.runCode(display.code.source);
	await until(() => raw.includes("I2C-enheter:"), 60_000, "skärmkoden kör");
	report.firstRun = {
		error: device.error,
		driverWritten: count("ssd1306.py sparad"),
		scan: raw.match(/I2C-enheter: \[[^\]]*\]/)?.[0],
	};
	await sleep(1500);
	report.firstRun.tracebacks = count("Traceback");

	// 2. En gång till: drivrutinen ska inte skrivas igen
	await device.runCode(display.code.source);
	await sleep(4000);
	report.secondRun = { error: device.error, driverWritten: count("ssd1306.py sparad") };

	// 3. Spara som main.py
	await device.saveAsMain(display.code.source);
	report.save = { error: device.error, mainSaved: count("main.py sparad") };

	// 4. Ligger filerna på kortet, och är main.py oförändrad (med åäö)?
	await device.runCode(
		"import os\nprint('FILER', sorted(os.listdir()))\nprint('LÄNGD', len(open('main.py').read()))",
	);
	await until(() => raw.includes("LÄNGD"), 30_000, "fillistan");
	report.files = raw.match(/FILER \[[^\]]*\]/)?.[0];
	report.mainLength = Number(raw.match(/LÄNGD (\d+)/)?.[1]);
	report.expectedLength = display.code.source.length;
	report.activityAfter = device.activity;

	worker.terminate();
	return report;
});

console.log(JSON.stringify(result, null, 2));
const ok =
	result.firstRun.error === null &&
	result.firstRun.driverWritten === 1 &&
	result.firstRun.scan === "I2C-enheter: ['0x3c']" &&
	result.secondRun.driverWritten === 1 &&
	result.save.mainSaved === 1 &&
	result.files === "FILER ['main.py', 'ssd1306.py']" &&
	result.mainLength === result.expectedLength;
console.log(ok ? "\nOK: drivrutinen läggs på kortet automatiskt, en gång, och main.py sparas oförändrad." : "\nFEL: se ovan.");
await browser.close();
process.exit(ok ? 0 : 1);
