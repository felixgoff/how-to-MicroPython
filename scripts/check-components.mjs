// Öppnar varje komponentsida, tar en bild av det färdiga kopplingsschemat och
// kör exempelkoden i simulatorn. Kör med: node scripts/check-components.mjs <url> [komponent]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173/";
const only = process.argv[3];

/** Vad konsolen ska visa när exempelkoden fungerar */
const expected = {
	led: null, // ingen utskrift – vi läser av lysdioden i stället
	buzzer: /Klart!/,
	ldr: /Ljus: \d+ %/,
	temperatur: /Temperatur: 22(\.0)? °C/,
	fukt: /Luftfuktighet: 45 %/,
	avstand: /Avstånd: 2[45](\.\d)? cm/,
	display: /I2C-enheter: \['0x3c'\]/,
};

mkdirSync("scripts/shots", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
let failures = 0;

for (const [slug, pattern] of Object.entries(expected)) {
	if (only && slug !== only) continue;
	const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(`${base}#/komponent/${slug}`, { waitUntil: "networkidle" });

	// Hoppa till sista steget och fotografera kopplingen
	const steps = page.getByRole("group", { name: "Välj steg" }).getByRole("button");
	await steps.last().click();
	await page.waitForTimeout(1600);
	await page.locator("[aria-roledescription=kopplingsschema]").screenshot({ path: `scripts/shots/${slug}-koppling.png` });

	// Kör exempelkoden
	const tester = page.locator("#testa");
	await tester.scrollIntoViewIfNeeded();
	await tester.getByRole("button", { name: "Kör", exact: true }).click();
	// Simulatorns konsol kommer först; "Kör på en riktig Pico" har en egen längre ned
	const log = tester.getByRole("log").first();

	let ok = false;
	let detail = "";
	try {
		if (pattern) {
			await log.filter({ hasText: pattern }).waitFor({ timeout: 90_000 });
			ok = true;
			detail = (await log.innerText()).trim().split("\n").filter(Boolean).slice(-3).join(" | ");
		} else {
			// Lysdioden ska tändas någon gång inom en halv minut
			await page.waitForFunction(() => [...document.querySelectorAll("wokwi-led")].some((led) => led.value), null, { timeout: 90_000 });
			ok = true;
			detail = "lysdioden tändes";
		}
	} catch {
		detail = `inget svar. Konsol: ${JSON.stringify((await log.innerText()).slice(-200))}`;
	}

	if (slug === "display" && ok) {
		await page.waitForTimeout(1500);
		const lit = await page.evaluate(() => {
			const element = document.querySelector("wokwi-ssd1306");
			const data = element?.imageData?.data;
			let count = 0;
			if (data) for (let i = 0; i < data.length; i += 4) if (data[i] > 100) count++;
			return count;
		});
		detail += ` · tända pixlar: ${lit}`;
		ok = lit > 100;
	}

	await tester.screenshot({ path: `scripts/shots/${slug}-test.png` });
	if (errors.length) detail += ` · sidfel: ${errors.join("; ")}`;
	console.log(`${ok && errors.length === 0 ? "OK " : "FEL"} ${slug}: ${detail}`);
	if (!ok || errors.length) failures++;
	await page.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
