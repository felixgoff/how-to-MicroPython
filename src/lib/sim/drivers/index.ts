import ssd1306 from "./ssd1306.py?raw";

/**
 * Drivrutiner som inte följer med MicroPython. Kodlabbet lägger dem på kortet
 * – det simulerade eller det riktiga – när koden importerar dem, så att eleven
 * aldrig behöver installera något själv.
 */
export const drivers: Record<string, string> = {
	"ssd1306.py": ssd1306,
};

/** Drivrutinerna som en viss kod behöver, t.ex. { "ssd1306.py": "…" } */
export function driversFor(code: string): Record<string, string> {
	const needed: Record<string, string> = {};
	for (const [file, source] of Object.entries(drivers)) {
		const module = file.replace(/\.py$/, "");
		if (new RegExp(`^\\s*(import\\s+${module}\\b|from\\s+${module}\\s+import\\b)`, "m").test(code)) {
			needed[file] = source;
		}
	}
	return needed;
}
