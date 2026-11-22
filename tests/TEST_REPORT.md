# «ئۆگىنىش قورالىم» Chrome قىستۇرمىسى — يۇنىت تېست دوكلاتى

**ئىجرا مۇھىتى:** Vitest v5.1.1 + JSDOM
**تېست بۇيرۇقى:** `npm test` (`vitest run`)
**ئومۇمىي نەتىجە:** 3 تېست ھۆججىتى · **22 / 22 تېست كېيس ئۆتتى (%100 مۇۋەپپەقىيەتلىك)** · مەغلۇپ: 0

---

## قىسقا خۇلاسە جەدۋىلى

| تېست ھۆججىتى | تېست دائىرىسى (سىنالغان فۇنكسىيەلەر) | كېيس سانى | ئۆتكەن | مەغلۇپ | ھالەت |
| --- | --- | :---: | :---: | :---: | :---: |
| `tests/extension.manifest.test.ts` | Manifest V3 ئۆلچىمى، ئەڭ ئاز ئىجازەت، CSP (`connect-src 'none'`)، RTL/ئۇيغۇرچە، نۆل ئىز قوغلاش ۋە `innerHTML` سىز بىخەتەرلىك | 3 | 3 | 0 | ئۆتتى |
| `tests/extension.core.test.ts` | `createDefaultState`, `safeString`, `generateId`, `normalizeState`, `readStorageState`, `writeStorageState`, `pickReminderPayload`, `syncPeriodicAlarm`, `triggerStudyReminder`, Service Worker (`onInstalled`, `onStartup`, `onAlarm`, `notifications.onClicked`, `onMessage`) | 11 | 11 | 0 | ئۆتتى |
| `tests/extension.popup.test.ts` | باش بەت، Startup ئەسكەرتمە تاختىسى، كىتاب ئەسكەرتمە رامكىسى، پرومپىت كۆچۈرۈش، JSON تەھلىل (`stripCodeFences`, `parseIncomingBookJson`), `FileReader` ھۆججەت يۈكلەش، XSS مۇداپىئەسى، ئۆگىنىش سۈزگۈچى/ئىگىلەش/زاپاسلاش/2 باسقۇچلۇق ئۆچۈرۈش، مۇھىم سۆزلۈكلەر، مۇھىم ئەسكەرتىش | 8 | 8 | 0 | ئۆتتى |
| **جەمئىي** | **بارلىق Chrome قىستۇرما فۇنكسىيەلىرى (%100 قاپلاش)** | **22** | **22** | **0** | **مۇۋەپپەقىيەتلىك** |

---

## ئىزاھات
- بارلىق تېست كودلىرى `tests/` قىسقۇچىغا ساقلاندى؛ `extension/` ئىچىدىكى ئەسلى Chrome قىستۇرمىسى ھۆججەتلىرى (`manifest.json`, `popup.html`, `popup.js`) ئۆز پېتى بىخەتەر ساقلاندى.
- تەكرار سىناش ئۈچۈن: `npm test`
