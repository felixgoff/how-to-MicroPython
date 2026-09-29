import { nextToPico } from "$lib/wiring/geometry.js";
import type { ComponentGuide } from "./types.js";

const power = nextToPico(36); // 3V3(OUT)
const ground = nextToPico(38); // GND
const data = nextToPico(29); // GP22

export const temperature: ComponentGuide = {
	slug: "temperatur",
	title: "Temperatursensor",
	tagline: "Mät temperaturen med en DS18B20 – en digital sensor som pratar 1-Wire.",
	tags: ["Digital", "1-Wire"],
	facts: [
		{ label: "Sensor", value: "DS18B20" },
		{ label: "Stift i exemplet", value: "GP22 (stift 29)" },
		{ label: "Mätområde", value: "−55 till +125 °C, ±0,5 °C" },
		{ label: "Behöver också", value: "4,7 kΩ motstånd" },
	],
	needs: [
		{ item: "Raspberry Pi Pico WH", note: "med micro-USB-sladd" },
		{ item: "Kopplingsdäck" },
		{ item: "DS18B20", note: "i TO-92-kapsel eller vattentät kabelvariant" },
		{ item: "Motstånd 4,7 kΩ", note: "färgkod gul–lila–röd" },
		{ item: "7 kopplingssladdar", note: "hane–hane" },
	],
	how: [
		"DS18B20 ser ut som en liten transistor men innehåller en hel termometer med egen omvandlare. Den skickar temperaturen som ett färdigt tal, så det blir inga problem med brus eller omräkningar som med analoga sensorer.",
		"Den pratar 1-Wire: all kommunikation sker på en enda datatråd. Picon och sensorn turas om att dra tråden låg i noga tidsatta pulser. Varje sensor har ett unikt 64-bitars serienummer, så flera sensorer kan dela på samma tråd.",
		"Tråden måste hållas hög när ingen drar i den. Det sköter ett 4,7 kΩ pull-up-motstånd mellan datatråden och 3,3 V. MicroPython har färdiga moduler, onewire och ds18x20, som sköter protokollet.",
		"Picons processor har också en inbyggd temperatursensor på ADC-kanal 4. Den kräver ingen koppling alls, men mäter chippets egen temperatur och är betydligt mindre noggrann.",
	],
	diagram: {
		description:
			"Pico WH på ett kopplingsdäck med 3,3 volt på plusskenan och GND på minusskenan. En DS18B20 sitter i kopplingsdäcket med benen GND, DQ och VDD. GND går till minusskenan, VDD till plusskenan, ett 4,7 kilo-ohms motstånd går från DQ till plusskenan, och en gul sladd går från DQ till GP22, stift 29.",
		railLabels: { "top+": "3,3 V", "top-": "GND" },
		parts: [
			{
				id: "sensor",
				kind: "to92",
				label: "DS18B20",
				legs: [
					{ col: 26, row: "e" },
					{ col: 27, row: "e" },
					{ col: 28, row: "e" },
				],
				legNames: ["GND", "DQ", "VDD"],
			},
			{
				id: "pullup",
				kind: "resistor",
				from: { col: 27, row: "b" },
				to: { col: 31, row: "b" },
				ohms: "4,7 kΩ",
				bands: ["yellow", "violet", "red", "gold"],
			},
		],
		modules: [],
		wires: [
			{ id: "power", from: power, to: { col: 6, row: "top+" }, color: "red" },
			{ id: "ground", from: ground, to: { col: 4, row: "top-" }, color: "black" },
			{ id: "sensor-ground", from: { col: 26, row: "a" }, to: { col: 26, row: "top-" }, color: "black" },
			{ id: "sensor-power", from: { col: 28, row: "a" }, to: { col: 28, row: "top+" }, color: "red" },
			{ id: "pullup-power", from: { col: 31, row: "a" }, to: { col: 31, row: "top+" }, color: "red" },
			{ id: "signal", from: { col: 27, row: "a" }, to: data, color: "yellow" },
		],
		steps: [
			{
				title: "Pico WH på kopplingsdäcket",
				text: "Sensorn kopplas till GP22, stift 29 i den övre raden. 1-Wire fungerar på vilket GP-stift som helst.",
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
				title: "Sätt i sensorn",
				text: "Håll sensorn med den platta sidan mot dig. Då är benen från vänster: GND, DQ (data) och VDD (ström). Vänder du den åt fel håll blir den brännhet på några sekunder – dra ur USB-sladden direkt om det händer.",
				show: ["sensor"],
				focus: [
					{ col: 26, row: "e" },
					{ col: 27, row: "e" },
					{ col: 28, row: "e" },
				],
				strips: [
					{ col: 26, row: "e" },
					{ col: 27, row: "e" },
					{ col: 28, row: "e" },
				],
			},
			{
				title: "Ström till sensorn",
				text: "GND-benets kolumn till minusskenan och VDD-benets kolumn till plusskenan.",
				show: ["sensor-ground", "sensor-power"],
				strips: [
					{ col: 26, row: "a" },
					{ col: 28, row: "a" },
				],
			},
			{
				title: "Pull-up-motståndet",
				text: "Sätt 4,7 kΩ från DQ-kolumnen till en ledig kolumn och koppla den till plusskenan. Motståndet håller datatråden hög när ingen pratar på den. Utan det hittar ds.scan() ingen sensor.",
				show: ["pullup", "pullup-power"],
				strips: [
					{ col: 27, row: "b" },
					{ col: 31, row: "b" },
				],
			},
			{
				title: "Datatråden till GP22",
				text: "En gul sladd från DQ-kolumnen till GP22. Det här är den enda tråden all data går på – därav namnet 1-Wire.",
				show: ["signal"],
				strips: [{ col: 27, row: "a" }, data],
				callout: { at: data, text: "GP22 (DQ)" },
			},
			{
				title: "Klart att testa",
				text: "Håll i sensorn med fingrarna när koden kör – temperaturen ska stiga mot din kroppstemperatur inom någon minut.",
				show: [],
			},
		],
	},
	connections: [
		{ from: "GND (vänster ben)", to: "GND (stift 38)" },
		{ from: "DQ (mittenbenet)", to: "GP22 (stift 29) + 4,7 kΩ till 3,3 V" },
		{ from: "VDD (höger ben)", to: "3V3(OUT) (stift 36)" },
	],
	code: {
		filename: "temperatur.py",
		source: `from machine import Pin
import onewire, ds18x20
import time

ds = ds18x20.DS18X20(onewire.OneWire(Pin(22)))

sensorer = ds.scan()             # letar efter sensorer på tråden
print("Hittade", len(sensorer), "sensor(er)")

while True:
    ds.convert_temp()            # be alla sensorer att mäta
    time.sleep_ms(750)           # en mätning tar upp till 750 ms
    for rom in sensorer:
        temperatur = ds.read_temp(rom)
        print("Temperatur:", round(temperatur, 1), "°C")
    time.sleep(1)
`,
		notes: [
			{ lines: "2", text: "onewire och ds18x20 följer med MicroPython – du behöver inte installera något." },
			{ lines: "5", text: "OneWire sköter protokollet på GP22, och DS18X20 vet hur just den här sensorn ska läsas." },
			{ lines: "7", text: "scan() ger en lista med serienumret för varje sensor den hittar. En tom lista betyder att något är fel kopplat." },
			{ lines: "11–12", text: "convert_temp() startar en mätning. Sensorn behöver upp till 750 ms på sig innan resultatet går att läsa." },
			{ lines: "13–15", text: "read_temp() hämtar temperaturen i grader Celsius för varje sensor i listan." },
		],
	},
	pitfalls: [
		{
			title: "scan() hittar ingen sensor",
			text: "Nästan alltid saknas 4,7 kΩ-motståndet mellan DQ och 3,3 V, eller så sitter det i fel kolumn. Kontrollera också att DQ går till samma GP-stift som i koden.",
		},
		{
			title: "Temperaturen visar 85 °C",
			text: "85 °C är sensorns startvärde innan den har mätt något. Det betyder att convert_temp() inte hunnit bli klar – vänta 750 ms innan read_temp().",
		},
		{
			title: "Sensorn blir brännhet",
			text: "Den sitter åt fel håll så att GND och VDD bytt plats. Dra ur USB-sladden direkt, låt den svalna och vänd på den. Platta sidan ska vara mot dig: GND, DQ, VDD.",
		},
		{
			title: "IndexError när koden läser",
			text: "Listan från scan() är tom och koden försöker läsa sensorer[0]. Kontrollera kopplingen, eller låt koden skriva ut ett tydligt meddelande om listan är tom.",
		},
		{
			title: "Vattentät variant med kabel",
			text: "Sladdarna brukar vara röd = VDD, svart = GND och gul (ibland vit) = DQ. Pull-up-motståndet behövs fortfarande.",
		},
	],
	sim: {
		devices: [{ kind: "ds18b20", pin: 22 }],
		controls: ["temperature"],
	},
};
