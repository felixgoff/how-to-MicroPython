// Enkelt rökprov: öppnar kodlabbet i Edge, kör exempelkoden i simulatorn och
// kontrollerar att MicroPython startar och att LED-stiftet börjar blinka.
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5173/#/kodlabb";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

page.on("console", (message) => {
	if (message.type() === "error" || message.type() === "warning") {
		console.log(`[browser ${message.type()}]`, message.text());
	}
});
page.on("pageerror", (error) => console.log("[page error]", error.message));

await page.goto(url, { waitUntil: "networkidle" });

const simCard = page.locator("[data-slot=card]", { hasText: "Simulator" }).first();
await simCard.getByRole("button", { name: "Kör", exact: true }).click();
await simCard.getByRole("tab", { name: "Konsol" }).click();
const simLog = simCard.getByRole("log");

await simLog.filter({ hasText: ">>>" }).waitFor({ timeout: 90_000 });
console.log("OK: MicroPython startade (prompt hittad)");

// Exempelkoden skriver ut "LED: 1" / "LED: 0" varje halvsekund
await simLog.filter({ hasText: "LED:" }).waitFor({ timeout: 30_000 });
console.log("OK: koden kördes, utskrifter syns");
console.log("--- konsol ---");
console.log((await simLog.innerText()).slice(-300));

// Radmarkeringen ska flytta sig medan programmet kör
const lines = new Set();
for (let i = 0; i < 6; i++) {
	const badge = simCard.locator("[data-slot=badge]", { hasText: /^Rad / });
	if (await badge.count()) lines.add((await badge.first().innerText()).trim());
	await page.waitForTimeout(700);
}
console.log("OK: raden som körs:", [...lines].join(", "));
const marked = await page.locator(".cm-running-line").count();
console.log("Markerad rad i editorn:", marked);

await simCard.getByRole("tab", { name: "Koppling" }).click();
await page.waitForTimeout(1500);

// Läs av om wokwi-LED:en faktiskt lyser
const ledStates = await page.$$eval("wokwi-led", (elements) =>
	elements.map((element) => ({ label: element.getAttribute("label"), value: element.value, brightness: element.brightness })),
);
console.log("LED-element:", JSON.stringify(ledStates));

const badges = await simCard.locator("[data-slot=badge]").allInnerTexts();
console.log("Stiftstatus:", badges.join(" | "));

await page.screenshot({ path: "scripts/kodlabb.png" });
await browser.close();
