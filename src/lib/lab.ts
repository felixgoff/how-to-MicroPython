/** Där kodlabbet sparar koden i webbläsaren, så att den finns kvar nästa gång */
export const LAB_CODE_KEY = "playground-code";

/** Går till snabbguiden på introduktionssidan (från en annan sida) */
export function openGuide(event?: Event) {
	event?.preventDefault();
	location.hash = "#/";
	// Sidbytet nollställer scrollningen, så vi väntar tills det är gjort
	setTimeout(() => document.getElementById("kom-igang")?.scrollIntoView({ behavior: "smooth" }), 150);
}

/** Öppnar kodlabbet med en viss kod i editorn */
export function openInLab(code: string) {
	localStorage.setItem(LAB_CODE_KEY, `${code.trim()}\n`);
	location.hash = "#/kodlabb";
}
