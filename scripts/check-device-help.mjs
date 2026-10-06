// Testar hjälpen när Chrome inte hittar något kort: tom enhetslista, "visa alla
// seriella enheter", upptagen port och länken till guiden. Webbläsarens
// enhetsväljare byts mot en låtsasversion som styrs från testet.
// Fungerar mot både `bun run dev` och ett produktionsbygge (`bun run preview`).
// Kör med: node scripts/check-device-help.mjs [url]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173/";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
page.on("pageerror", (error) => console.log("[sidfel]", error.message));

await page.addInitScript(() => {
	window.__mode = "empty";
	window.__calls = [];
	Object.defineProperty(navigator, "serial", {
		configurable: true,
		value: {
			getPorts: async () => [],
			requestPort: async (options) => {
				window.__calls.push(options ?? null);
				// Chrome kastar NotFoundError när listan är tom och användaren stänger den
				if (window.__mode === "empty") throw new DOMException("No port selected by the user.", "NotFoundError");
				// Kortet finns men något annat program har redan öppnat det
				return {
					readable: null,
					writable: null,
					open: async () => {
						throw new DOMException("Failed to open serial port.", "NetworkError");
					},
					close: async () => {},
					getInfo: () => ({}),
				};
			},
		},
	});
});

let failures = 0;
function check(name, ok, detail = "") {
	console.log(`${ok ? "OK " : "FEL"} ${name}${detail ? `: ${detail}` : ""}`);
	if (!ok) failures++;
}

await page.goto(`${base}#/komponent/led`, { waitUntil: "networkidle" });
const panel = page.locator("#riktig-pico");
await panel.scrollIntoViewIfNeeded();
const alertTitle = () => panel.locator("[data-slot=alert-title]").first().innerText().catch(() => "");
const showAll = panel.getByRole("button", { name: "Visa alla seriella enheter" });

// --- 1. Tom lista: hjälpen visas ---------------------------------------------
await panel.getByRole("button", { name: "Anslut Pico WH" }).click();
await panel.getByText("Hittade inget kort i listan").waitFor({ timeout: 10_000 });
const text = await panel.innerText();
mkdirSync("scripts/shots", { recursive: true });
await panel.screenshot({ path: "scripts/shots/hjalp-tom-lista.png" });
check("tom lista: hjälpen visas", true);
check("hjälpen nämner Pico 2-filen", text.includes("RPI_PICO2") && text.includes("RPI_PICO2_W"));
check("hjälpen nämner startläge (RP2350 / RPI-RP2)", text.includes("RP2350") && text.includes("RPI-RP2"));
check("knappen 'Visa alla seriella enheter' finns", (await showAll.count()) === 1);
const first = await page.evaluate(() => window.__calls[0]);
check("första försöket filtrerar på Raspberry Pi (0x2E8A)", first?.filters?.[0]?.usbVendorId === 0x2e8a, JSON.stringify(first));

// --- 2. Visa alla: anropet saknar filter, hjälpen ändras ----------------------
await showAll.click();
await panel.getByText("Datorn ser ingen seriell enhet från kortet").waitFor({ timeout: 10_000 });
const second = await page.evaluate(() => window.__calls[1]);
check("'visa alla' frågar utan filter", second && Object.keys(second).length === 0, JSON.stringify(second));
check("rubriken byter till 'ser ingen seriell enhet'", (await alertTitle()) === "Datorn ser ingen seriell enhet från kortet");
check("knappen försvinner när alla redan visats", (await showAll.count()) === 0);

// --- 3. Anslut igen med filter: hjälpen återställs ----------------------------
await panel.getByRole("button", { name: "Anslut Pico WH" }).click();
await panel.getByText("Hittade inget kort i listan").waitFor({ timeout: 10_000 });
check("nytt försök återställer hjälpen till steg ett", (await showAll.count()) === 1);

// --- 4. Upptagen port: egen, tydlig feltext ------------------------------------
await page.evaluate(() => (window.__mode = "busy"));
await panel.getByRole("button", { name: "Anslut Pico WH" }).click();
await panel.getByText("Något gick fel med anslutningen").waitFor({ timeout: 10_000 });
const errorText = await panel.locator("[data-slot=alert-description]").last().innerText();
check("upptagen port: förklarar vad som är fel", /använder det redan/.test(errorText), errorText);
check("upptagen port: hjälpen för tom lista visas inte", (await panel.getByText("Hittade inget kort i listan").count()) === 0);

// --- 5. Länken 'Kom igång' tar en till snabbguiden ------------------------------
await page.evaluate(() => (window.__mode = "empty"));
await panel.getByRole("button", { name: "Anslut Pico WH" }).click();
await panel.getByText("Hittade inget kort i listan").waitFor({ timeout: 10_000 });
await panel.getByRole("link", { name: "Kom igång" }).click();
await page.waitForTimeout(1200);
const guide = await page.evaluate(() => {
	const section = document.getElementById("kom-igang");
	return { hash: location.hash, top: section ? Math.round(section.getBoundingClientRect().top) : null };
});
check("länken går till introduktionen", guide.hash === "#/", guide.hash);
check("snabbguiden scrollas fram", guide.top !== null && guide.top > -200 && guide.top < 400, `överkant ${guide.top} px`);

// --- 6. Steg 2 har en rad per kortmodell, med rätt länk och enhetsnamn -----------
const rows = await page.locator("#kom-igang table tbody tr").evaluateAll((trs) =>
	trs.map((tr) => ({
		board: tr.querySelector("th")?.textContent?.trim(),
		link: tr.querySelector("a")?.getAttribute("href"),
		drive: tr.querySelectorAll("td")[1]?.textContent?.trim(),
	})),
);
check("steg 2: tre kortmodeller", rows.length === 3, JSON.stringify(rows.map((r) => r.board)));
const byBoard = Object.fromEntries(rows.map((r) => [r.board, r]));
check(
	"steg 2: Pico 2 → RPI_PICO2 och enheten RP2350",
	byBoard["Pico 2"]?.link === "https://micropython.org/download/RPI_PICO2/" && byBoard["Pico 2"]?.drive === "RP2350",
);
check(
	"steg 2: Pico 2 W → RPI_PICO2_W och enheten RP2350",
	byBoard["Pico 2 W"]?.link === "https://micropython.org/download/RPI_PICO2_W/" && byBoard["Pico 2 W"]?.drive === "RP2350",
);
check(
	"steg 2: Pico W/WH → RPI_PICO_W och enheten RPI-RP2",
	byBoard["Pico W / Pico WH"]?.link === "https://micropython.org/download/RPI_PICO_W/" &&
		byBoard["Pico W / Pico WH"]?.drive === "RPI-RP2",
);

await browser.close();
console.log(failures === 0 ? "\nAlla kontroller gick igenom." : `\n${failures} kontroll(er) misslyckades.`);
process.exit(failures === 0 ? 0 : 1);
