// Hämtar de två binärfiler som simulatorn behöver och lägger dem i public/sim/:
//
//   bootrom.bin      – RP2040:s inbyggda startkod (samma som i ett riktigt chip)
//   micropython.bin  – MicroPython-firmware, uppackad från en .uf2-fil
//
// Obs: här används firmware för Pico *utan* WiFi. Emulatorn har inget
// CYW43439-chip, och W-firmware låser sig så fort koden rör WiFi eller den
// inbyggda lampan. RP2040-kärnan – GPIO, PWM, ADC – är identisk på Pico WH.
//
// Kör med: bun run prepare-sim
import { mkdir, writeFile } from "node:fs/promises";

const BOOTROM_URL = "https://raw.githubusercontent.com/wokwi/rp2040js/master/demo/bootrom.ts";
const FIRMWARE_URL = "https://micropython.org/resources/firmware/RPI_PICO-20230426-v1.20.0.uf2";
const FLASH_START = 0x10000000;
const UF2_MAGIC_START = 0x0a324655;

async function download(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${url} svarade ${response.status}`);
	return response;
}

async function buildBootrom() {
	const source = await (await download(BOOTROM_URL)).text();
	const words = source.match(/0x[0-9a-f]{1,8}/g)?.map((word) => Number(word)) ?? [];
	if (words.length !== 4096) throw new Error(`Förväntade 4096 ord i bootrom, fick ${words.length}`);
	const data = new Uint32Array(words);
	return new Uint8Array(data.buffer);
}

// En .uf2-fil är en lista med 512-byte-block. Varje block har en liten header som
// säger vilken flash-adress de 256 bytena med data hör hemma på.
async function buildFirmware() {
	const uf2 = new Uint8Array(await (await download(FIRMWARE_URL)).arrayBuffer());
	const view = new DataView(uf2.buffer);
	const flash = new Uint8Array(2 * 1024 * 1024);
	let highest = 0;

	for (let offset = 0; offset + 512 <= uf2.length; offset += 512) {
		if (view.getUint32(offset, true) !== UF2_MAGIC_START) throw new Error("Trasig UF2-fil");
		const address = view.getUint32(offset + 12, true);
		const length = view.getUint32(offset + 16, true);
		const target = address - FLASH_START;
		if (target < 0 || target + length > flash.length) throw new Error(`Adress utanför flash: ${address}`);
		flash.set(uf2.subarray(offset + 32, offset + 32 + length), target);
		highest = Math.max(highest, target + length);
	}

	return flash.subarray(0, highest);
}

const [bootrom, firmware] = await Promise.all([buildBootrom(), buildFirmware()]);
await mkdir("public/sim", { recursive: true });
await writeFile("public/sim/bootrom.bin", bootrom);
await writeFile("public/sim/micropython.bin", firmware);
console.log(`bootrom.bin: ${bootrom.length} byte`);
console.log(`micropython.bin: ${(firmware.length / 1024).toFixed(0)} kB`);
