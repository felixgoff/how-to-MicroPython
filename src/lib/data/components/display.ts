import { nextToPico } from "$lib/wiring/geometry.js";
import ssd1306Driver from "$lib/sim/drivers/ssd1306.py?raw";
import type { ComponentGuide } from "./types.js";

const power = nextToPico(36); // 3V3(OUT)
const ground = nextToPico(38); // GND
const sda = nextToPico(26); // GP20, I2C0 SDA
const scl = nextToPico(27); // GP21, I2C0 SCL

export const display: ComponentGuide = {
	slug: "display",
	title: "Enkel Display",
	tagline: "Visa text, siffror och grafik på en liten OLED-skärm över I2C-bussen.",
	tags: ["I2C", "Två trådar"],
	facts: [
		{ label: "Skärm", value: "SSD1306 OLED, 128 × 64" },
		{ label: "Stift i exemplet", value: "SDA GP20, SCL GP21" },
		{ label: "I2C-adress", value: "0x3C (ibland 0x3D)" },
		{ label: "Drivrutin", value: "ssd1306.py" },
	],
	needs: [
		{ item: "Raspberry Pi Pico WH", note: "med micro-USB-sladd" },
		{ item: "Kopplingsdäck" },
		{ item: "OLED-skärm 0,96″", note: "SSD1306, I2C, fyra stift" },
		{ item: "6 kopplingssladdar", note: "4 st hona–hane till skärmen" },
	],
	how: [
		"En OLED-skärm består av små lysdioder, en per pixel. Den här har 128 × 64 pixlar, som var och en kan vara tänd eller släckt. Skärmen har ett eget minne med alla pixlar, och SSD1306-kretsen på kortet ritar ut det.",
		"Picon pratar med skärmen över I2C, en buss med två trådar: SDA för data och SCL för klockan. Varje enhet på bussen har en adress – skärmen har oftast 0x3C – så flera sensorer och skärmar kan dela på samma två trådar.",
		"Du ritar i en kopia av bildminnet i Picon med text(), line(), rect() och fill(). Inget syns på skärmen förrän du anropar show(), som skickar hela bilden över I2C på en gång.",
		"Drivrutinen ssd1306.py följer inte med MicroPython. I Thonny installerar du den via Verktyg → Hantera paket: sök på ssd1306 och installera. Simulatorn på den här sidan lägger den på kortet åt dig.",
	],
	diagram: {
		description:
			"Pico WH på ett kopplingsdäck med 3,3 volt på plusskenan och GND på minusskenan. En OLED-skärm sitter ovanför kopplingsdäcket. GND går till minusskenan, VCC till plusskenan, SCL med en gul sladd till GP21, stift 27, och SDA med en blå sladd till GP20, stift 26.",
		railLabels: { "top+": "3,3 V", "top-": "GND" },
		parts: [],
		modules: [{ id: "oled", kind: "oled", col: 25, pins: ["GND", "VCC", "SCL", "SDA"] }],
		wires: [
			{ id: "power", from: power, to: { col: 6, row: "top+" }, color: "red" },
			{ id: "ground", from: ground, to: { col: 4, row: "top-" }, color: "black" },
			{ id: "module-ground", from: { module: "oled", pin: "GND" }, to: { col: 25, row: "top-" }, color: "black" },
			{ id: "module-power", from: { module: "oled", pin: "VCC" }, to: { col: 26, row: "top+" }, color: "red" },
			{ id: "scl", from: { module: "oled", pin: "SCL" }, to: scl, color: "yellow" },
			{ id: "sda", from: { module: "oled", pin: "SDA" }, to: sda, color: "blue" },
		],
		steps: [
			{
				title: "Pico WH på kopplingsdäcket",
				text: "Skärmen kopplas till I2C-buss 0 på GP20 (SDA, stift 26) och GP21 (SCL, stift 27). I2C kan bara användas på vissa stiftpar – se pinouten.",
				show: [],
				strips: [sda, scl],
				focus: [
					{ col: 15, row: "c" },
					{ col: 16, row: "c" },
				],
				callout: { at: { col: 16, row: "c" }, text: "GP20 SDA · GP21 SCL" },
			},
			{
				title: "Ström till skenorna",
				text: "Röd sladd från 3V3(OUT), stift 36, till plusskenan. Svart sladd från GND, stift 38, till minusskenan.",
				show: ["power", "ground"],
				strips: [
					{ col: 0, row: "top+" },
					{ col: 0, row: "top-" },
				],
				callout: { at: power, text: "3V3(OUT) · stift 36" },
			},
			{
				title: "Ta fram skärmen",
				text: "Läs märkningen ovanför stiften. Här är ordningen GND, VCC, SCL, SDA – men på vissa skärmar kommer VCC först. Kopplar du fel kan skärmen gå sönder.",
				show: ["oled"],
				focus: [
					{ module: "oled", pin: "GND" },
					{ module: "oled", pin: "VCC" },
					{ module: "oled", pin: "SCL" },
					{ module: "oled", pin: "SDA" },
				],
			},
			{
				title: "Ström till skärmen",
				text: "GND till minusskenan och VCC till plusskenan. Skärmen klarar både 3,3 V och 5 V, men 3,3 V är säkrast för Picon.",
				show: ["module-ground", "module-power"],
				strips: [
					{ col: 0, row: "top+" },
					{ col: 0, row: "top-" },
				],
			},
			{
				title: "I2C-trådarna",
				text: "SCL (klockan) till GP21 och SDA (data) till GP20. Byter du plats på dem svarar skärmen inte – då är det det första du ska kontrollera.",
				show: ["scl", "sda"],
				strips: [sda, scl],
				callout: { at: sda, text: "SDA → GP20" },
			},
			{
				title: "Klart att testa",
				text: "Kör koden. Skriver i2c.scan() ut 0x3c är kopplingen rätt. Är listan tom – kontrollera SDA och SCL.",
				show: [],
			},
		],
	},
	connections: [
		{ from: "GND", to: "GND (stift 38)" },
		{ from: "VCC", to: "3V3(OUT) (stift 36)" },
		{ from: "SCL", to: "GP21 (stift 27)" },
		{ from: "SDA", to: "GP20 (stift 26)" },
	],
	code: {
		filename: "skarm.py",
		source: `from machine import Pin, I2C
from ssd1306 import SSD1306_I2C
import time

i2c = I2C(0, sda=Pin(20), scl=Pin(21), freq=400000)
print("I2C-enheter:", [hex(adress) for adress in i2c.scan()])  # ska visa 0x3c

oled = SSD1306_I2C(128, 64, i2c)

oled.fill(0)                          # släck alla pixlar
oled.text("Hej fran Picon!", 0, 0)    # typsnittet saknar å, ä och ö
oled.hline(0, 12, 128, 1)             # en linje under rubriken
oled.show()                           # inget syns förrän du anropar show()

sekunder = 0
while True:
    oled.fill_rect(0, 28, 128, 20, 0) # sudda bara det som ändras
    oled.text("Tid: " + str(sekunder) + " s", 0, 32)
    oled.show()
    sekunder += 1
    time.sleep(1)
`,
		notes: [
			{ lines: "2", text: "Drivrutinen ssd1306 måste finnas på Picon. Installera den i Thonny via Verktyg → Hantera paket." },
			{ lines: "5", text: "I2C(0, …) väljer buss 0 på GP20 och GP21. 400 kHz är en snabb men säker hastighet för skärmen." },
			{ lines: "6", text: "scan() listar adresserna till alla enheter som svarar på bussen – ett bra första test." },
			{ lines: "10–13", text: "Rita i minnet med fill(), text() och hline(). Koordinaterna räknas från övre vänstra hörnet: x åt höger, y nedåt." },
			{ lines: "17–19", text: "fill_rect() suddar bara den del av skärmen som ändras, innan den nya texten ritas och skickas med show()." },
		],
	},
	pitfalls: [
		{
			title: "ImportError: no module named 'ssd1306'",
			text: "Drivrutinen är inte installerad. I Thonny: Verktyg → Hantera paket, sök på ssd1306 och installera. Den hamnar då i mappen lib på Picon.",
		},
		{
			title: "i2c.scan() ger en tom lista",
			text: "Skärmen svarar inte. Kontrollera att SDA och SCL inte bytt plats, att de går till GP20 och GP21 som i koden, och att skärmen får ström.",
		},
		{
			title: "OSError: [Errno 5] EIO",
			text: "Adressen stämmer inte. Vissa skärmar använder 0x3D. Titta vad scan() visar och skriv SSD1306_I2C(128, 64, i2c, addr=0x3d).",
		},
		{
			title: "Inget syns på skärmen",
			text: "Glömt show()? Allt ritas först i Picons minne och skickas till skärmen när show() anropas.",
		},
		{
			title: "Å, ä och ö blir konstiga tecken",
			text: "Det inbyggda typsnittet har bara engelska bokstäver. Skriv ”a” och ”o” i stället, eller rita egna tecken med pixel().",
		},
		{
			title: "Halva skärmen är tom",
			text: "Du har troligen en skärm på 128 × 32 pixlar. Skriv SSD1306_I2C(128, 32, i2c).",
		},
	],
	sim: {
		devices: [{ kind: "ssd1306", address: 0x3c, sda: 20, scl: 21 }],
		files: { "ssd1306.py": ssd1306Driver },
		display: true,
	},
};
