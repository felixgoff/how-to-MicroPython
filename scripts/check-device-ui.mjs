// Testar "Kör på en riktig Pico WH" på komponentsidorna genom att klicka på de
// riktiga knapparna. Web Serial byts mot en låtsasport som är kopplad till den
// emulerade Picon (samma raw REPL som ett riktigt kort).
// Kräver att `bun run dev` körs. Kör med: node scripts/check-device-ui.mjs [url]
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:5173/";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
page.on("pageerror", (error) => console.log("[sidfel]", error.message));

await page.addInitScript(() => {
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	window.__serial = { requests: [], closed: 0, opened: 0, devices: [] };

	async function bootBoard() {
		const worker = new Worker("/src/lib/sim/simulator.worker.ts", { type: "module" });
		const encoder = new TextEncoder();
		let toPage;
		const readable = new ReadableStream({ start: (controller) => (toPage = controller) });
		let raw = "";
		worker.onmessage = ({ data }) => {
			if (data.type !== "serial") return;
			raw += data.text;
			toPage.enqueue(encoder.encode(data.text));
		};
		const [bootrom, firmware] = await Promise.all(
			["sim/bootrom.bin", "sim/micropython.bin"].map((file) => fetch(`/${file}`).then((r) => r.arrayBuffer())),
		);
		worker.postMessage({ type: "devices", devices: window.__serial.devices });
		worker.postMessage({ type: "start", bootrom, firmware }, [bootrom, firmware]);
		while (!raw.includes(">>>")) await sleep(50);

		// Ett riktigt kort har filsystem i flash; emulatorn får ett i RAM
		const { RAM_FILESYSTEM } = await import("/src/lib/sim/setup.ts");
		const send = (text) => worker.postMessage({ type: "serial", text });
		send("\r\x03\x03");
		await sleep(200);
		send("\x01");
		await sleep(200);
		const before = raw.length;
		send(`${RAM_FILESYSTEM}\x04`);
		while (!raw.slice(before).includes("\x04>")) await sleep(50);
		send("\x02");
		await sleep(500);
		// Rensa det som skrevs under uppstarten så att bara elevens körningar syns
		toPage.enqueue(encoder.encode("\r\n>>> "));

		return {
			readable,
			writable: new WritableStream({ write: (chunk) => send(new TextDecoder().decode(chunk)) }),
			open: async () => void window.__serial.opened++,
			close: async () => void window.__serial.closed++,
			getInfo: () => ({}),
		};
	}

	Object.defineProperty(navigator, "serial", {
		configurable: true,
		value: {
			requestPort: async (options) => {
				window.__serial.requests.push(options);
				return bootBoard();
			},
			getPorts: async () => [],
		},
	});
});

let failures = 0;
function check(name, ok, detail = "") {
	console.log(`${ok ? "OK " : "FEL"} ${name}${detail ? `: ${detail}` : ""}`);
	if (!ok) failures++;
}

const panelLog = () => page.locator("#riktig-pico").getByRole("log");

// --- 1. Sektionen finns på alla sju sidor, efter simulatorn -------------------
for (const slug of ["led", "buzzer", "ldr", "temperatur", "fukt", "avstand", "display"]) {
	await page.goto(`${base}#/komponent/${slug}`, { waitUntil: "networkidle" });
	const section = page.locator("#riktig-pico");
	const heading = await section.locator("h3").innerText().catch(() => "");
	const connect = await section.getByRole("button", { name: "Anslut Pico WH" }).count();
	const afterTester = await page.evaluate(() => {
		const tester = document.querySelector("#testa [data-slot=card]");
		const panel = document.querySelector("#riktig-pico");
		return !!tester && !!panel && !!(tester.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING);
	});
	check(`${slug}: sektion under editorn`, heading === "Kör på en riktig Pico WH" && connect === 1 && afterTester);
}

