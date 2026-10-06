/** Där kodlabbet sparar koden i webbläsaren, så att den finns kvar nästa gång */
export const LAB_CODE_KEY = "playground-code";

/** Öppnar kodlabbet med en viss kod i editorn */
export function openInLab(code: string) {
	localStorage.setItem(LAB_CODE_KEY, `${code.trim()}\n`);
	location.hash = "#/kodlabb";
}
