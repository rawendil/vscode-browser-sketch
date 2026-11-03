# Browser Sketch

Zrzut karty **wbudowanej przeglądarki VS Code** jednym skrótem, z rysowaniem na nim i kopiowaniem do schowka. Do pokazania agentowi albo koledze, co poprawić na stronie — bez Flameshota, bez Copilota, bez wychodzenia z edytora.

## Jak używać

1. Otwórz stronę we wbudowanej przeglądarce VS Code.
2. Naciśnij **`Ctrl+Alt+S`** (lub kliknij ikonę aparatu na pasku stanu, lub wybierz z palety „Browser Sketch: Zrzut przeglądarki”).
3. Zrzut otwiera się w nowej karcie „Szkic” — zaznacz, co trzeba.
4. **`Ctrl+C`** kopiuje obraz z rysunkiem do schowka. Wklej go do czatu, zgłoszenia albo komunikatora.

Zrzut obejmuje to, co widać na karcie, w jej bieżącym stanie — strona nie jest przeładowywana, więc zalogowanie, otwarte okna czy przewinięcie zostają na swoim miejscu. Płótna WebGL i canvas są na zrzucie.

## Narzędzia

| Narzędzie | Klawisz | Działanie |
| --- | --- | --- |
| Zaznacz | `S` | Przeciągnij obszar do skopiowania. `Esc` usuwa zaznaczenie. |
| Pisak | `P` | Rysowanie odręczne. |
| Strzałka | `A` | Domyślne narzędzie. |
| Prostokąt | `R` | Ramka wokół elementu. |
| Tekst | `T` | Kliknij, wpisz, zatwierdź `Enter`. |
| Gumka | `E` | Kliknij lub przeciągnij po obiekcie — znika cały. |

- Sześć kolorów (domyślnie czerwony) i trzy grubości na pasku narzędzi.
- **`Ctrl+Z`** cofa, **`Ctrl+Shift+Z`** ponawia.
- **`Ctrl+C`** lub **`Enter`** kopiuje zaznaczony obszar; bez zaznaczenia — cały obraz. Kopia ma pełną rozdzielczość zrzutu.

Na macOS zamiast `Ctrl` używaj `Cmd`; skrót zrzutu to `Ctrl+Alt+S`.

## Wymagania

- VS Code **1.117** lub nowszy z wbudowaną przeglądarką (Integrated Browser).
- Wbudowany debuger JavaScript (`ms-vscode.js-debug`) — jest w VS Code domyślnie.

## Jak to działa

VS Code nie daje rozszerzeniom wglądu w kartę przeglądarki inaczej niż przez debugowanie. Browser Sketch na czas zrzutu (ok. 2 s) podpina się pod otwartą kartę ukrytą sesją debugowania, wykonuje zrzut przez Chrome DevTools Protocol i od razu się odłącza. Karta zostaje otwarta, a cudze sesje debugowania nie są ruszane.

Zrzuty leżą w prywatnym katalogu rozszerzenia i znikają po zamknięciu karty „Szkic”. Nic nie jest wysyłane poza komputer.

## Ograniczenia

- Przy kilku otwartych kartach przeglądarki VS Code zapyta, którą zrzucić.
- Zrzut obejmuje widoczną część strony, nie całą przewijaną stronę.
- Stan chwilowy strony (najechanie myszą, rozwinięta lista) może zniknąć, bo wywołanie polecenia zabiera fokus z karty.

## Licencja

MIT © Sebastian Soczka
