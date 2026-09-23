# cografya_web — copy rules

Read before writing or changing any user-facing Turkish text: cards, badges, ledes, buttons,
feedback lines, `messages/tr.json`. The reader is a student or a curious adult, not a reviewer.

## Rules

1. **Address the reader as "sen".** Imperatives: "bul", "seç", "dene". Possessives: "hafızan",
   "puanın". Never "siz" or the plural-polite forms ("bulun", "sınayın", "hafızanız").
2. **Plain words over technical or academic ones.**

   | Instead of                    | Write                                             |
   | ----------------------------- | ------------------------------------------------- |
   | vektör poligon, vektör harita | harita                                            |
   | interaktif                    | drop it, or say the verb ("tıkla", "yakınlaştır") |
   | motor, stüdyo, tuval, modül   | drop it                                           |
   | mekânsal konum                | yer, konum                                        |
   | kavrama, kavramak             | öğrenmek                                          |
   | detaylı inceleme              | say what the reader can actually look at          |
   | akıllı ipucu                  | ipucu                                             |
   | zoom, otomatik zoom           | yakınlaşır, yakınlaştır                           |

3. **No English terms in parentheses.** Not "(Active Recall)", not "(Mental Anchors)". If the
   Turkish needs the English to make sense, rewrite the Turkish.
4. **Facts: textbook standard, never invented precision.** A textbook-standard geography fact
   may stay without an on-page source; where the exact figure varies by year, say "yaklaşık" or
   round it. A figure that is not textbook-standard or cannot be checked is deleted. Claims about
   the product (curriculum alignment, compliance, "doğrulanmış") need proof in the product
   itself; no "bilimsel" as praise. This is a teaching site, not an encyclopedia: general
   geography facts get no source footnote. A figure that changes yearly carries its year
   ("2025'te yaklaşık 17 milyon"). Licence and data-provider credits (AFAD, TÜİK, OSM, Copernicus)
   are a different thing and always stay.
5. **A badge or eyebrow chip earns its place.** It stays only if it carries information that is
   not already visible in the same card or panel. "3 Özel Sınav Modu" above three cards and
   "81 Soru" under a title that says "81 İl" are decoration; delete them.
6. **Say what the reader does or gets, not how it is built.** No API or implementation names
   (Web Audio, Zoom/Pan, SVG, "Yeni özellikler"). Describe the effect: "harita o bölgeye
   yakınlaşır".
7. **Keep facts, change only the wording.** Numbers, source names and dates stay; if a fact
   fails rule 4, drop the sentence instead of softening it into vagueness.

## House style

- **Casing.** Headings (H1–H3), nav labels and buttons in Title Case. Badges, ledes, body
  text and list items in sentence case.
- **Vocabulary.** "Tüm" (not "Bütün"), "Diğer" (not "Öteki"), "puan" (not "skor" or "XP"),
  "oyun" for a game and "tur" for one play (not "sınav"), "il" (not "şehir") for Turkish
  provinces, "ve" instead of "&" in nav and headings.
- **One name per page.** A page's H1 uses the same words as its nav label and breadcrumb.
- **Ledes.** At most one question-style lede per page; never stack questions. Do not reuse
  the "Bu sayfada … bulursun" or "tıkla: X açılır" frames across pages.

## Out of scope

- Licence and attribution texts: `lang="en"` blocks, `MapAttribution`, `MarineAttribution`,
  `EarthquakeAttribution`, `Marine.disclaimer.*`. They are required wording.
- SEO copy: `<title>`, meta description, `generateMetadata`, `buildMetadata()` inputs.
- The EN locale and the `/design-system` showcase.

## Before → after (from `/oyun`)

| Before                                                                                                                          | After                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Harita Oyun Stüdyosu · İnteraktif Sınav & Hafıza Motoru                                                                         | Dilsiz harita · Bir oyun seç, yerleri haritada bul                                                                            |
| Rastgele sorulan Türkiye illerini dilsiz haritada tıklayarak bulun. Seri çarpanı ve akıllı ipucu desteğiyle hafızanızı sınayın. | Sorulan ili dilsiz haritada bul. Takılırsan ipucu al: ilin bölgesini ve plaka kodunu söyler, ama o sorunun puanı yarıya iner. |
| Türkiye'nin 7 coğrafi bölgesinin sınırlarını ve mekânsal konumlarını renkli vektör poligonlar üzerinde test et.                 | Harita bölgelere göre boyalı ama adları yazmıyor. Adı sorulan bölgeyi bul ve üstüne tıkla.                                    |
| 7 bölge vektör harita sınırları · Bölgesel coğrafya kavrama                                                                     | 7 coğrafi bölgenin hepsi · İpucu kıyısını ve komşularını söyler                                                               |
| Bölgeye özel otomatik zoom                                                                                                      | Harita o bölgeye yakınlaşır                                                                                                   |
| 1. Zihinsel Harita Çapaları (Mental Anchors)                                                                                    | Önce Belirgin Yerleri Öğren                                                                                                   |
| Yeni Oyun Özellikleri: Canlı Web Audio ses efektleri, Zoom/Pan desteği, akıllı ipuçları ve detaylı inceleme.                    | (deleted: the reader sees sound, zoom and hints the moment the game starts)                                                   |
| Aktif Geri Çağırma (Active Recall) uyumlu MEB müfredatı.                                                                        | (deleted: no curriculum mapping exists to back it)                                                                            |
| Dilsiz haritada konum tahmin etmek … %300 daha kalıcı sinaptik bağlar kurarak …                                                 | (deleted: no source)                                                                                                          |