// --- 2. LED-sidan: det EDITERADE programmet körs på kortet ---------------------
await page.goto(`${base}#/komponent/led`, { waitUntil: "networkidle" });
const section = page.locator("#riktig-pico");
await section.scrollIntoViewIfNeeded();
await section.getByRole("button", { name: "Anslut Pico WH" }).click();
await section.getByRole("button", { name: "Kör på Picon" }).waitFor({ timeout: 120_000 });
const request = await page.evaluate(() => window.__serial.requests[0]);
check("anslutning frågar bara efter Pico-kort", request?.filters?.[0]?.usbVendorId === 0x2e8a, JSON.stringify(request));

// Byt ut koden i editorn mot något eget
await page.locator("#testa .cm-content").click();
await page.keyboard.press("Control+A");
await page.keyboard.type('print("redigerad kod:", 6 * 7)');
await section.getByRole("button", { name: "Kör på Picon" }).click();
try {
	await panelLog().filter({ hasText: "redigerad kod: 42" }).waitFor({ timeout: 60_000 });
	check("editerad kod körs på kortet", true, "utskrift 'redigerad kod: 42' i kortets konsol");
} catch {
	check("editerad kod körs på kortet", false, JSON.stringify((await panelLog().innerText()).slice(-200)));
}
const simLog = await page.locator("#testa").getByRole("log").first().innerText();
check("simulatorns konsol påverkas inte", !simLog.includes("redigerad kod"));

// Spara som main.py och kontrollera innehållet
await section.getByRole("button", { name: "Spara som main.py" }).click();
await page.waitForTimeout(3000);
await page.locator("#testa .cm-content").click();
await page.keyboard.press("Control+A");
await page.keyboard.type("import os\nprint('FILER', os.listdir(), open('main.py').read().strip())");
await section.getByRole("button", { name: "Kör på Picon" }).click();
await panelLog().filter({ hasText: "FILER" }).waitFor({ timeout: 60_000 });
const files = (await panelLog().innerText()).match(/FILER .*/)?.[0] ?? "";
check("main.py sparades med den editerade koden", files.includes("main.py") && files.includes('print("redigerad kod:", 6 * 7)'), files);

// --- 3. Lämna sidan: USB-porten ska släppas -----------------------------------
const before = await page.evaluate(() => window.__serial.closed);
await page.goto(`${base}#/komponent/buzzer`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__serial.closed);
check("porten släpps när man byter sida", after === before + 1, `stängd ${before} → ${after} gånger`);

// --- 4. Skärmsidan: drivrutinen läggs på kortet automatiskt --------------------
await page.goto(`${base}#/komponent/display`, { waitUntil: "networkidle" });
// Kortet får en OLED-skärm inkopplad på GP20/GP21, som i schemat
await page.evaluate(() => (window.__serial.devices = [{ kind: 'ssd1306', address: 0x3c, sda: 20, scl: 21 }]));
const oled = page.locator('#riktig-pico');
await oled.scrollIntoViewIfNeeded();
await oled.getByRole('button', { name: 'Anslut Pico WH' }).click();
await oled.getByRole('button', { name: 'Kör på Picon' }).waitFor({ timeout: 120_000 });

// Följ statusraden medan koden skickas
const seen = new Set();
const watcher = setInterval(async () => {
	const text = await oled.locator('p[aria-live=polite]').innerText().catch(() => '');
	if (text) seen.add(text);
}, 40);
await oled.getByRole('button', { name: 'Kör på Picon' }).click();
let found = true;
await panelLog().filter({ hasText: /I2C-enheter: \['0x3c'\]/ }).waitFor({ timeout: 90_000 }).catch(() => (found = false));
clearInterval(watcher);
check('skärmsidan: drivrutin installeras och skärmen hittas på 0x3c', found, found ? '' : JSON.stringify((await panelLog().innerText()).slice(-300)));
check('skärmsidan: statusraden visar att drivrutinen läggs på', [...seen].some((text) => text.includes('ssd1306.py')), [...seen].join(' | '));
await oled.getByRole('button', { name: 'Kör på Picon' }).waitFor();
const activityAfter = await oled.locator('p[aria-live=polite]').count();
check('statusraden försvinner när det är klart', activityAfter === 0);

await browser.close();
console.log(failures === 0 ? "\nAlla kontroller gick igenom." : `\n${failures} kontroll(er) misslyckades.`);
process.exit(failures === 0 ? 0 : 1);
