import { nextToPico } from "$lib/wiring/geometry.js";
import type { ComponentGuide } from "./types.js";

const power = nextToPico(36); // 3V3(OUT)
const ground = nextToPico(38); // GND
const data = nextToPico(29); // GP22

export const humidity: ComponentGuide = {
	slug: "fukt",
	title: "Fuktsensor",
	tagline: "Mät luftfuktighet och temperatur med en DHT11 – en av de vanligaste sensorerna i startkit.",
	tags: ["Digital", "Eget protokoll"],
	facts: [
		{ label: "Sensor", value: "DHT11 (modul med 3 stift)" },
		{ label: "Stift i exemplet", value: "GP22 (stift 29)" },
		{ label: "Mätområde", value: "20–90 % RF, 0–50 °C" },
		{ label: "Mäter högst", value: "en gång per sekund" },
	],
	needs: [
		{ item: "Raspberry Pi Pico WH", note: "med micro-USB-sladd" },
		{ item: "Kopplingsdäck" },
		{ item: "DHT11-modul", note: "blå, med tre stift" },
		{ item: "5 kopplingssladdar", note: "3 st hona–hane till modulen" },
	],
	how: [
		"DHT11 mäter luftfuktighet med en liten kondensator som ändrar sig när den tar upp fukt, och temperatur med en termistor. En inbyggd mikrokontroller gör om mätningarna till tal.",
		"Resultatet skickas på en enda datatråd med ett eget protokoll: Picon drar tråden låg i 18 millisekunder för att väcka sensorn. Sensorn svarar med 40 bitar, där varje bit är en puls – en kort puls (26 µs) är en nolla och en lång (70 µs) är en etta. De 40 bitarna innehåller fukt, temperatur och en kontrollsumma.",
		"MicroPython har modulen dht inbyggd, som sköter all tidtagning. Du anropar measure() och läser sedan humidity() och temperature().",
		"Den blå modulen har redan ett pull-up-motstånd på kortet. Köper du en lös DHT11 med fyra ben behöver du själv sätta ett 10 kΩ-motstånd mellan data och 3,3 V.",
	],
	diagram: {
		description:
			"Pico WH på ett kopplingsdäck med 3,3 volt på plusskenan och GND på minusskenan. En DHT11-modul sitter ovanför kopplingsdäcket. Dess VCC-stift går till plusskenan, GND till minusskenan och DATA med en gul sladd till GP22, stift 29.",
		railLabels: { "top+": "3,3 V", "top-": "GND" },
		parts: [],
		modules: [{ id: "dht", kind: "dht11", col: 26, pins: ["VCC", "DATA", "GND"] }],
		wires: [
			{ id: "power", from: power, to: { col: 6, row: "top+" }, color: "red" },
			{ id: "ground", from: ground, to: { col: 4, row: "top-" }, color: "black" },
			{ id: "module-power", from: { module: "dht", pin: "VCC" }, to: { col: 26, row: "top+" }, color: "red" },
			{ id: "module-ground", from: { module: "dht", pin: "GND" }, to: { col: 28, row: "top-" }, color: "black" },
			{ id: "signal", from: { module: "dht", pin: "DATA" }, to: data, color: "yellow" },
		],
		steps: [
			{
				title: "Pico WH på kopplingsdäcket",
				text: "Sensorns datatråd kopplas till GP22, stift 29 i den övre raden. Vilket GP-stift som helst fungerar, så länge koden använder samma.",
				show: [],
				strips: [data],
				focus: [{ col: 13, row: "c" }],
				callout: { at: { col: 13, row: "c" }, text: "GP22 · stift 29" },
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
				title: "Ta fram modulen",
				text: "Läs vad som står vid stiften på just din modul. Ordningen skiljer sig mellan tillverkare – här är det VCC, DATA och GND, men din kan ha + och − på andra platser.",
				show: ["dht"],
				focus: [
					{ module: "dht", pin: "VCC" },
					{ module: "dht", pin: "DATA" },
					{ module: "dht", pin: "GND" },
				],
			},
			{
				title: "Ström till modulen",
				text: "Använd hona–hane-sladdar: VCC till plusskenan och GND till minusskenan. DHT11 fungerar bra på 3,3 V.",
				show: ["module-power", "module-ground"],
				strips: [
					{ col: 0, row: "top+" },
					{ col: 0, row: "top-" },
				],
			},
			{
				title: "Data till GP22",
				text: "En gul sladd från DATA till kolumnen ovanför GP22. All kommunikation går på den här enda tråden.",
				show: ["signal"],
				strips: [data],
				callout: { at: data, text: "GP22 (DATA)" },
			},
			{
				title: "Klart att testa",
				text: "Andas försiktigt på sensorn när koden kör – luftfuktigheten ska stiga tydligt efter några sekunder.",
				show: [],
			},
		],
	},
	connections: [
		{ from: "VCC (+)", to: "3V3(OUT) (stift 36)" },
		{ from: "DATA", to: "GP22 (stift 29)" },
		{ from: "GND (−)", to: "GND (stift 38)" },
	],
	code: {
		filename: "fukt.py",
		source: `from machine import Pin
import dht
import time

sensor = dht.DHT11(Pin(22))

while True:
    try:
        sensor.measure()
        print("Temperatur:", sensor.temperature(), "°C")
        print("Luftfuktighet:", sensor.humidity(), "%")
    except OSError:
        print("Kunde inte läsa sensorn – kolla kopplingen")
    time.sleep(2)                # DHT11 klarar högst en mätning per sekund
`,
		notes: [
			{ lines: "2", text: "Modulen dht följer med MicroPython och sköter den noggranna tidtagningen av pulserna." },
			{ lines: "5", text: "DHT11 och DHT22 har olika klasser. Välj den som står på din sensor." },
			{ lines: "9", text: "measure() väcker sensorn och läser alla 40 bitar. Värdena sparas tills nästa mätning." },
			{ lines: "8–13", text: "try/except fångar felet om sensorn inte svarar, så att programmet fortsätter i stället för att krascha." },
			{ lines: "14", text: "Minst en sekund mellan mätningarna – annars hinner sensorn inte med och svarar inte." },
		],
	},
	pitfalls: [
		{
			title: "OSError: [Errno 110] ETIMEDOUT",
			text: "Sensorn svarade inte. Kontrollera att DATA går till rätt GP-stift och att modulen får ström. Mät inte oftare än en gång per sekund.",
		},
		{
			title: "Konstiga värden, som 0 % eller 255",
			text: "Du använder troligen fel klass. dht.DHT11 och dht.DHT22 läser bitarna på olika sätt. En DHT22 är vit och ger decimaler; en DHT11 är blå och ger heltal.",
		},
		{
			title: "Lös sensor med fyra ben",
			text: "Utan modulkort saknas pull-up-motståndet. Sätt 10 kΩ mellan DATA och 3,3 V. Det tredje benet från vänster ska inte kopplas in.",
		},
		{
			title: "Stiften sitter i annan ordning",
			text: "Det finns flera varianter av modulen. Läs märkningen på kortet – + och − kan sitta på andra platser än i bilden.",
		},
		{
			title: "Temperaturen är för hög",
			text: "Sitter sensorn nära Picon eller en lampa kan den mäta deras värme. DHT11 har dessutom bara ±2 °C noggrannhet.",
		},
	],
	sim: {
		devices: [{ kind: "dht11", pin: 22 }],
		controls: ["temperature", "humidity"],
		ranges: { temperature: [0, 50] },
	},
};
