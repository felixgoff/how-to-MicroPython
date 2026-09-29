/**
 * För att kunna visa vilken rad som körs just nu lägger vi in ett litet anrop
 * först på varje sats: `__rad(7); led.toggle()`. Anropet skriver ut radnumret
 * omgivet av ett osynligt tecken, som simulatorn plockar bort ur konsolen igen.
 *
 * Eftersom markören läggs på samma rad som satsen (med semikolon) ändras inga
 * radnummer – felmeddelanden pekar fortfarande på rätt rad i elevens kod.
 */

/** Record separator – ett tecken som aldrig förekommer i vanlig utskrift */
export const MARKER = "\x1e";

const FUNCTION_NAME = "__rad";
/** Samma sak, men skickar vidare ett värde – används i t.ex. while-villkor */
const VALUE_FUNCTION_NAME = "__radv";
/** Markerar for-raden en gång per varv i loopen */
const LOOP_FUNCTION_NAME = "__radl";

/** Definieras i REPL:en innan koden körs, så att elevens radnummer börjar på 1 */
export const TRACKING_PRELUDE = `import sys
def ${FUNCTION_NAME}(n):
    sys.stdout.write('${MARKER}%d${MARKER}' % n)
def ${VALUE_FUNCTION_NAME}(n, v):
    sys.stdout.write('${MARKER}%d${MARKER}' % n)
    return v
def ${LOOP_FUNCTION_NAME}(n, it):
    for v in it:
        sys.stdout.write('${MARKER}%d${MARKER}' % n)
        yield v
`;

/**
 * Rader som inleder ett block kan inte föregås av något på samma rad
 * (`__rad(1); while True:` är inte giltig Python). De som har ett villkor eller
 * något att loopa över får i stället markören runt det uttrycket:
 *
 *     while a < 5:        →  while __radv(7, (a < 5)):
 *     for ton in melodi:  →  for ton in __radl(9, (melodi)):
 *
 * Rader utan uttryck (else, try, finally, def, class …) går inte att markera.
 * De hoppas över, och raderna inuti blocket markeras som vanligt.
 */
const CONDITION_HEADER = /^(if|elif|while)\s+(.+):$/;
const FOR_HEADER = /^for\s+(.+?)\s+in\s+(.+):$/;

function instrumentHeader(rest: string, line: number): string | null {
	// Bara rader som slutar med kolon – står satsen på samma rad (`if x: y = 1`)
	// eller finns en kommentar efter kolonet låter vi raden vara
	if (!rest.endsWith(":")) return null;

	const condition = rest.match(CONDITION_HEADER);
	if (condition) return `${condition[1]} ${VALUE_FUNCTION_NAME}(${line}, (${condition[2]})):`;

	const loop = rest.match(FOR_HEADER);
	if (loop) return `for ${loop[1]} in ${LOOP_FUNCTION_NAME}(${line}, (${loop[2]})):`;

	return null;
}

const BLOCK_KEYWORDS = new Set([
	"if",
	"elif",
	"else",
	"for",
	"while",
	"try",
	"except",
	"finally",
	"with",
	"def",
	"class",
	"async",
	"match",
	"case",
]);

type ScanState = { depth: number; stringDelimiter: string | null };

/**
 * Går igenom en rad och håller reda på om den slutar mitt i en parentes eller
 * en trippelciterad sträng – då är nästa rad en fortsättning och ingen ny sats.
 */
function scanLine(line: string, state: ScanState) {
	let index = 0;
	while (index < line.length) {
		if (state.stringDelimiter) {
			if (line.startsWith(state.stringDelimiter, index)) {
				index += state.stringDelimiter.length;
				state.stringDelimiter = null;
			} else {
				index++;
			}
			continue;
		}

		const char = line[index];
		if (char === "#") return; // Resten av raden är en kommentar

		if (char === '"' || char === "'") {
			const triple = char.repeat(3);
			if (line.startsWith(triple, index)) {
				state.stringDelimiter = triple;
				index += 3;
				continue;
			}
			// Vanlig sträng på en rad – hoppa fram till avslutande citattecken
			index++;
			while (index < line.length) {
				if (line[index] === "\\") index += 2;
				else if (line[index] === char) {
					index++;
					break;
				} else index++;
			}
			continue;
		}

		if (char === "(" || char === "[" || char === "{") state.depth++;
		else if (char === ")" || char === "]" || char === "}") state.depth = Math.max(0, state.depth - 1);
		index++;
	}
}

function firstWord(text: string) {
	return text.match(/^[A-Za-z_]\w*/)?.[0] ?? "";
}

/** Lägger in radmarkörer i koden utan att ändra antalet rader. */
export function instrumentLines(code: string): string {
	const lines = code.replace(/\r\n/g, "\n").split("\n");
	const state: ScanState = { depth: 0, stringDelimiter: null };
	let startsStatement = true;

	const result = lines.map((line, index) => {
		const isStatementStart = startsStatement && state.depth === 0 && state.stringDelimiter === null;

		scanLine(line, state);
		const continues = line.trimEnd().endsWith("\\");
		startsStatement = state.depth === 0 && state.stringDelimiter === null && !continues;

		if (!isStatementStart) return line;

		const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
		const rest = line.slice(indentation.length);
		if (rest === "" || rest.startsWith("#") || rest.startsWith("@")) return line;

		if (BLOCK_KEYWORDS.has(firstWord(rest))) {
			const header = instrumentHeader(rest, index + 1);
			return header ? `${indentation}${header}` : line;
		}

		return `${indentation}${FUNCTION_NAME}(${index + 1}); ${rest}`;
	});

	return result.join("\n");
}
