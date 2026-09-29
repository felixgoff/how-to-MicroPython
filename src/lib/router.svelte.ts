/**
 * Enkel routing via adressfältets hash (#/kodlabb, #/komponent/led). Det gör
 * att sidan fungerar på GitHub Pages utan serverinställningar, och att länkar
 * går att dela.
 */
function currentPath(): string | null {
	const hash = location.hash.replace(/^#/, "");
	// Hashar utan inledande snedstreck är ankarlänkar inom sidan (#pinout),
	// de ska inte byta sida.
	if (!hash.startsWith("/")) return null;
	return hash.replace(/\/+$/, "") || "/";
}

class Router {
	path = $state(currentPath() ?? "/");

	/** Namnet på komponenten om vi är på en komponentsida, t.ex. "led" */
	get component() {
		const match = this.path.match(/^\/komponent\/([\w-]+)/);
		return match?.[1] ?? null;
	}

	constructor() {
		addEventListener("hashchange", () => {
			const next = currentPath();
			if (next === null || next === this.path) return;
			this.path = next;
			scrollTo({ top: 0 });
		});
	}
}

export const router = new Router();
