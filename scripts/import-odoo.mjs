// Turns the Odoo product export into the store's catalogue source (media-src/odoo/catalog.json).
//   1. python -I scripts/odoo-xlsx.py "product from odoo/Product (product.template).xlsx" media-src/odoo/odoo.json
//   2. node scripts/import-odoo.mjs
// Every row gets an English name, a sport + category, sizes and an image search query; rows that
// aren't sport products (toys, packaging), have no real name ("NOTHING", bare codes) or are
// duplicates are left out and listed in media-src/odoo/skipped.txt. Prices are the Odoo sales
// prices (dinars). Everything is imported as "Coming soon".
import fs from 'node:fs';

const SRC = 'media-src/odoo/odoo.json';
const OUT = 'media-src/odoo/catalog.json';
const SKIPPED = 'media-src/odoo/skipped.txt';

const rows = JSON.parse(fs.readFileSync(SRC, 'utf8'))['xl/worksheets/sheet1.xml'].slice(1);

/* ------------------------------- sizes ---------------------------------- */
const ADULT = ['S', 'M', 'L', 'XL', 'XXL'];
const KIDS = ['6Y', '8Y', '10Y', '12Y', '14Y'];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => `EU ${a + i}`);
const BOOTS = range(39, 45);
const KID_BOOTS = range(30, 38);
const GLOVES_OZ = ['10 oz', '12 oz', '14 oz', '16 oz'];
const KID_OZ = ['4 oz', '6 oz', '8 oz'];
const SUITS = ['150 cm', '160 cm', '170 cm', '180 cm', '190 cm'];
const KID_SUITS = ['110 cm', '120 cm', '130 cm', '140 cm', '150 cm'];
const GK = ['7', '8', '9', '10'];
const KID_GK = ['4', '5', '6'];
const ONE = ['One size'];

/* ------------------------------- brands --------------------------------- */
const BRANDS = [
  [/\bNIKE\b|JORDAN|MERCURIAL|PHANTOM|ZOOMX|AIR ?ZOOM|GRIPKNIT|VAPOR/i, 'nike'],
  [/ADD?IDAS|PREDATOR|ADIZERO|COPA\b|F50|CRAZY ?FAST|LAMINE YAMAL/i, 'adidas'],
  [/\bPUMA\b/i, 'puma'],
  [/VENUM/i, 'venum'],
  [/EVERL[AE]ST/i, 'everlast'],
  [/WILSON/i, 'wilson'],
  [/\bARENA\b/i, 'arena'],
  [/MOLTEN|MOTTEN/i, 'molten'],
  [/MIKASA|MEKASA|MIKSSA/i, 'mikasa'],
  [/INTEX/i, 'intex'],
  [/BESTWAY/i, 'bestway'],
  [/CRESSI/i, 'cressi'],
  [/BEUCHAT/i, 'beuchat'],
  [/SALV(IMAR)?\b/i, 'salvimar'],
  [/SHIMANO/i, 'shimano'],
  [/DAIWA/i, 'daiwa'],
  [/NABAIJI|DECATHLON|TRIBORD|OLAIAN/i, 'decathlon'],
  [/UHLSPORT/i, 'uhlsport'],
  [/KEMPA/i, 'kempa'],
  [/DERBY ?STAR/i, 'derbystar'],
  [/\bSELECT\b/i, 'select'],
  [/UMBRO/i, 'umbro'],
  [/LOTTO/i, 'lotto'],
  [/JOMA/i, 'joma'],
  [/HUMMEL/i, 'hummel'],
  [/UNDER ?ARMOU?R|\bUA\b/i, 'under-armour'],
  [/ASICS/i, 'asics'],
  [/HOKA/i, 'hoka'],
  [/\bUFC\b/i, 'ufc'],
  [/FAIRTEX/i, 'fairtex'],
  [/BUKA/i, 'buka'],
  [/ARAWAZA/i, 'arawaza'],
  [/MATSURU/i, 'matsuru'],
  [/TOKAIDO/i, 'tokaido'],
  [/FOX ?(40|80)/i, 'fox40'],
  [/CONQUEST|C0NQUEST/i, 'conquest'],
  [/AQUA ?SUB/i, 'aquasub'],
  [/AQUA ?FLOW/i, 'aquaflow'],
  [/SIBOTE/i, 'sibote'],
  [/HERAKLES/i, 'herakles'],
  [/NORTH FACE/i, 'the-north-face'],
  [/GOLDS?\b/i, 'golds-gym'],
];
const brandOf = (n) => BRANDS.find(([re]) => re.test(n))?.[1] ?? 'other';

/* -------------------------------- skip ---------------------------------- */
// not sport products / not a real name / brands we won't list on a sports site
const SKIP = [
  /^[\dA-Z]{0,2}[\d ./-]+$/, /^\d+$/, /^[A-Z]?\d{3,4}$/, /^(NOTHINGG?|M3|DEC|GAIN L\/R|FENGSU|PESAIL.*|DINAT FORNO|TICKET\/YEBRA|3O9ACH|YN121|ST[ -]?\d.*|YC \d+|A9\d\d|PEALDOOTORS|JUST ONE SHAPES|CHUKER.*|KOKI VIVA|STAINLESS STEEL|SHRILLING CHICKEN|LIBA SILICONNE|MAKIYAGE.*|SAC A MAIN FEMME|GYMSHARK|VENUM|TRY ET DO|SOPORTE ANTIFATIGA|WINRAIN COMPRESS|SYOSIN FITNESS|SMART FITNESS SERIES 5IN1|CASSETTE ADVANCED.*|SAC TALON|SOUFLE|CHEST|DEMI FIZO|FIZO|GAIN|NABAIJI|CONQUEST 4[05]|SIBOTE)$/,
  /\(copy\)/i,
  /LOUIS VUITTON|\bLV\b|BURBERRY|GUCCI|CUCI|DIOR|\bBOSS\b|LACOSTE|EA7|KENZO/i,
];

/* -------------------------------- rules ---------------------------------
 * [pattern, sport, sub, name (string or fn of the Odoo name), sizes?, query?]
 * The first matching rule wins. `query` is the image search (defaults to the name).
 */
const kid = (n) => /ENFANT|ENF\b|KIDS?|CHILD|BABY|BABIES|JR\b|PM\b/i.test(n);
const R = [
  // ---------------- football
  [/^FLOCAGE OFFICIEL/, 'football', 'jerseys', 'Name & number printing — official style', ONE, 'football shirt name number printing'],
  [/^FLOCAGE/, 'football', 'jerseys', 'Name & number printing', ONE, 'football shirt name number printing'],
  [/MAILLOT TRADITIONELLE/, 'football', 'jerseys', 'Traditional jersey — Nedroma / Ghazaouet / Algeria', ADULT],
  [/MAILLOT DZ GLACE/, 'football', 'jerseys', 'Algeria ice jersey', ADULT, 'Algeria football jersey'],
  [/^MAILLOT DE FOOTBALL DZ/, null], // replaced by the real Algeria kits (jerseys)
  [/^MAILLOT DE FOOTBALL EURO/, null], // replaced by the real club kits
  [/^REAL MADRID BLEU$/, null],
  [/^Maillot MONTREAL/i, 'football', 'jerseys', 'CF Montréal jersey', ADULT, 'CF Montreal jersey'],
  [/^SOULIER (\d\d)-(\d\d)( NIKE TT\/CR)?/, 'football', 'boots', (n, m) => `Football boots EU ${m[1]}–${m[2]}${m[3] ? ' — Nike turf / FG' : ''}`, (n, m) => range(+m[1], +m[2])],
  [/SOULIER ENFANT|SOULIER NIKE (CRAMPONS )?ENFANT|SOULIER CR7 TOUT TERAIN ENFANT|SOULIER NIKE TOUT TERAIN ENFANT|SOLIER ENFANT/, 'football', 'boots', (n) => kidsBoot(n), KID_BOOTS],
  [/^SO[UL]+I?ER |^SOLIER /, 'football', 'boots', (n) => boot(n), BOOTS],
  [/GANT GARDIEN NIKE|GK VAPOR GRIP/, 'football', 'goalkeeper', (n) => /VAPOR/.test(n) ? 'Nike Vapor Grip3 goalkeeper gloves' : 'Nike goalkeeper gloves', GK],
  [/GANTS? (GARDIEN|GK)/, 'football', 'goalkeeper', (n) => gkGloves(n), (n) => kid(n) ? KID_GK : GK],
  [/TENU GARDIEN|PANTALON LUANVI GARDIEN/, 'football', 'goalkeeper', (n) => /PANTALON/.test(n) ? 'Goalkeeper trousers' : /CUIPP?S/.test(n) ? 'Goalkeeper kit — premium' : 'Goalkeeper kit', ADULT],
  [/CHAUSSETTES FOOTBALL\/ LES BAS/, 'football', 'socks', (n) => footSocks(n), (n) => kid(n) ? KIDS : ['EU 39–42', 'EU 43–46']],
  [/DEMI BAS HUMMEL (.+)/, 'football', 'socks', (n, m) => `Hummel footless match socks — ${colour(m[1])}`, ONE, 'hummel footless football socks'],
  [/DEMI BAS SILICONE|FOOTLESS/, 'football', 'socks', (n) => /SILICONE/.test(n) ? 'Grip socks (silicone, footless)' : 'Footless football socks', ONE, 'football grip socks'],
  [/CHAUSSETTES HIGH QUALITY|SHUSSETTE LONG|ALL ROUND SOCKS/, 'football', 'socks', (n) => /LONG/.test(n) ? 'Long sports socks' : /ALL ROUND/.test(n) ? 'All-round sports socks' : 'Football socks — high quality', ['EU 39–42', 'EU 43–46']],
  [/Nike Mens Socks 10 Pair/i, 'running', 'accessories', 'Nike Dri-FIT cushioned socks (10 pairs)', ['EU 41–47'], 'Nike Dri-FIT lightweight socks 10 pair grey'],
  [/^PROTEGE TIBIA (FOOT|PRO|VN)|^PROTEGE TIBIA FOOT/, 'football', 'shin-guards', (n) => /CUIPP/.test(n) ? 'Shin guards — premium' : /PRO$/.test(n) ? 'Shin guards Pro' : /VN/.test(n) ? 'Shin guards with ankle protection' : 'Football shin guards', ['S', 'M', 'L'], 'football shin guards'],
  [/^PROTEGE TIBIA$/, 'football', 'shin-guards', 'Shin guards — basic', ['S', 'M', 'L'], 'football shin guards'],
  [/PROTEGE FOOT/, 'football', 'shin-guards', 'Football ankle guard', ['S', 'M', 'L'], 'football ankle guard'],
  [/BALLON QUATAR 2022 ORIGINAL/, 'football', 'balls', 'adidas Al Rihla — World Cup 2022 match ball', ['Size 5'], 'adidas Al Rihla Pro ball'],
  [/BALLON QUATAR 2022/, 'football', 'balls', 'World Cup 2022 replica ball', ['Size 5'], 'Al Rihla football'],
  [/BALLON 2026|BALLON WC ADDIDAS/, 'football', 'balls', (n) => /WC/.test(n) ? 'adidas World Cup ball' : 'World Cup 2026 ball', ['Size 5'], 'adidas Trionda World Cup 2026 ball'],
  [/BALLON CHAMPIONS LEAGUE/, 'football', 'balls', 'Champions League ball', ['Size 5'], 'adidas UCL ball 2025'],
  [/BALLON FOOT PUMA LALIGA/, 'football', 'balls', 'PUMA LaLiga ball', ['Size 5'], 'puma laliga ball'],
  [/BALLON (ADIDAS GLACE|SARSON GLACE)/, 'football', 'balls', (n) => /ADIDAS/.test(n) ? 'adidas glossy football' : 'Sarson glossy football', ['Size 5']],
  [/BALLON SARSON( 79)?/, 'football', 'balls', (n, m) => `Sarson football${m[1] ? ' 79' : ''}`, ['Size 5'], 'Sarson football ball'],
  [/BALLON (ADIDAS|PUMA|UMBRO|LOTTO|SELECT|DERBYSTAR|DERBY|MLS|PL|STAR|SUPER|PRO NV|PRO\+|MIKSSA|VEGASTAR\/JOMA\/DERBYSTAR|VEGASTAR|\+{1,3})$/, 'football', 'balls', (n, m) => footBall(m[1]), ['Size 5']],
  [/BALLON SIZE 4 FOX/, 'football', 'balls', 'Fox football — size 4', ['Size 4']],
  [/BALLON TRAIN/, 'football', 'balls', 'Training football', ['Size 5'], 'training football ball'],
  [/BALLON REDUCATION$/, 'fitness', 'equipment', 'Rehab exercise ball', ONE, 'physio rehabilitation ball'],
  [/BALL REDUCATION (GM|PM)/, 'recovery', 'massage', (n, m) => `Rehab squeeze ball — ${m[1] === 'GM' ? 'large' : 'small'}`, ONE, 'hand rehabilitation squeeze ball'],
  [/MINI FOOT/, 'football', 'accessories', 'Mini football goal', ONE, 'mini football goal'],
  [/FILLET DE FOOT/, 'football', 'accessories', 'Football goal net', ONE],
  [/PORTE BALLON SAC/, 'football', 'accessories', 'Ball carry bag', ONE, 'ball carry net bag'],
  [/LA VESSIE/, 'football', 'accessories', 'Replacement ball bladder', ONE],
  [/TABLEAU FOOTBALL/, 'football', 'referee', 'Tactics board', ONE, 'football tactics board'],
  [/COACH FOOTBALL/, 'football', 'referee', 'Coach tactics folder', ONE, 'football coach tactic board folder'],
  [/CARTON ARBITRE|CARTON R\/J/, 'football', 'referee', (n) => /ARBITRE/.test(n) ? 'Referee card wallet' : 'Referee cards — red & yellow', ONE, 'referee cards red yellow'],
  [/CAPITAINE BRASSAR|CAPITAINE|CAPTAIN/, 'football', 'accessories', (n) => /BRASS/.test(n) ? 'Captain armband — elastic' : /CAPTAIN/.test(n) ? 'Captain armband — premium' : 'Captain armband', ONE, 'captain armband football'],
  [/SIFF?LE?R FOX 40 SHARK/, 'football', 'referee', 'Fox 40 Sharx whistle', ONE, 'fox 40 sharx whistle'],
  [/SIFF?LI?E?R FOX 40\/80/, 'football', 'referee', 'Fox 40 / Fox 80 whistle', ONE, 'fox 40 whistle'],
  [/SIFF?LE?R FOX 80|^FOX ?80/, 'football', 'referee', 'Fox 80 whistle', ONE, 'fox 80 whistle'],
  [/SIFF?LE?R FOX 40|^FOX ?40/, 'football', 'referee', (n) => /600/.test(n) ? 'Fox 40 Classic whistle — basic' : 'Fox 40 Classic whistle', ONE, 'fox 40 classic whistle'],
  [/SIFLIER ELECTRIQUE/, 'football', 'referee', 'Electronic whistle', ONE, 'electronic whistle'],
  [/NIKE PRO NECK WHISTLE/, 'football', 'referee', 'Nike Pro whistle with lanyard', ONE, 'nike whistle lanyard'],
  [/WHISTLE (1\.2|130DB)/, 'football', 'referee', (n, m) => m[1] === '130DB' ? 'Whistle 130 dB' : 'Metal whistle', ONE],
  [/CRONO|PROFESSIONAL STOPWATCH|STOPWATCH (FLOTT|KISLO)/, 'football', 'referee', (n) => stopwatch(n), ONE, (n) => /\d+M/.test(n) ? 'fibreglass measuring tape' : 'sports stopwatch'],
  [/^COUPE|TROPHIE|TROPHY FOOTBALL/, 'football', 'trophies', (n) => /TROPHY FOOTBALL/.test(n) ? 'Football trophy — small' : 'Trophy cup', ONE, 'football trophy cup'],
  [/MEDAILLE|MEDAL JO/, 'football', 'trophies', (n) => /JO/.test(n) ? 'Medal with ribbon — gold / silver / bronze' : 'Sports medal with ribbon', ONE, 'sports medal ribbon'],
  [/ENSEMBLE FOOT (ADULT|ENFANT) HS/, 'football', 'kits', (n, m) => `Football kit — shirt & shorts${m[1] === 'ENFANT' ? ' (kids)' : ''}`, (n, m) => m[1] === 'ENFANT' ? KIDS : ADULT, 'football kit shirt shorts set'],
  [/ENSEMBLE FOOT NIKE/, 'football', 'kits', 'Nike football kit — red / orange / blue', ADULT],
  [/ENSEMBLE NIKE 5P|ENSEMBLE (2PC|5PC|6PC)( ENF)?/, 'football', 'kits', (n) => kitSet(n), (n) => kid(n) ? KIDS : ADULT, 'football training kit set'],
  [/ENSEMBLE ENFANT/, 'football', 'kits', 'Kids sports set', KIDS],
  [/ENSEMBLE BASKETBALL/, 'basketball', 'apparel', 'Basketball set — jersey & shorts', ADULT, 'basketball jersey shorts set'],
  [/SURVETEMENT|SURVETTEMENT|SURVETTE ON NIKE|^VEST |^VESTE KAWI/, 'football', 'tracksuits', (n) => tracksuit(n), (n) => kid(n) ? KIDS : ADULT],
  [/^BOB (MCA\/USMA)/, 'fan', 'caps', 'MCA / USMA bucket hat', ONE, 'bucket hat football club'],
  [/^BOB (FOR ADVENTURES|SPORT|TB)$/, 'fan', 'caps', (n, m) => m[1] === 'SPORT' ? 'Sports bucket hat' : m[1] === 'TB' ? 'Bucket hat — TB' : 'Adventure bucket hat', ONE, 'sports bucket hat'],
  [/CASQUETTE (CLUBS|DZ|ENFANT DECATHLON)/, 'fan', 'caps', (n, m) => m[1] === 'CLUBS' ? 'Football club cap' : m[1] === 'DZ' ? 'Algeria cap' : 'Kids cap — Decathlon', ONE, (n, m) => m[1] === 'DZ' ? 'Algeria cap' : m[1] === 'CLUBS' ? 'football club cap' : 'decathlon kids cap'],
  [/CHAPEAU 80/, 'fan', 'caps', 'Sun hat', ONE, 'sun hat'],
  [/DRAPEAU ALGERIE 90x150 SATIN/, 'fan', 'flags', 'Algeria flag 90×150 cm — satin', ONE, 'Algeria flag satin'],
  [/DRAPEAU ALGERIE 90x150/, 'fan', 'flags', 'Algeria flag 90×150 cm', ONE, 'Algeria flag'],
  [/DRAPEAU D'ALGERIE/, 'fan', 'flags', 'Algeria flag — giant', ONE, 'giant Algeria flag'],
  [/DRAPEAU PALASTINE/, 'fan', 'flags', 'Palestine flag', ONE, 'Palestine flag'],
  [/DRAPEAU CHALITIER GUIRLAND/, 'fan', 'flags', 'Algeria flag garland', ONE, 'Algeria flag bunting garland'],
  [/DRAPEAU SATIN BORDUR SEUL FACE (\d+)\*(\d+)/, 'fan', 'flags', (n, m) => `Algeria flag ${m[1]}×${m[2]} cm — satin, hemmed`, ONE, 'Algeria flag satin'],
  [/DRAPEAU SATIN (150\*100|2\.50M)/, 'fan', 'flags', (n, m) => `Algeria flag ${m[1] === '2.50M' ? '250 cm' : '150×100 cm'} — satin`, ONE, 'Algeria flag satin'],
  [/CHALE PALASTINE/, 'fan', 'flags', 'Palestine keffiyeh scarf', ONE, 'Palestine keffiyeh'],
  // ---------------- basketball / volley / handball / racket
  [/BALLON BASKET(BALL|TE)? (FOX )?GM?(\d)X/, 'basketball', 'balls', (n, m) => `Fox basketball — size ${m[3]}`, (n, m) => [`Size ${m[3]}`], 'Fox basketball ball'],
  [/BALLON BASKETBALL (HUMBLE|MOLTEN)|BALLON BASKETTE MOTTEN FIBA BG4500/, 'basketball', 'balls', (n) => /4500/.test(n) ? 'Molten BG4500 FIBA basketball' : /MOLTEN/.test(n) ? 'Molten basketball' : 'Humble basketball', ['Size 7'], (n) => /4500/.test(n) ? 'Molten BG4500 basketball' : /MOLTEN/.test(n) ? 'Molten basketball' : 'Humble basketball'],
  [/BALLON BASKET (1000TRENL|1CH|TRAIN)/, 'basketball', 'balls', (n, m) => m[1] === '1CH' ? 'Basketball — first choice' : 'Training basketball', ['Size 7'], 'basketball ball'],
  [/BALLON WILSON( GM| PM)?$/, 'basketball', 'balls', (n, m) => `Wilson basketball${m[1] === ' GM' ? ' — size 7' : m[1] === ' PM' ? ' — size 5' : ''}`, (n, m) => [m[1] === ' PM' ? 'Size 5' : 'Size 7'], 'Wilson basketball'],
  [/BALLON FRANKLIN/, 'basketball', 'balls', 'Franklin basketball', ['Size 7'], 'Franklin basketball'],
  [/BALLON VOLL?E?Y ?BALL|BALLON VOLLYBALL/, 'volleyball', 'balls', (n) => /MEKASA/.test(n) ? 'Mikasa volleyball' : /SUPA/.test(n) ? 'Volleyball — Supa' : /N0\.5/.test(n) ? 'Volleyball — size 5 (light)' : 'Volleyball', ['Size 5'], (n) => /MEKASA/.test(n) ? 'Mikasa V200W volleyball' : 'volleyball ball'],
  [/CHABKA VOLLEYBALL/, 'volleyball', 'nets', 'Volleyball net', ONE, 'volleyball net'],
  [/BALLON HANDBALL KEMPA|BALLON KEMPA SIZE 3/, 'volleyball', 'handballs', (n) => /SIZE 3/.test(n) ? 'Kempa handball — size 3' : 'Kempa handball', (n) => [/SIZE 3/.test(n) ? 'Size 3' : 'Size 2'], 'Kempa handball'],
  [/EQUIPEMENT PING PONG|FILER KIT PIKPONG/, 'racket', 'table-tennis', (n) => /FILER/.test(n) ? 'Table tennis net & post set' : 'Table tennis set — bats & balls', ONE, (n) => /FILER/.test(n) ? 'table tennis net post set' : 'table tennis set bats balls'],
  [/TABLE TENNIS (CARBON|NETHOLDER)|TENNIS TABLE|^RACKET$/, 'racket', 'table-tennis', (n) => tt(n), ONE],
  [/TABLE ALUMINIUM PM T320/, 'racket', 'table-tennis', 'Folding table — aluminium', ONE],
  [/PING PONG BALL/, 'racket', 'table-tennis', (n) => /BOTTLE/.test(n) ? 'Ping pong ball (single)' : 'Ping pong balls', ONE, 'ping pong balls'],
  [/TENNIS BALL (ODEA|BOSAITE)/, 'racket', 'tennis', (n, m) => `Tennis balls — ${m[1] === 'ODEA' ? 'Odea' : 'Bosaite'}`, ONE, 'tennis balls tube'],
  [/CABA WILSON\s+TOUR GREY/, 'racket', 'tennis', 'Wilson Tour tote bag — grey', ONE, 'Wilson tour tote bag grey'],
  [/CABA WILSON (\s*TOUR)( 22)?/, 'racket', 'tennis', 'Wilson Tour tote bag', ONE, 'Wilson tour tote bag'],
  [/CABA WILSON/, 'racket', 'tennis', 'Wilson tote bag', ONE, 'Wilson tote bag'],
  // ---------------- boxing
  [/BANDAGE VENUM|^PROTEGE (UFC )?\dM/, 'boxing', 'hand-wraps', (n) => wraps(n), ONE],
  [/GANTS? (BOX|BOXE|BOXING|DE BOXE)|GANT VENUM (BLACK|GM|PETITE)|GANT KIDS/, 'boxing', 'gloves', (n) => boxGloves(n), (n) => kid(n) || /PETITE|6OZ/.test(n) ? KID_OZ : GLOVES_OZ],
  [/GANTS? (VENUM )?MMA/, 'boxing', 'gloves', (n) => /VENUM/.test(n) ? `Venum MMA gloves${/9046/.test(n) ? ' 9046' : ''}` : 'MMA gloves', ['S', 'M', 'L'], 'venum mma gloves'],
  [/TRAINING GLOVE 3-1|DEMI GLOVES 2636|GLOVES SIMPLE/, 'boxing', 'gloves', (n) => /3-1/.test(n) ? 'Training gloves 3-in-1' : /DEMI/.test(n) ? 'Half-finger training gloves' : 'Bag gloves', ['S', 'M', 'L']],
  [/CASQUE (BOX|VENUM)/, 'boxing', 'head-protection', (n) => headgear(n), ['S', 'M', 'L']],
  [/PROTEGE DENTS?|MOUTH GUARD|PRE ANGLED MOUTHPIECE/, 'boxing', 'mouthguards', (n) => mouthguard(n), ONE, 'boxing mouthguard'],
  [/SAC (DE )?BOX/, 'boxing', 'punching-bags', (n) => bag(n), ONE],
  [/PAO VENUM|PATTE D'OURS|KICK COACH VENUM|BOX TRAINER/, 'boxing', 'pads', (n) => pads(n), ONE],
  [/PROTEGE TIBIA (BOX|COMPLET|KICK|VENUM)|PROTEGE VENUM|PROTEGE PIED|COQUILLE|PROTEGE POIGNET VENUM|PROTEGE TESSU|PROTEGE GENOU/, 'boxing', 'protection', (n) => protection(n), ['S', 'M', 'L']],
  [/SHORT (KICK BOXING|MMA|UFC|VENUM|FIGHT)|PANTALON KICK BOXING|PONTALON KICK BOXING|ENSEMBLE (VENUM|DE COMBAT)|BODY VENUM/, 'boxing', 'apparel', (n) => fightWear(n), (n) => kid(n) ? KIDS : ADULT],
  [/CORDE A SAUTER|JUMP ROPE|JUMPING ROPE|SKIPE? ROPE|^LA CORDE|^CORDA/, 'fitness', 'equipment', (n) => rope(n), ONE, 'jump rope'],
  [/REFLEX BALL/, 'boxing', 'pads', 'Boxing reflex ball (headband)', ONE, 'boxing reflex ball headband'],
  // ---------------- martial arts
  [/JUDO SUIT|KIMONO JUDO/, 'martial-arts', 'suits', (n) => judo(n), (n) => kid(n) ? KID_SUITS : SUITS],
  [/KARATE SUIT|KIMONO (KARATE|BLANC|GM|PM)/, 'martial-arts', 'suits', (n) => karate(n), (n) => kid(n) || /PM/.test(n) ? KID_SUITS : SUITS],
  [/KUNG FU SUIT|KIMONO KONG FU/, 'martial-arts', 'suits', (n) => /ENFANT/.test(n) ? 'Kung fu suit — kids' : /NOIR/.test(n) ? 'Kung fu suit — black' : 'Kung fu suit', (n) => kid(n) ? KID_SUITS : SUITS, 'kung fu uniform'],
  [/CEINTURE KARATE\s+(\w+)/, 'martial-arts', 'belts', (n, m) => m[1] === 'TOUTS' ? 'Karate belt — all colours' : `Karate belt — ${colour(m[1]).toLowerCase()}`, ['240 cm', '260 cm', '280 cm'], (n, m) => `karate belt ${colour(m[1]).toLowerCase()}`],
  [/GANTS? KARATE( ARAWAZA)?/, 'martial-arts', 'gloves', (n, m) => m[1] ? 'Arawaza karate mitts' : 'Karate mitts', ['S', 'M', 'L'], (n, m) => m[1] ? 'arawaza karate mitts' : 'karate mitts gloves'],
  [/NINTCHAKO|NINVHAKU/, 'martial-arts', 'nunchaku', (n) => nunchaku(n), ONE, 'nunchaku'],
  // ---------------- swimming
  [/LUNETTES? (PISCINE|NABAIJI|PETRA)|LUNETTE CONQUEST|C0NQUEST LUNETTE/i, 'swimming', 'goggles', (n) => goggles(n), ONE],
  [/BONN?ET|SWIM CAP|SILICONE CAP/, 'swimming', 'caps', (n) => cap(n), ONE, (n) => `swim cap ${brandWord(n)}`.trim()],
  [/BURKINI/, 'swimming', 'burkinis', (n) => burkini(n), (n) => kid(n) || /PM/.test(n) ? KIDS : ADULT],
  [/SHORT PISCINE|SHORT PLAGE/, 'swimming', 'swim-shorts', (n) => /ENF/.test(n) ? (/AUTRE/.test(n) ? 'Kids swim shorts — assorted' : 'Kids swim shorts') : /PLAGE/.test(n) ? 'Beach shorts' : /68 89/.test(n) ? 'Swim shorts — classic' : 'Swim shorts', (n) => kid(n) ? KIDS : ADULT, 'swim shorts'],
  [/CYCLISTE PICINE|FIZO PISCINE|PULL (HS )?PISCINE|PULL TRIBORD|DECATHLON TSHIRT DE PLAGE|TSHIRT DE PLAGE|PANTACOURT DE PLAGE|ROBE DE PLAGE|ENSEMBLE PISCINE ENFANT/, 'swimming', 'swimwear', (n) => swimwear(n), (n) => kid(n) || /ROBE|ENSEMBLE PISCINE ENFANT/.test(n) ? KIDS : ADULT],
  [/PALMES? (PISCINE )?CONQUEST|PALM CONQUEST|PALMES 39-44/, 'swimming', 'fins', (n) => /XXL/.test(n) ? 'Conquest swim fins — XXL' : /XXS/.test(n) ? 'Conquest swim fins — XXS' : /39-44/.test(n) ? 'Swim fins EU 39–44' : 'Conquest swim fins', (n) => /39-44/.test(n) ? range(39, 44) : ['XS', 'S', 'M', 'L', 'XL'], 'swimming training fins short blade'],
  [/PLANCHE DE PISCINE/, 'swimming', 'training', 'Swim kickboard', ONE, 'swimming kickboard'],
  [/PULL BUOY/, 'swimming', 'training', 'Pull buoy', ONE, 'swimming pull buoy'],
  [/SWIMMING PADLE/, 'swimming', 'training', 'Swim hand paddles', ['S', 'M', 'L'], 'swimming hand paddles'],
  [/PINCE NET PICINE/, 'swimming', 'training', 'Nose clip', ONE, 'swimming nose clip'],
  [/STOP BRUIT/, 'swimming', 'training', 'Swimming ear plugs', ONE, 'swimming ear plugs silicone'],
  [/DOLFINE F/, 'swimming', 'training', 'Monofin — dolphin', ONE, 'swimming monofin kids'],
  [/BRASARD DINO INTEX|Intex Inflatable (Deluxe )?Arm Bands|Intex Large Arm Bands|CHILDREN'S ARM RING|GILET( \+ BRASSARD ENFANT| 25| 35)|CEINTURE DE PISCINE|INTEX POOL SCHOOL|INTEX WET SET|Intex Kids 76cm/i, 'swimming', 'kids', (n) => swimKids(n), ONE],
  [/CENTEURE PLAGE/, 'swimming', 'kids', 'Beach float belt', ONE, 'swimming float belt'],
  [/ENSEMBLE CYCLISTE ADULT/, 'fitness', 'apparel', 'Cycling set — top & trousers', ADULT, 'cycling jersey trousers set'],
  [/SPORT ARMBAND POCHE WATER/, 'swimming', 'training', 'Waterproof phone pouch', ONE, 'waterproof phone pouch armband'],
  // ---------------- diving
  [/AQUA ?FLOW MASK|AQUA SUB MASK|DIVING MASK|MASK (BEUCHAT|PLONGE|SALVIMAR)|MASQUE (AVEC TUBE CONQUEST|PLAGE B7|TUBA AQUA SUB)|BEUCHAT ENSEMBLE MASK|TUBA \+ MASK/, 'diving', 'masks', (n) => mask(n), ONE],
  [/^TUBA( SALV)?|SNORKEL MOUTHPIECE/, 'diving', 'snorkels', (n) => /SALV/.test(n) ? 'Salvimar snorkel' : /MOUTHPIECE/.test(n) ? 'Snorkel' : 'Snorkel tube', ONE, (n) => /SALV/.test(n) ? 'Salvimar snorkel' : 'diving snorkel'],
  [/PALMES? (BEUCHAT|CRESSI|S$)|PALME (CRESSI|AQUA SUB)|AQUAFLOW PALMES|KIT PALME AQUA SUB|LES PALMES/, 'diving', 'fins', (n) => divingFins(n), ['EU 38–39', 'EU 40–41', 'EU 42–43', 'EU 44–45']],
  [/PAME ALU KAYAK/, 'pool', 'inflatables', 'Aluminium kayak paddle', ONE, 'aluminium kayak paddle'],
  // ---------------- pool & beach
  [/BESTWAY|Intex (Floating Pool Mat|182cm Airmat|JR\. Twin|Deluxe Baby Pool Float|70cm My Baby|Yellow Water Walker)|2x Intex Fashion Mat|INTEX CHALLENGER|INTEX PILLOW|HELLO KITTY SEAT RING|BEACH BALLS|^bou[i]e?/i, 'pool', 'inflatables', (n) => inflatable(n), ONE],
  [/Intex (12 Volt Quickfill|Quickfill USB150)|POMPE INTEX|POMPE (BUSTER|CC4|PRO|SHIMEI)|PMOMPE 8178/i, 'pool', 'pumps', (n) => pump(n), ONE],
  [/Intex (3 X Filter Cartridge|Easy Set Pool Cover|Frame Pool Cover|Ultra Frame Pool)|CARTOUCHE FILTRE|CLEAR POOL INTEX|KRYSTAL CLEAR|INTEX WET SET/i, 'pool', 'pool-care', (n) => poolCare(n), ONE],
  [/SAC PLAGE|SANDALE PLAGE|SNIKSA DE PLAGE|CHAISE TAXI SAC/, 'pool', 'beach', (n) => beach(n), (n) => /SANDALE/.test(n) ? range(36, 45) : ONE],
  // ---------------- fishing
  [/CANAPECHE (.+)/, 'fishing', 'rods', (n, m) => `Fishing rod — ${titleCase(m[1]).replace(/\s+/g, ' ')}`, ONE, (n, m) => `${m[1]} fishing rod`],
  [/MOLINI DE PECHE (.+)/, 'fishing', 'reels', (n, m) => `Fishing reel — ${titleCase(m[1].replace(/\.$/, ''))}`, ONE, (n, m) => `${m[1].replace(/\.$/, '')} spinning reel`],
  [/FIL DE PECHE (.+)/, 'fishing', 'line', (n, m) => `Fishing line ${m[1].replace(/\s+/g, ' ')}`, ONE, (n) => /SHIMANO/.test(n) ? 'Shimano fishing line 50m' : /X8/.test(n) ? 'braided fishing line X8' : 'fishing line spool'],
  [/^LEURR?E?S? /, 'fishing', 'lures', (n) => lure(n), ONE, (n) => /MARINE|CALAMARA/.test(n) ? 'squid jig lure' : 'herakles egi squid jig'],
  [/HAMESON (AKURA|SASAME) ?(N\d+)?/, 'fishing', 'hooks', (n, m) => `Fishing hooks — ${titleCase(m[1])}${m[2] ? ` no. ${+m[2].slice(1)}` : ''}`, ONE, (n, m) => `${m[1]} fishing hooks`],
  // ---------------- running
  [/CHAUSSURE (ASICS|HOKA)|ADIDAS ADIZERO|NIKE ZOOMX WHITE/, 'running', 'shoes', (n) => runShoe(n), range(40, 45)],
  [/PORTE TLF SPORT|SPORT WAIST PACK|WAIST BELT919/, 'running', 'accessories', (n) => /TLF/.test(n) ? 'Running phone armband' : 'Running waist pack', ONE, (n) => /TLF/.test(n) ? 'running phone armband' : 'running waist belt pack'],
  // ---------------- fitness
  [/HALTERE (\d)KG|CHROM DUMBELL SET|3LB\/PR SOFTWAY DUMBELL|VALISE (\d+)KG|BARRE EZ/, 'fitness', 'weights', (n) => weights(n), ONE],
  [/WRIST\/ ANKLE WEIGHT/, 'fitness', 'weights', (n) => /SOFTWAY/.test(n) ? 'Wrist / ankle weights — Softway' : /SOFT/.test(n) ? 'Wrist / ankle weights — soft' : 'Wrist / ankle weights', ONE, 'wrist ankle weights'],
  [/^TAPI/, 'fitness', 'mats', (n) => mat(n), ONE, (n) => /YOGA/.test(n) ? 'yoga mat' : 'fitness mat'],
  [/ELASTIQUE (DE SPORT|JAMBE|ROUGE|TPE)|RESISTANCE BANDS|RESISTACE ELASTIC RING|LOOP BANDS|BODY RESISTANCE BAND|PULL UP ASSIST BAND|^ELASTO$|JAMBE SILICONE|FITNESS RING/, 'fitness', 'bands', (n) => band(n), ONE],
  [/BARRE FIX|ABDOMINAL WHEEL|GYM BALL|GYMNASTIC \d\d|HULA HOOP|CERCEAU|^STEPS$|HAND GRIP|GRIPSTER|SPRING COUNTING GRIP|CHEST EXPANDER|FINGER TRAINER|HAND EXERCCISE BALLS|AB TRIMMER|WAISTTWISTING|GYM CABLE|BALLON YOGA|BODY SCULPTURE SHAKER|^ROLLER$|FITNESS WAIST STRAP|ADJUSTABLE GRIP/, 'fitness', 'equipment', (n) => equipment(n), ONE],
  [/GANTS? (MUSC?I?U?LATION|MUCLATION|GOLD GYM)|GANT MUSCILATION|NIKE MUSCILATION|LES GANTS (80|ADULT|CUIR|ENFANT)/, 'fitness', 'gloves-belts', (n) => gymGloves(n), ['S', 'M', 'L', 'XL']],
  [/CEINT[EU]?U?RE (DE CHARGE|GOLDS|JOEREX|VENUM|VIVA)|GANTS BUKA|CIENTURE MUSCULATION|BRASSERT MUSCULATION|^STRAPS|MAIN DACIER/, 'fitness', 'gloves-belts', (n) => belt(n), (n) => /CEINT|CIENT/.test(n) ? ['S', 'M', 'L', 'XL'] : ONE],
  [/SHAKER|GOURDE/, 'fitness', 'shakers', (n) => shaker(n), ONE],
  [/SAUNA|SLIM FIT|SLIMMING CLOTHES|SWEAT SHAPER|WAIST (CORSET|TRIMMER)|MEN SWEAT VEST|FIERT SPORTS SHAPERWEAR|^GAINE? (SPORT|4M)|SWEAT SUIT SPORTSWEAR/, 'fitness', 'slimming', (n) => slimming(n), ['S', 'M', 'L', 'XL']],
  [/SCALE|^MIZANE$|^PESE$/, 'fitness', 'scales', (n) => scale(n), ONE],
  [/BODY (NIKE|UA|FITNESS ROPA)|BODY NIKE\/UNDERARMOR|THE NORTH FACE BODY|Nike compression t-shirt|SIBOTE SHORT SLEEVE|YC BODY FITNESS DRESS|^COMPRESSION SLEEVE$|DEBARDEUR|GILET GYM|WEATBAND NIKE|WRISTBAND\/HEADBAND|ELASTIQUE CHEVEUX/i, 'fitness', 'apparel', (n) => fitWear(n), (n) => /WEATBAND|WRISTBAND|CHEVEUX/.test(n) ? ONE : ADULT],
  [/CYCLIST|SHORT\+(CYCLISTE|FIZO)|SHORT (FIZO|HS SIMPLE|JORDAN|NIKE|SPORT)|LEISURE WEAR|PONTALON SURVETTE|PULL (CYCLIST|DEMI MANCHE ENFANT|SPORT SPARTA)|PUL SPORT|FIZO (ENFANT|PRO COMBAT)/, 'fitness', 'apparel', (n) => fitWear(n), (n) => kid(n) || /6-10/.test(n) ? KIDS : ADULT],
  [/SPORT ?BAG|CABA (GM|SPORT|CUCI)|SACOCHE (PLPOWER|ZHUIFENGBAG)|SAC SOLIER/, 'fitness', 'bags', (n) => sportBag(n), ONE],
  [/TOWEL MICROFIBER/, 'fitness', 'bags', 'Microfibre sports towel', ONE, 'microfiber sports towel'],
  [/TRAINING MASK/, 'fitness', 'equipment', 'Altitude training mask', ONE, 'training mask altitude'],
  // ---------------- supports & recovery
  [/KNEE|ANKLE|ELBOW|WRIST SUPPORT|SPINE|BACK SUPPORT|POSTURE|POWERKNEE|^PROTEGE POIGNET$|MEDICAL BREATHABLE|COMPRESSION SLEEVE/, 'recovery', 'supports', (n) => support(n), ['S', 'M', 'L', 'XL']],
  [/MASSAG|SHIATSU|GOGO|SCALP|FAR INFRARED/, 'recovery', 'massage', (n) => massage(n), ONE],
  [/KINESIOLOGE TAPE|SPORT INSOLE|SILICONE HEALTHY HEEL|YC COMFORT HEEL|FOOTCARE|YC SUPPORT FOOTBALL VEST/, 'recovery', 'care', (n) => care(n), ONE],
  // ---------------- outdoor / cycling / moto
  [/GANT MOTO|LES GANTS (MOTO|MONSTER ENERGY)|PROTEGE VILO|CAGOULE/, 'outdoor', 'cycling', (n) => moto(n), (n) => /CAGOULE/.test(n) ? ONE : ['S', 'M', 'L', 'XL']],
];

/* ------------------------------ name helpers ---------------------------- */
function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Lt|Srt|Xf|Fiba|Ufc|Mma)\b/gi, (w) => w.toUpperCase());
}
const COLOURS = { BLANC: 'White', NOIR: 'Black', BLEU: 'Blue', BLUE: 'Blue', ROUGE: 'Red', VERT: 'Green', JAUNE: 'Yellow', ORANGE: 'Orange', MARON: 'Brown', GREEN: 'Green', YELLOW: 'Yellow', MAUVE: 'Purple', ROSE: 'Pink', GRIS: 'Grey', BVB: 'Black / yellow' };
function colour(s) {
  return s.split(/[\s/]+/).filter(Boolean).map((w) => COLOURS[w] ?? titleCase(w)).join(' / ');
}
function brandWord(n) {
  const b = brandOf(n);
  return b === 'other' ? '' : b;
}
function boot(n) {
  const terrain = /TOUT?S? TE?RR?AIN|\bTT\b|\bTR\b/.test(n) ? 'turf' : /\bCR\b|CRA[MN]PO|FG/.test(n) ? 'firm ground' : '';
  const map = [
    [/ADIDAS PREDATOR/, 'adidas Predator'], [/ADIDAS COPA/, 'adidas Copa'], [/ADIDAS CRAZY FAST/, 'adidas X Crazyfast'], [/ADIDAS DEPORTIVO/, 'adidas Deportivo'],
    [/ADIDAS BLUE ROSE/, 'adidas football boots — blue / pink'], [/NIKE GRIPKNIT/, 'Nike Phantom Gripknit'], [/NIKE PHANTOM/, 'Nike Phantom'], [/NIKE SPEEDPORTAL/, 'Nike Speedportal'],
    [/NIKE AIRZOOM MERCURIAL BLACK/, 'Nike Air Zoom Mercurial — black'], [/NIKE AIRZOOM MERCURIAL YELLOW/, 'Nike Air Zoom Mercurial — yellow'], [/NIKE AIR ZOOM PRO/, 'Nike Air Zoom Pro'],
    [/AIRZOOM BLUE\/GREEN/, 'Air Zoom — blue / green'], [/NIKE INSANE/, 'Nike Insane'], [/NIKE \/MBAPPE/, 'Nike Mbappé'], [/NIKE ORANGE BLUE/, 'Nike — orange / blue'], [/NIKE TOUT TERAIN NOIR/, 'Nike — black'],
    [/NIKE TOUT TERRAIN/, 'Nike'], [/NIKE\/ADIDAS/, 'Nike / adidas'], [/PUMA BLEU/, 'PUMA — blue'], [/PUMA NOIR ORANGE/, 'PUMA — black / orange'], [/CR7 CRANPOS NIKE AIR/, 'CR7 Nike Air'],
    [/CR7/, 'CR7'], [/RMZ WHITE/, 'RMZ — white'], [/RMZ/, 'RMZ'], [/TIKA WHITE/, 'Tika — white'], [/TIKA/, 'Tika'], [/AIKESA CADIE/, 'Aikesa Cadie'], [/AIKESA/, 'Aikesa'], [/CUIPSSI NOIR MONTANT/, 'Cuippssi high-top — black'],
    [/CUIPSSI NOIR ROSE/, 'Cuippssi — black / pink'], [/DIFENO/, 'Difeno'], [/DURGANA|DUGANA/, 'Durgana'], [/JOMA/, 'Joma'], [/PATRICK/, 'Patrick'], [/ULTRA FASTER/, 'Ultra Faster'], [/W50/, 'W50'],
    [/F50\+/, 'adidas F50+'], [/LAMINE YAMAL/, 'adidas F50 — Lamine Yamal'], [/MONDIAL/, 'Mondial'], [/SPORT 470/, 'Sport 470'], [/TOUT TERRAIN NOIR/, 'black'],
  ];
  const model = map.find(([re]) => re.test(n))?.[1];
  let base;
  if (!model) base = 'Football boots';
  else if (/football boots/.test(model)) base = model;
  else if (model.includes(' — ')) base = `${model.split(' — ')[0]} football boots — ${model.split(' — ')[1]}`;
  else if (model === 'black') base = 'Football boots — black';
  else base = `${model} football boots`;
  if (/^Nike football boots/.test(base) && /NIKE TOUT TERRAIN$/.test(n)) base = 'Nike football boots';
  return terrain ? `${base}${base.includes(' — ') ? ', ' : ' — '}${terrain}` : base;
}
function kidsBoot(n) {
  const b = /NIKE/.test(n) ? 'Nike kids football boots' : /CR7/.test(n) ? 'CR7 kids football boots' : /DUGANA/.test(n) ? 'Durgana kids football boots' : 'Kids football boots';
  return /TOUT|TERAIN/.test(n) ? `${b} — turf` : /CRAMPONS/.test(n) ? `${b} — firm ground` : /NV/.test(n) ? `${b} — new` : b;
}
function gkGloves(n) {
  if (/UHLSPORT/.test(n)) return kid(n) ? 'Uhlsport goalkeeper gloves — kids' : 'Uhlsport goalkeeper gloves';
  if (/TOPHIGH/.test(n)) return 'Tophigh goalkeeper gloves';
  if (/360/.test(n)) return 'Goalkeeper gloves 360';
  if (/195/.test(n)) return 'Goalkeeper gloves 195';
  if (/PRO/.test(n)) return 'Goalkeeper gloves Pro';
  if (/DZ/.test(n)) return 'Goalkeeper gloves — Algeria, kids';
  if (/RG GM/.test(n)) return 'Goalkeeper gloves — large';
  if (/RG/.test(n)) return 'Goalkeeper gloves — training';
  if (/HQ/.test(n)) return 'Goalkeeper gloves — high quality';
  return kid(n) ? 'Goalkeeper gloves — kids' : 'Goalkeeper gloves';
}
function footSocks(n) {
  const c = n.match(/LES BAS (.+?)( ADULT| ENFANT)?$/)?.[1] ?? '';
  if (/HIGH QUALITY/.test(c)) return 'Kids football socks — high quality';
  if (/CUIPPSSI/.test(c)) return 'Football socks — Cuippssi';
  return `Football socks — ${colour(c).toLowerCase()}${/ENFANT/.test(n) ? ' (kids)' : ''}`;
}
function footBall(w) {
  const m = {
    ADIDAS: 'adidas football', PUMA: 'PUMA football', UMBRO: 'Umbro football', LOTTO: 'Lotto football', SELECT: 'Select football', DERBYSTAR: 'Derbystar football', DERBY: 'Derby football',
    MLS: 'MLS replica ball', PL: 'Premier League replica ball', STAR: 'Star football', SUPER: 'Super football', 'PRO NV': 'Pro football — new', 'PRO+': 'Pro+ football', MIKSSA: 'Mikasa football',
    'VEGASTAR/JOMA/DERBYSTAR': 'Football — Vegastar / Joma / Derbystar', VEGASTAR: 'Vegastar football', '+': 'Football — grade +', '++': 'Football — grade ++', '+++': 'Football — grade +++',
  };
  return m[w] ?? `${titleCase(w)} football`;
}
function stopwatch(n) {
  if (/PROFESSIONAL/.test(n)) return 'Professional stopwatch';
  if (/FLOTT/.test(n)) return 'Stopwatch — Flott';
  if (/KISLO/.test(n)) return 'Stopwatch — Kislo';
  const mm = n.match(/(\d+)M/);
  return mm ? `Measuring tape ${mm[1]} m` : 'Stopwatch';
}
function kitSet(n) {
  if (/NIKE 5P/.test(n)) return 'Nike training set — 5 pieces';
  const p = n.match(/(\d)PC/)?.[1];
  return `Training set — ${p} pieces${/ENF/.test(n) ? ' (kids)' : ''}`;
}
function tracksuit(n) {
  if (/^VESTE KAWI/.test(n)) return 'Kawi jacket';
  if (/VEST BRESIL/.test(n)) return 'Brazil track jacket';
  if (/VEST KAWI PSG/.test(n)) return 'PSG Kawi jacket';
  if (/SURVETTE ON NIKE/.test(n)) return 'Nike tracksuit';
  const s = n.replace(/SURVET+EMENT|SURVETTE?MENT/, '').trim();
  const kids = /ENFANT/.test(s);
  const vest = /\bVEST\b/.test(s);
  const half = /DEMI ZIPER/.test(s);
  const halfSleeve = /DEMI MANCHE/.test(s);
  const team = [
    [/ALGERIE BLANC ANNIVERSAIRE/, 'Algeria anniversary — white'], [/ALGERIE NOIR ANNIVERSAIRE/, 'Algeria anniversary — black'], [/KAWI ALGERIE VERT/, 'Algeria Kawi — green'], [/KAWI ALGERIE NOIR/, 'Algeria Kawi — black'],
    [/ALGERIE NOIR/, 'Algeria — black'], [/ALGERIE VERT\/GRIS/, 'Algeria — green / grey'], [/ALGERIE/, 'Algeria'],
    [/KAWI ALLEMAGNE BLANC/, 'Germany Kawi — white'], [/KAWI ALLEMAGNE NOIR/, 'Germany Kawi — black'], [/ALLEMAGNE MAUVE/, 'Germany — purple'], [/ALLEMAGNE/, 'Germany'],
    [/ESPAGNE 2025/, 'Spain 2025'], [/ESPAGNE/, 'Spain'], [/REAL MADRID BLEU\/ORANGE/, 'Real Madrid — blue / orange'], [/REAL MADRID ROSE/, 'Real Madrid — pink'],
    [/KAWI REAL MADRID BLANC\/BLEU/, 'Real Madrid Kawi — white / blue'], [/KAWI REAL MADRID BLANC\/GRIS/, 'Real Madrid Kawi — white / grey'], [/KAWI REAL MADRID BLEU/, 'Real Madrid Kawi — blue'],
    [/KAWI AJAX/, 'Ajax Kawi'], [/KAWI ITALY/, 'Italy Kawi'], [/ANGLETERRE/, 'England'], [/MARSEILLE/, 'Marseille'], [/PUMA/, 'PUMA'], [/UNDER ARMOUR/, 'Under Armour'],
    [/NIKE ANCIEN/, 'Nike — classic'], [/TN 93/, 'TN 93'], [/DZ MOTIF MATCH BLANC/, 'Algeria match pattern — white'], [/DZ MOTIF MATCH NOIR/, 'Algeria match pattern — black'],
    [/DZ MOTIF MATCH ROSE/, 'Algeria match pattern — pink'], [/DZ MOTIF MATCH/, 'Algeria match pattern'], [/DZ (ENFANT )?ANCIEN BEZAF/, 'Algeria — previous season'],
    [/DIVER 2024/, '2024 — assorted'], [/ZIPER 2024/, '2024'], [/ANCIE\/DIVER|ANCIEN\/DIVER|ANCIENT\/DIVER/, 'Previous seasons — assorted'], [/HIGH QUALITY/, 'High quality'],
  ].find(([re]) => re.test(s))?.[1];
  const kind = vest ? 'jacket tracksuit' : half ? 'half-zip tracksuit' : halfSleeve ? 'short-sleeve tracksuit' : 'tracksuit';
  let t;
  if (!team) t = kind;
  else {
    const [who, detail] = team.split(' — ');
    t = `${who} ${kind}${detail ? ' — ' + detail : ''}`;
  }
  // the duplicate-name tie breakers in the source (prices differ)
  if (/VEST ANCIENT\/DIVER/.test(n)) t += ' (basic)';
  if (/KAWI REAL MADRID BLEU/.test(n) && rowsSeen.has(t)) t += ' (2)';
  rowsSeen.add(t);
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}${kids ? ' (kids)' : ''}${/VEST$/.test(n) && /ANNIVERSAIRE/.test(n) ? ' + jacket' : ''}`;
}
const rowsSeen = new Set();
function wraps(n) {
  if (/UFC/.test(n)) return 'UFC hand wraps 3 m';
  const m = n.match(/(\d) ?M/)?.[1];
  return /VENUM/.test(n) ? `Venum hand wraps ${m} m` : `Hand wraps ${m} m`;
}
function boxGloves(n) {
  if (/FAIRTEX/.test(n)) return 'Fairtex boxing gloves';
  if (/ADDIDAS/.test(n)) return 'adidas boxing gloves';
  if (/BUKA/.test(n)) return 'Buka boxing gloves';
  if (/GANT KIDS/.test(n)) return 'Kids boxing gloves';
  const oz = n.match(/BOX (\d\d)$/)?.[1];
  if (oz) return `Boxing gloves — model ${oz}`;
  if (/6OZ/.test(n)) return 'Boxing gloves 4–6 oz (kids)';
  if (/BLACK\/BLACK-GOLD/.test(n)) return 'Venum boxing gloves — black / gold';
  if (/PETITE/.test(n)) return 'Venum boxing gloves — small sizes';
  if (/ENFANT/.test(n)) return 'Venum boxing gloves — kids';
  if (/ADULT/.test(n)) return 'Venum boxing gloves — adult';
  if (/S1/.test(n)) return 'Venum boxing gloves S1';
  if (/GM/.test(n)) return 'Venum boxing gloves — large';
  if (/GANTS BOXING VENUM/.test(n)) return 'Venum boxing gloves — training';
  return 'Venum boxing gloves';
}
function headgear(n) {
  if (/OUVERT/.test(n)) return 'Venum open-face headgear';
  if (/FERME/.test(n)) return 'Venum full-face headgear';
  if (/PAKIS/.test(n)) return 'Boxing headgear — Pakistan leather';
  if (/CHINA/.test(n)) return 'Boxing headgear';
  return 'Venum headgear';
}
function mouthguard(n) {
  if (/PRE ANGLED/.test(n)) return 'Pre-angled mouthguard';
  if (/EVERLEST/.test(n)) return 'Everlast mouthguard';
  if (/DOUBLER/.test(n)) return 'Double mouthguard';
  if (/LUX/.test(n)) return 'Mouthguard — premium';
  if (/DENTS VENUM/.test(n)) return 'Venum mouthguard with case';
  if (/VENUM/.test(n)) return 'Venum mouthguard';
  if (/A\+/.test(n)) return 'Mouthguard A+';
  return 'Mouthguard';
}
function bag(n) {
  const size = n.match(/(\d(?:\.\d)?) ?m\b|(\d+) ?cm|VENUM (1\.1)/i);
  const s = size ? (size[2] ? `${size[2]} cm` : `${size[1] ?? size[3]} m`) : '';
  const b = /ADIDAS/.test(n) ? 'adidas punching bag' : /UFC/.test(n) ? 'UFC punching bag' : /VENUM/.test(n) ? 'Venum punching bag' : /OEUF/.test(n) ? 'Teardrop punching bag' : 'Punching bag';
  return s ? `${b} ${s}` : b;
}
function pads(n) {
  if (/PAO VENUM ROND/.test(n)) return 'Venum round kick pad';
  if (/PAO VENUM/.test(n)) return 'Venum Thai pads';
  if (/PATTE/.test(n)) return 'Focus mitts';
  if (/KICK COACH/.test(n)) return 'Venum kick shield';
  return 'Boxing trainer — spinning bar';
}
function protection(n) {
  if (/COMPLET KICK TOKAIDO/.test(n)) return 'Tokaido shin & instep guards';
  if (/COMPLET KICK/.test(n)) return 'Kickboxing shin & instep guards';
  if (/TIBIA KICK/.test(n)) return 'Kickboxing shin guards';
  if (/TIBIA BOX/.test(n)) return 'Boxing shin guards';
  if (/TIBIA VENUM/.test(n)) return 'Venum shin guards';
  if (/PROTEGE VENUM/.test(n)) return 'Venum shin guards — pro';
  if (/PIED/.test(n)) return 'Foot protector';
  if (/COQUILLE/.test(n)) return 'Groin guard — Viva';
  if (/POIGNET VENUM/.test(n)) return n.includes('800') ? 'Venum wrist guard — pro' : 'Venum wrist guard';
  if (/TESSU/.test(n)) return 'Fabric protector';
  if (/GENOU/.test(n)) return 'Knee pad';
  if (/CENTEURE PLAGE/.test(n)) return 'Beach belt';
  return 'Body protector';
}
function fightWear(n) {
  if (/SHORT KICK BOXING DZ VENUM/.test(n)) return 'Venum kickboxing shorts — Algeria';
  if (/SHORT KICK BOXING/.test(n)) return 'Kickboxing shorts';
  if (/SHORT MMA/.test(n)) return 'MMA shorts';
  if (/SHORT UFC/.test(n)) return 'UFC fight shorts';
  if (/SHORT VENUM/.test(n)) return 'Venum fight shorts';
  if (/SHORT FIGHT/.test(n)) return 'Fight shorts — black & white';
  if (/PANTALON KICK BOXING VENUM/.test(n)) return 'Venum kickboxing trousers';
  if (/KICK BOXING/.test(n)) return 'Kickboxing trousers';
  if (/ENSEMBLE VENUM ENF/.test(n)) return 'Venum fight set — kids';
  if (/ENSEMBLE VENUM PRO/.test(n)) return 'Venum fight set Pro';
  if (/ENSEMBLE DE COMBAT/.test(n)) return 'Combat set — rash guard & shorts';
  if (/BODY VENUM/.test(n)) return 'Venum hoodie';
  return 'Fight wear';
}
function rope(n) {
  if (/1X100 COMBA/.test(n)) return 'Jump rope — Comba 100';
  if (/1X50/.test(n)) return 'Jump rope — Comba 50';
  if (/1X100/.test(n)) return 'Jump rope 100';
  if (/3M/.test(n)) return 'Jump rope 3 m';
  if (/63\d/.test(n)) return `Jump rope ${n.match(/63\d/)[0]}`;
  if (/CIMA/.test(n)) return 'Jump rope — Cima';
  if (/SUPER SUB/.test(n)) return 'Jump rope — Super Sub';
  if (/^CORDA$/.test(n)) return 'Jump rope — basic';
  if (/LA CORDE/.test(n)) return 'Speed rope';
  if (/SKIP/.test(n)) return 'Skipping rope';
  if (/CORDE A SAUTER/.test(n)) return 'Jump rope — classic';
  return 'Jump rope';
}
function judo(n) {
  if (/MATSURU/.test(n)) return 'Matsuru professional judo suit';
  if (/HIGH QUALITY BLEU \/NOIR/.test(n)) return 'Judo suit — blue / black, high quality';
  const hq = n.match(/HIGH QUALITY (\w+)/);
  if (hq) return `Judo suit — ${colour(hq[1]).toLowerCase()}, high quality`;
  if (/SPALL/.test(n)) return 'Judo suit — training';
  return `Judo suit — ${colour(n.match(/SUIT (\w+)/)[1]).toLowerCase()}`;
}
function karate(n) {
  if (/MATSURU ADULT HIGH QUALITY/.test(n)) return 'Matsuru karate suit — high quality';
  if (/MATSURU ADULT/.test(n)) return 'Matsuru karate suit';
  if (/MATSURU ENFANT/.test(n)) return 'Matsuru karate suit — kids';
  if (/ENFANT HIGH QUALITY/.test(n)) return 'Karate suit — kids, high quality';
  if (/DZ/.test(n)) return 'Karate suit — Algeria';
  if (/IMPO/.test(n)) return 'Karate suit — imported';
  if (/SPALL/.test(n)) return 'Karate suit — training';
  if (/BLANC/.test(n)) return 'Karate suit — white';
  if (/GM/.test(n)) return 'Karate suit — large';
  if (/PM/.test(n)) return 'Karate suit — small';
  return 'Karate suit';
}
function nunchaku(n) {
  if (/BOITE/.test(n)) return 'Nunchaku in box';
  if (/ENFANT/.test(n)) return 'Kids foam nunchaku';
  if (/PONG/.test(n)) return 'Nunchaku — foam';
  if (/AMATEUR/.test(n)) return 'Nunchaku — beginner';
  return 'Nunchaku';
}
function goggles(n) {
  const m = [
    [/NABAIJI POCHETTE/, 'Nabaiji swim goggles with case'], [/NABAIJI NOIR/, 'Nabaiji swim goggles — black'], [/NABAIJI/, 'Nabaiji swim goggles'], [/CIMA/, 'Cima swim goggles'],
    [/CONQUEST COMPETITION/, 'Conquest competition goggles'], [/C0NQUEST LUNETTE PRO/, 'Conquest Pro goggles'], [/CONQUEST/, 'Conquest swim goggles'], [/F2005/, 'Swim goggles F2005'],
    [/JIEJIA/, 'Jiejia swim goggles'], [/PETRA 2/, 'Petra 2 swim goggles'], [/PETRA/, 'Petra swim goggles'], [/AQUA FLOW/, 'Aquaflow swim goggles'], [/MINISO/, 'Miniso swim goggles'], [/SAILTO/, 'Sailto swim goggles'],
  ].find(([re]) => re.test(n))?.[1];
  return m ?? 'Swim goggles';
}
function cap(n) {
  if (/ARENA/.test(n)) return 'arena swim cap';
  if (/CONQUEST 100/.test(n)) return 'Conquest swim cap 100';
  if (/CONQUESTT SIL/.test(n)) return 'Conquest silicone swim cap';
  if (/CONQUEST/.test(n)) return 'Conquest swim cap';
  if (/NABAIJI/.test(n)) return 'Nabaiji swim cap';
  if (/SPEEDLIFE/.test(n)) return 'Speedlife swim cap';
  if (/PU$/.test(n)) return 'PU-coated swim cap';
  if (/SILICONE/.test(n)) return 'Silicone swim cap';
  if (/NATTATION/.test(n)) return 'Swim cap — classic';
  const d = n.match(/\d+/);
  return d ? `Swim cap ${d[0]}` : 'Swim cap';
}
function burkini(n) {
  if (/CHALE/.test(n)) return 'Burkini shawl — kids';
  if (/1 PIECE \+ DRA AYA/.test(n)) return 'Burkini one-piece — Aya, long sleeves';
  if (/ALIYA/.test(n)) return 'Burkini — Aliya';
  if (/CROISE M10/.test(n)) return 'Burkini wrap M10 with skirt';
  if (/DEMI MANCHES SHIRAZ/.test(n)) return 'Burkini half sleeves — Shiraz';
  if (/DEMI PISCINE/.test(n)) return 'Burkini pool — half sleeves';
  if (/ENFANT/.test(n)) return 'Kids burkini — half sleeves';
  if (/JILBAB/.test(n)) return 'Burkini jilbab';
  if (/M10 \+ PAREO/.test(n)) return 'Burkini M10 with pareo';
  if (/MANCHES LONGUES SHIRAZ/.test(n)) return 'Burkini long sleeves — Shiraz';
  if (/SIMPLE/.test(n)) return 'Burkini — classic';
  return 'Burkini';
}
function swimwear(n) {
  if (/CYCLISTE PICINE 0027-1/.test(n)) return 'Swim leggings 0027-1';
  if (/CYCLISTE PICINE/.test(n)) return 'Swim leggings';
  if (/FIZO PISCINE/.test(n)) return 'Swim shorts — fitted';
  if (/PULL HS PISCINE/.test(n)) return 'Swim top — half sleeves';
  if (/PULL PISCINE MANCHE LONG/.test(n)) return 'Swim top — long sleeves';
  if (/PULL TRIBORD/.test(n)) return 'Tribord UV beach top';
  if (/DECATHLON TSHIRT DE PLAGE/.test(n)) return 'Olaian UV beach T-shirt';
  if (/TSHIRT DE PLAGE/.test(n)) return 'UV beach T-shirt — Komprexx';
  if (/PANTACOURT/.test(n)) return 'Beach capri pants — black';
  if (/ROBE DE PLAGE/.test(n)) return 'Girls beach dress';
  if (/ENSEMBLE PISCINE ENFANT/.test(n)) return 'Kids swim set';
  return 'Swimwear';
}
function swimKids(n) {
  if (/BRASARD DINO/.test(n)) return 'Intex dinosaur arm bands';
  if (/Deluxe Arm Bands/i.test(n)) return 'Intex Deluxe arm bands';
  if (/Arm Bands Double Air/i.test(n)) return 'Intex arm bands — bright orange';
  if (/Large Arm Bands/i.test(n)) return 'Intex large arm bands 6–12 years';
  if (/WET SET/.test(n)) return 'Intex Wet Set arm rings';
  if (/ARM RING\s+BOUEE/.test(n)) return 'Kids swim ring';
  if (/ARM RING/.test(n)) return 'Kids arm rings';
  if (/GILET \+ BRASSARD/.test(n)) return 'Kids swim vest with arm bands';
  if (/GILET (\d+)/.test(n)) return `Kids swim vest ${n.match(/\d+/)[0]}`;
  if (/CEINTURE DE PISCINE/.test(n)) return 'Swim belt — float';
  if (/POOL SCHOOL/.test(n)) return 'Intex Pool School vest';
  if (/76cm/i.test(n)) return 'Intex transparent swim ring 76 cm';
  return 'Kids swim aid';
}
function mask(n) {
  if (/AQUA ?FLOW/.test(n)) return 'Aquaflow diving mask';
  if (/AQUA SUB MASK/.test(n)) return 'Aqua Sub diving mask';
  if (/MASQUE TUBA AQUA SUB/.test(n)) return 'Aqua Sub mask & snorkel';
  if (/BEUCHAT ENSEMBLE/.test(n)) return 'Beuchat mask & snorkel set';
  if (/MASK BEUCHAT/.test(n)) return 'Beuchat diving mask';
  if (/SALVIMAR/.test(n)) return 'Salvimar diving mask';
  if (/CONQUEST/.test(n)) return 'Conquest mask & snorkel';
  if (/B7/.test(n)) return 'Full-face snorkel mask B7';
  if (/TUBA \+ MASK/.test(n)) return 'Mask & snorkel set';
  return 'Diving mask';
}
function divingFins(n) {
  if (/AQUAFLOW/.test(n)) return 'Aquaflow fins + goggles set';
  if (/KIT PALME AQUA SUB/.test(n)) return 'Aqua Sub fins kit';
  if (/AQUA SUB 50/.test(n)) return 'Aqua Sub fins 50';
  if (/BEUCHAT PRO/.test(n)) return 'Beuchat Pro freediving fins';
  if (/BEUCHAT/.test(n)) return 'Beuchat diving fins';
  if (/CRESSI \+ MASK/.test(n)) return 'Cressi fins & mask set';
  if (/CRESSI AVEC CASQUE/.test(n)) return 'Cressi fins with bag';
  if (/CRESSI BLACK/.test(n)) return 'Cressi diving fins — black';
  if (/CRESSI 182041/.test(n)) return 'Cressi Pluma fins';
  if (/CRESSI/.test(n)) return 'Cressi diving fins';
  return 'Diving fins';
}
function inflatable(n) {
  const m = [
    [/Days Family Pool/i, 'Bestway family pool'], [/Character Kiddie/i, 'Bestway character kiddie pool'], [/213x155/i, 'Bestway kids pool with canopy 213 cm'], [/Sprinkler/i, 'Bestway sprinkler paddling pool'],
    [/Rainbow Slide/i, 'Bestway rainbow slide pool'], [/Window Paddling/i, 'Bestway window paddling pool'], [/Floating Pool Mat/i, 'Intex floating pool mat'], [/182cm Airmat/i, 'Intex Economat air mat 182 cm'],
    [/JR\. Twin/i, 'Intex Jr. Twin Classic Downy airbed'], [/Deluxe Baby Pool Float/i, 'Intex Deluxe baby float 1–2 years'], [/70cm My Baby/i, 'Intex My Baby float 6–12 months'], [/Water Walker/i, 'Intex baby water walker with canopy'],
    [/Fashion Mat/i, 'Intex Fashion Mat pool float (2 pack)'], [/CHALLENGER 3/i, 'Intex Challenger 3 kayak'], [/CHALLENGER K1/i, 'Intex Challenger K1 kayak'], [/INTEX PILLOW/i, 'Intex inflatable pillow'],
    [/HELLO KITTY/i, 'Hello Kitty seat ring'], [/BEACH BALLS/i, 'Beach ball'], [/casquett/i, 'Swim ring — assorted'], [/noir 120cm/i, 'Swim ring black 120 cm'], [/noir 90/i, 'Swim ring black 90 cm'], [/90cm color/i, 'Swim ring colourful 90 cm'],
  ].find(([re]) => re.test(n))?.[1];
  if (m) return m;
  const code = n.match(/[\d][\d-/]*$/)?.[0];
  return `Swim ring ${code ?? ''}`.trim();
}
function pump(n) {
  if (/12 Volt/i.test(n)) return 'Intex 12 V Quickfill electric pump';
  if (/USB150/i.test(n)) return 'Intex Quickfill USB mini pump';
  if (/POMPE INTEX III S/.test(n)) return 'Intex Double Quick III S hand pump';
  if (/POMPE INTEX III/.test(n)) return 'Intex Double Quick III hand pump';
  if (/POMPE INTEX I/.test(n)) return 'Intex Double Quick I hand pump';
  if (/BUSTER\s+JDX/.test(n)) return 'Buster electric pump JDX809C';
  if (/BUSTER/.test(n)) return 'Buster pump';
  if (/SHIMEI SM-8138/.test(n)) return 'Shimei pump SM-8138';
  if (/SHIMEI/.test(n)) return 'Shimei ball pump';
  if (/CC4/.test(n)) return 'Ball pump CC4';
  if (/PRO/.test(n)) return 'Ball pump Pro';
  return 'Ball pump';
}
function poolCare(n) {
  if (/3 X Filter/i.test(n)) return 'Intex filter cartridge A — 3 pack';
  if (/CARTOUCHE/.test(n)) return 'Intex filter cartridge H';
  if (/Easy Set Pool Cover/i.test(n)) return 'Intex Easy Set pool cover 244 cm';
  if (/Frame Pool Cover 366/i.test(n)) return 'Intex frame pool cover 366 cm';
  if (/Frame Pool Cover 457/i.test(n)) return 'Intex frame pool cover 457 cm';
  if (/Ultra Frame/i.test(n)) return 'Intex Ultra Frame pool part';
  if (/CLEAR POOL INTEX MINI/.test(n)) return 'Intex pool chlorine — mini';
  if (/CLEAR POOL/.test(n)) return 'Intex pool chlorine';
  if (/KRYSTAL/.test(n)) return 'Krystal Clear pool basics';
  if (/WET SET COLLECTION 100/.test(n)) return 'Intex Wet Set ring 100';
  if (/WET SET COLLECTION 50/.test(n)) return 'Intex Wet Set ring 50';
  if (/WET SET/.test(n)) return 'Intex Wet Set';
  return 'Pool care';
}
function beach(n) {
  if (/SAC PLAGE/.test(n)) return 'Beach bag';
  if (/TISU/.test(n)) return 'Beach sandals — fabric';
  if (/SANDALE/.test(n)) return 'Beach sandals';
  if (/SNIKSA/.test(n)) return 'Beach water shoes';
  if (/CHAISE/.test(n)) return 'Folding beach chair with bag';
  return 'Beach';
}
function lure(n) {
  const k = n.match(/(\d\d)-MARINE(\s+CALAMARA)?/);
  if (k) return `Marine lure ${k[1]}${k[2] ? ' — squid' : ''}`;
  const h = n.match(/(\d(?:[.,]\d)?)\/(\d[.,]\d)/);
  return h ? `Herakles squid jig ${h[1]} / ${h[2]}` : 'Fishing lure';
}
function runShoe(n) {
  if (/ASICS/.test(n)) return 'ASICS running shoes';
  if (/HOKA/.test(n)) return 'HOKA running shoes';
  if (/BANDE ROUGE/.test(n)) return 'adidas Adizero — red stripes';
  if (/ADIZERO/.test(n)) return 'adidas Adizero running shoes';
  return 'Nike ZoomX running shoes — white';
}
function weights(n) {
  const kg = n.match(/(\d+)KG/)?.[1];
  if (/VALISE/.test(n)) return `Dumbbell set in case — ${kg} kg`;
  if (/CHROM/.test(n)) return 'Chrome dumbbell set';
  if (/3LB/.test(n)) return 'Softway dumbbells 3 lb (pair)';
  if (/BARRE EZ/.test(n)) return 'EZ curl bar';
  return `Dumbbell ${kg} kg`;
}
function mat(n) {
  if (/9MM/.test(n)) return 'Gym mat 9 mm';
  const mm = n.match(/(\d)M\b/);
  if (mm) return `Exercise mat ${mm[1]} mm`;
  if (/IMPORTATION GM/.test(n)) return 'Exercise mat — large, imported';
  if (/IMPORTATION/.test(n)) return 'Exercise mat — imported';
  if (/LOCAL/.test(n)) return 'Exercise mat — local';
  if (/YOGA/.test(n)) return 'Yoga mat';
  return 'Sports mat';
}
function band(n) {
  if (/TPE 3PC/.test(n)) return 'Resistance bands — 3 pack TPE';
  const m = n.match(/ELASTIQUE DE SPORT (\w+)( FLOTT)?/);
  if (m) return `Resistance band — ${colour(m[1]).toLowerCase()}${m[2] ? ' (Flott)' : ''}`;
  if (/ELASTIQUE DE SPORT/.test(n)) return 'Resistance band';
  if (/ELASTIQUE JAMBE/.test(n)) return 'Leg resistance band';
  if (/ELASTIQUE ROUGE/.test(n)) return 'Resistance band — red, light';
  if (/RESISTACE ELASTIC RING MD-03/.test(n)) return 'Resistance loop MD-03';
  if (/RESISTACE ELASTIC RING/.test(n)) return 'Resistance loop';
  if (/LOOP BANDS/.test(n)) return 'Loop bands set';
  if (/BODY RESISTANCE/.test(n)) return 'Body resistance band';
  if (/PULL UP ASSIST/.test(n)) return 'Pull-up assist band';
  if (/ELASTO/.test(n)) return 'Elastic training band';
  if (/JAMBE SILICONE KIT/.test(n)) return 'Thera-Band leg kit';
  if (/JAMBE SILICONE/.test(n)) return 'Silicone leg trainer';
  if (/FITNESS RING/.test(n)) return 'Pilates ring';
  return 'Resistance bands';
}
function equipment(n) {
  const m = [
    [/BARRE FIX MURAL/, 'Wall-mounted pull-up bar'], [/BARRE FIX PORTE GM/, 'Doorway pull-up bar — large'], [/BARRE FIX PORTE PM/, 'Doorway pull-up bar — small'], [/BARRE FIX PRO/, 'Pull-up bar Pro'], [/BARRE FIXE/, 'Pull-up bar'],
    [/ABDOMINAL WHEEL/, 'Ab wheel — Flott'], [/GYM BALL (\d+)/, (x) => `Gym ball ${x.match(/\d+/)[0]} cm`], [/GYMNASTIC (\d+)/, (x) => `Gymnastic ball ${x.match(/\d+/)[0]} cm`], [/HULA HOOP/, 'Hula hoop — waist slimming'],
    [/CERCEAU GM/, 'Gym hoop — large'], [/CERCEAU PM/, 'Gym hoop — small'], [/STEPS/, 'Aerobic step'], [/HAND GRIP 10-40KG/, 'Adjustable hand grip 10–40 kg'], [/HAND GRIP 5-60KG/, 'Adjustable hand grip 5–60 kg'],
    [/HAND GRIP 10KG/, 'Hand grip 10 kg'], [/HAND GRIP 347-2/, 'Hand grip 347-2'], [/HAND GRIP MULTI/, 'Multi hand grip'], [/GRIPSTER 160KG/, 'Gripster 160 kg'], [/GRIPSTER GRIP BALL/, 'Gripster grip ball'],
    [/GRIPSTER SPORTINA/, 'Gripster Sportina'], [/SPRING COUNTING GRIP/, 'Hand grip with counter'], [/CHEST EXPANDER/, 'Chest expander'], [/FINGER TRAINER/, 'Finger trainer'], [/HAND EXERCCISE BALLS/, 'Hand exercise balls'],
    [/AB TRIMMER/, 'Ab trimmer'], [/WAISTTWISTING/, 'Waist twisting disc'], [/GYM CABLE/, 'Gym cable attachment'], [/BALLON YOGA/, 'Yoga ball'], [/BODY SCULPTURE SHAKER/, 'Body Sculpture shake weight'], [/ROLLER/, 'Foam roller'],
    [/FITNESS WAIST STRAP/, 'Fitness waist strap ST-7076'], [/ADJUSTABLE GRIP/, 'Adjustable hand grip'],
  ].find(([re]) => re.test(n))?.[1];
  return typeof m === 'function' ? m(n) : m ?? titleCase(n);
}
function gymGloves(n) {
  if (/BUKA/.test(n)) return 'Buka gym gloves';
  if (/GOLD GYM/.test(n)) return "Gold's Gym gloves";
  if (/NIKE MUSCILATION/.test(n)) return 'Nike gym gloves';
  if (/LES GANTS 80/.test(n)) return 'Gym gloves — basic';
  if (/LES GANTS ADULT/.test(n)) return 'Winter gloves — adult';
  if (/LES GANTS ENFANT/.test(n)) return 'Winter gloves — kids';
  if (/LES GANTS CUIR/.test(n)) return 'Leather gloves';
  if (/GANT MUSCILATION/.test(n)) return 'Gym gloves — padded';
  return 'Gym gloves';
}
function belt(n) {
  if (/DE CHARGE IMP/.test(n)) return 'Weighted dip belt — imported';
  if (/DE CHARGE LOCAL/.test(n)) return 'Weighted dip belt';
  if (/GOLDS/.test(n)) return "Gold's Gym lifting belt";
  if (/JOEREX/.test(n)) return 'Joerex lifting belt';
  if (/CEINTURE VENUM/.test(n)) return 'Venum lifting belt';
  if (/STRAPS METAL VIVA/.test(n)) return 'Viva metal hook straps';
  if (/CEINTURE VIVA/.test(n)) return 'Viva lifting belt';
  if (/CIENTURE MUSCULATION CUIR/.test(n)) return 'Leather lifting belt — Try and Do';
  if (/BRASSERT/.test(n)) return 'Weightlifting wristband';
  if (/STRAPS BUKA/.test(n)) return 'Buka lifting straps';
  if (/STRAPS VENUM/.test(n)) return 'Venum lifting straps';
  if (/MAIN DACIER/.test(n)) return 'Steel hand grip C24';
  return 'Lifting straps';
}
function shaker(n) {
  const m = [
    [/BOITE METAL/, 'Shaker — metal box'], [/BOMB/, 'Shaker — Bomb'], [/SHAKER COULEUR/, 'Shaker — colours'], [/SHAKER GM/, 'Shaker — large'], [/INOX/, 'Stainless steel shaker'], [/MYB/, 'Shaker MYB'],
    [/POIGNET/, 'Shaker with handle'], [/SPIDER/, 'Spider shaker'], [/PRO SPORTS/, 'Shaker — Pro Sports'], [/SHAKER SPORTLIFE/, 'Shaker — Sportlife'], [/SHAKER SPORT/, 'Sports shaker'],
    [/GOURDE FOCUS/, 'Water bottle — Focus'], [/GOURDE LUCKY/, 'Water bottle — Lucky'], [/GOURDE MACRON/, 'Water bottle — Macron'], [/GOURDE SPORTLIFE/, 'Water bottle — Sportlife'], [/GOURDE XIKEXI/, 'Water bottle — Xikexi'],
  ].find(([re]) => re.test(n))?.[1];
  return m ?? 'Shaker';
}
function slimming(n) {
  const m = [
    [/NEOPRENE SAUNA SUIT FOR MEN/, 'Neoprene sauna suit — men'], [/SPORT SAUNA SUIT/, 'Sports sauna suit'], [/WOMEN WEIGHT LOSS/, 'Sauna sweat pants — women'], [/PONTALONPARA SAUNA/, 'Sauna trousers'], [/SAUNA SUIT/, 'Sauna suit'],
    [/SLIM FIT/, 'Slim Fit shaper'], [/SLIMMING CLOTHES/, 'Slimming suit'], [/SWEAT SHAPER/, 'Sweat shaper'], [/WAIST CORSET/, 'Waist corset — women'], [/WAIST TRIMMER/, 'Waist trimmer belt'],
    [/MEN SWEAT VEST/, 'Sweat vest — men'], [/FIERT/, 'Fiert shapewear — men'], [/GAINE SPORT 4M/, 'Sports waist shaper 4 m'], [/GAINE SPORT F\/H/, 'Sports waist shaper — men / women'], [/GAIN 4M/, 'Waist shaper 4 m'],
    [/SWEAT SUIT SPORTSWEAR/, 'Sweat suit'],
  ].find(([re]) => re.test(n))?.[1];
  return m ?? 'Slimming wear';
}
function scale(n) {
  if (/BLUETOOTH/.test(n)) return 'Bluetooth bathroom scale';
  if (/SMART BODY FAT/.test(n)) return 'Smart body-fat scale';
  if (/SMART SCALE/.test(n)) return 'Smart scale';
  if (/PESE/.test(n)) return 'Bathroom scale — digital';
  return 'Bathroom scale';
}
function fitWear(n) {
  const m = [
    [/BODY NIKE\/UNDERARMOR/, 'Compression top — Nike / Under Armour U502'], [/BODY NIKE \/ UA/, 'Compression top — Nike / Under Armour'], [/BODY UA/, 'Under Armour compression top'], [/BODY FITNESS ROPA/, 'Fitness bodysuit — women'],
    [/THE NORTH FACE BODY/, 'The North Face base layer'], [/Nike compression t-shirt/i, 'Nike compression T-shirt — white / black'], [/SIBOTE SHORT SLEEVE/, 'Sibote compression undershirt'], [/YC BODY FITNESS DRESS/, 'Fitness dress — YC'],
    [/^COMPRESSION SLEEVE$/, 'Compression arm sleeve'], [/DEBARDEUR MUSCULATION/, 'Gym tank top'], [/DEBARDEUR HOMME/, 'Tank top — men'], [/GILET GYM/, 'Gym vest'], [/WEATBAND NIKE/, 'Nike sweatband'], [/WRISTBAND\/HEADBAND/, 'Wristband & headband set'],
    [/ELASTIQUE CHEVEUX NIKE/, 'Nike hair band'], [/ELASTIQUE CHEVEUX/, 'Sports hair band'], [/SHORT \+ CYCLIST PANTALONG 1/, 'Shorts with leggings — model 1'], [/SHORT \+ CYCLIST PANTALONG 2 NIKE/, 'Nike shorts with leggings'],
    [/SHORT \+ CYCLIST PANTALONG 3/, 'Shorts with leggings — model 3'], [/SHORT \+ CYCLIST SHORT\/PANTACOURT UNDERARMOUR/, 'Under Armour shorts with tights'], [/SHORT \+ CYCLIST/, 'Shorts with tights 9619'],
    [/SHORT\+CYCLISTE/, 'Shorts with tights'], [/SHORT\+FIZO/, 'Shorts with compression liner'], [/CYCLIST ENFANT/, 'Kids cycling shorts'], [/CYCLIST SIMPLE NOIR/, 'Cycling shorts — black'],
    [/CYCLIST ADULT\s+(\S+)/, (x) => `Cycling shorts ${x.match(/ADULT\s+(\S+)/)[1]}`], [/SHORT CYCLIST ADULT\s*$/, 'Cycling shorts 2010'],
    [/SHORT FIZO AKHINA/, 'Compression shorts — Akhina 36-A'], [/SHORT FIZO NIKE #007/, 'Nike compression shorts #007'], [/SHORT FIZO NIKE/, 'Nike compression shorts'], [/SHORT FIZO UA/, 'Under Armour compression shorts #809'],
    [/SHORT HS SIMPLE/, 'Sports shorts — HS'], [/SHORT JORDAN/, 'Jordan shorts — white'], [/SHORT NIKE \/ ADIDAS/, 'Shorts — Nike / adidas'], [/SHORT SPORT NIKE/, 'Nike sports shorts'], [/SHORT SPORT\/PONTALON CYCLIST/, 'Shorts with long tights'],
    [/SHORT SPORT\/SHORT CYCLIST/, 'Shorts with short tights'], [/LEISURE WEAR J2320/, 'Leisure shorts J2320'], [/LEISURE WEAR U3085/, 'Leisure top U3085'], [/PONTALON SURVETTE/, 'Track pants'], [/PULL CYCLIST DEMI MANCHE/, 'Cycling top — half sleeves'],
    [/PULL DEMI MANCHE ENFANT/, 'Kids sports top'], [/PULL SPORT SPARTA/, 'Sparta sports top'], [/PUL SPORT/, 'Sports top'], [/FIZO ENFANT/, 'Kids compression shorts'], [/FIZO PRO COMBAT/, 'Pro Combat compression shorts'],
  ].find(([re]) => re.test(n))?.[1];
  return typeof m === 'function' ? m(n) : m ?? titleCase(n);
}
function sportBag(n) {
  if (/SPORT BAG CABA/.test(n)) return 'Sports tote bag';
  if (/SPORTBAG/.test(n)) return 'Sports bag — large';
  if (/SPORT BAG/.test(n)) return 'Sports bag';
  if (/CABA GM/.test(n)) return 'Tote bag — large';
  if (/CABA SPORT/.test(n)) return 'Sports tote';
  if (/CABA CUCI/.test(n)) return 'Tote bag — Cuci';
  if (/PLPOWER/.test(n)) return 'Shoulder bag — PL Power';
  if (/ZHUIFENG/.test(n)) return 'Shoulder bag — Zhuifeng';
  if (/SAC SOLIER/.test(n)) return 'Boot bag';
  return 'Sports bag';
}
function support(n) {
  const m = [
    [/7199 KNEE SUPPORT 8570/, 'Knee support 7199'], [/ANKLE SUPPORT 7883/, 'Ankle support 7883'], [/ANKLE SUPPORT/, 'Ankle support'], [/ELBOW SUPPORT 8816/, 'Elbow support 8816'],
    [/ELBOW SUPPORT FOR INJURY/, 'Elbow support — injury'], [/ELBOW SUPPORT/, 'Elbow support'], [/KNEE COMPRESSION SLEEVE/, 'Knee compression sleeve'], [/KNEE SUPPORT SIBOTE\./, 'Sibote knee support — hinged'],
    [/KNEE SUPPORT SIBOTE/, 'Sibote knee support'], [/KNEE SUPPORT YC 7199/, 'YC knee support 7199'], [/KNEE SUPPORT YC 8324/, 'YC knee support 8324'], [/KNEE SUPPORT YC/, 'YC knee support'],
    [/KNEE SUPPORT (\d+)/, (x) => `Knee support ${x.match(/\d+/)[0]}`], [/KNEE SUPPORT/, 'Knee support'], [/LONG SPINE SUPPORT BRACE/, (x) => `Long spine support brace ${x.match(/\d{4}/)[0]}`],
    [/NORMAL UPPER BACK/, 'Upper back support 8016'], [/POSTURE/, 'Posture correcting belt'], [/POWERKNEE/, 'Powerknee joint support'], [/^PROTEGE POIGNET$/, 'Wrist guard'], [/WRIST SUPPORT/, 'Wrist support'],
    [/MEDICAL BREATHABLE/, 'Medical knee fixation brace'], [/WRAP KNEE/, 'Wrap-around knee brace'], [/COMPRESSION SLEEVE/, 'Compression sleeve'],
  ].find(([re]) => re.test(n))?.[1];
  return typeof m === 'function' ? m(n) : m ?? titleCase(n);
}
function massage(n) {
  const m = [
    [/CAR HOME MASSAGE PILLOW/, 'Car & home massage pillow'], [/MASSAGE PILLOW/, 'Massage pillow'], [/FAR INFRARED/, 'Infrared joint heat massager'], [/FOOT MASSAGER/, 'Foot massager'], [/SHIATSU/, 'Shiatsu foot massager'],
    [/GOGO/, 'GoGo massage hammer'], [/HANDHELD BALL/, 'Handheld ball massager'], [/HAND MASSAGE BALL/, 'Spiky massage ball'], [/MASSAGE PRO/, 'Massage gun Pro'], [/MASSAGE ROLLER/, 'Massage roller'],
    [/NECK KNEADING/, 'Neck kneading massager'], [/SCALP/, 'Scalp massager'],
  ].find(([re]) => re.test(n))?.[1];
  return m ?? 'Massager';
}
function care(n) {
  if (/KINESIO/.test(n)) return 'Kinesiology tape';
  if (/INSOLE/.test(n)) return 'Sports insoles';
  if (/HEALTHY HEEL/.test(n)) return 'Silicone heel cups';
  if (/COMFORT HEEL/.test(n)) return 'YC comfort heel pads';
  if (/FOOTCARE/.test(n)) return 'Foot care pads';
  if (/SUPPORT FOOTBALL VEST/.test(n)) return 'YC football support vest';
  return 'Sports care';
}
function moto(n) {
  if (/MONSTER/.test(n)) return 'Monster Energy moto gloves';
  if (/NF/.test(n)) return 'Moto gloves NF';
  if (/LES GANTS MOTO/.test(n)) return 'Moto gloves';
  if (/VILO/.test(n)) return 'Cycling protection set';
  if (/CAGOULE 12/.test(n)) return 'Balaclava — thermal';
  if (/CAGOULE/.test(n)) return 'Balaclava';
  return 'Moto gloves';
}
function tt(n) {
  if (/CARBON/.test(n)) return 'Carbon table tennis bat';
  if (/NETHOLDER/.test(n)) return 'Table tennis net holder';
  if (/PACKET OULITE/.test(n)) return 'Table tennis bats pack — Oulite';
  if (/PACKET/.test(n)) return 'Table tennis bats pack';
  if (/RACKET/.test(n)) return 'Table tennis racket';
  return 'Table tennis bat';
}

/* --------------------------------- run ---------------------------------- */
const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/\+/g, ' plus ').replace(/[^\w\s-]/g, ' ').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');

const out = new Map();
const skipped = [];
for (const r of rows) {
  const [, , category, , rawName, ref, , priceS, qtyS, img128] = r;
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ');
  const price = Math.round(Number(priceS));
  const qty = Math.round(Number(qtyS));
  const why =
    category !== 'SPORT' && category !== 'SPORT / MAILLOTS' && category !== 'All' ? `category ${category}` : !price ? 'no price' : SKIP.some((re) => re.test(name)) ? 'not a sellable name / excluded' : null;
  if (why) {
    skipped.push(`${name}\t${why}`);
    continue;
  }
  const rule = R.find(([re]) => re.test(name));
  if (!rule) {
    skipped.push(`${name}\tno rule`);
    continue;
  }
  const [re, sport, sub, nameOf, sizesOf, queryOf] = rule;
  if (!sport) {
    skipped.push(`${name}\treplaced by the jersey collection`);
    continue;
  }
  const m = name.match(re);
  const clean = (typeof nameOf === 'function' ? nameOf(name, m) : nameOf).replace(/\s+/g, ' ').trim();
  const sizes = typeof sizesOf === 'function' ? sizesOf(name, m) : sizesOf ?? ONE;
  const query = typeof queryOf === 'function' ? queryOf(name, m) : queryOf ?? clean.replace(/ — /g, ' ').replace(/[()]/g, '');
  const item = { slug: slugify(clean), name: clean, odoo: name, sku: ref ? String(ref) : '', brand: brandOf(name), sport, sub, price: price * 100, sizes, qty: Math.max(0, qty), sold: Math.max(0, -qty), query, hasOdooImage: !!img128 };
  // duplicates (same English name): keep one — the one with stock, else with a photo, else the higher price
  const cur = out.get(item.slug);
  if (cur) {
    const better = item.qty > cur.qty || (item.qty === cur.qty && ((item.hasOdooImage && !cur.hasOdooImage) || (item.hasOdooImage === cur.hasOdooImage && item.price > cur.price)));
    skipped.push(`${(better ? cur : item).odoo}\tduplicate of "${item.name}"`);
    if (better) out.set(item.slug, { ...item, qty: item.qty + cur.qty, sold: item.sold + cur.sold });
    else {
      cur.qty += item.qty;
      cur.sold += item.sold;
    }
    continue;
  }
  out.set(item.slug, item);
}
// the jerseys: the clubs' 2026/27 kits and every World Cup 2026 team's home and away shirt,
// priced like the Odoo jerseys (MAILLOT DE FOOTBALL EURO 3 000 DA, MAILLOT DE FOOTBALL DZ 2 500 DA)
const CLUBS = [
  ['PSG', 'nike', [['home', 'Old Royal blue'], ['away', 'white'], ['third', 'black']], 'PSG 2026-27'],
  ['FC Barcelona', 'nike', [['home', 'blaugrana'], ['away', 'Mamba'], ['third', 'teal']], 'FC Barcelona 2026-27'],
  ['Arsenal', 'adidas', [['home', 'red'], ['away', 'navy & yellow'], ['third', 'pale yellow']], 'Arsenal 2026-27'],
  ['Real Madrid', 'adidas', [['home', 'white'], ['away', 'dark green'], ['third', 'pink']], 'Real Madrid 2026-27'],
];
const TEAMS = [
  ['USA', 'nike'], ['Mexico', 'adidas'], ['Canada', 'nike'], ['England', 'nike'], ['France', 'nike'], ['Croatia', 'nike'], ['Norway', 'nike'], ['Portugal', 'puma'],
  ['Germany', 'adidas'], ['Netherlands', 'nike'], ['Switzerland', 'puma'], ['Scotland', 'adidas'], ['Spain', 'adidas'], ['Austria', 'puma'], ['Belgium', 'adidas'],
  ['Bosnia and Herzegovina', 'other'], ['Sweden', 'adidas'], ['Türkiye', 'nike'], ['Czechia', 'puma'], ['Japan', 'adidas'], ['Iran', 'other'], ['Uzbekistan', 'other'],
  ['South Korea', 'nike'], ['Jordan', 'other'], ['Australia', 'nike'], ['Qatar', 'nike'], ['Saudi Arabia', 'adidas'], ['Iraq', 'other'], ['Algeria', 'adidas'],
  ['Cape Verde', 'other'], ['Egypt', 'puma'], ['Ghana', 'puma'], ['Ivory Coast', 'puma'], ['Morocco', 'puma'], ['Senegal', 'puma'], ['South Africa', 'other'],
  ['Tunisia', 'other'], ['DR Congo', 'other'], ['Argentina', 'adidas'], ['Brazil', 'nike'], ['Colombia', 'adidas'], ['Ecuador', 'other'], ['Paraguay', 'puma'],
  ['Uruguay', 'puma'], ['Panama', 'other'], ['Curaçao', 'other'], ['Haiti', 'other'], ['New Zealand', 'nike'],
];
const jersey = (o) => ({ odoo: '', sku: '', sport: 'football', sub: 'jerseys', sizes: ADULT, qty: 0, sold: 0, hasOdooImage: false, jersey: true, ...o });
for (const [club, brand, kits, q] of CLUBS)
  for (const [kit, colourName] of kits) {
    const name = `${club} 2026/27 ${kit} jersey`;
    out.set(slugify(name), jersey({ slug: slugify(name), name, brand, price: 300000, colour: colourName, query: `${q} ${kit} kit jersey`, team: club }));
  }
for (const [team, brand] of TEAMS)
  for (const kit of ['home', 'away']) {
    const name = `${team} 2026 World Cup ${kit} jersey`;
    out.set(slugify(name), jersey({ slug: slugify(name), name, brand, price: team === 'Algeria' ? 250000 : 300000, query: `${team.replace('Türkiye', 'Turkey')} 2026 world cup ${kit} jersey`, team }));
  }
out.set('algeria-2026-pre-match-shirt-black', jersey({ slug: 'algeria-2026-pre-match-shirt-black', name: 'Algeria 2026 jersey — black & green', brand: 'adidas', price: 250000, query: 'Algeria 2026 pre-match shirt adidas', team: 'Algeria' }));

// image searches that need more than the product name (checked by eye on the contact sheets)
const QUERY_FIX = {
  'football-grade-plus': 'soccer ball size 5 match ball',
  'football-grade-plus-plus': 'soccer ball size 5 thermo bonded',
  'football-grade-plus-plus-plus': 'professional soccer ball size 5 white',
  'adidas-football': 'adidas soccer ball size 5',
  'adidas-glossy-football': 'adidas soccer ball glossy size 5',
  'humble-basketball': 'rubber basketball size 7',
  'derby-football': 'soccer ball size 5 white black',
  'lotto-football': 'lotto soccer ball',
  'pro-football-new': 'pro soccer ball size 5',
  'pro-plus-football': 'pro soccer ball thermo bonded size 5',
  'puma-football': 'puma soccer ball size 5',
  'sarson-glossy-football': 'sarson soccer ball',
  'fox-football-size-4': 'soccer ball size 4 kids',
  'star-football': 'star soccer ball size 5',
  'super-football': 'soccer ball size 5 pu',
  'umbro-football': 'umbro soccer ball',
  'football-vegastar-joma-derbystar': 'joma soccer ball size 5',
  volleyball: 'volleyball ball size 5',
  'hello-kitty-seat-ring': 'hello kitty inflatable swim seat ring kids',
  'fishing-line-0-370mm-20lbs-r18': 'nylon fishing line spool 0.37mm',
  'fishing-line-0-400mm-18-90kg-300m': 'monofilament fishing line 300m spool 0.40',
  'fishing-line-0-45mm-15-3kg-300m': 'monofilament fishing line 300m spool 0.45',
  'football-goal-net': 'football goal net replacement',
  'petra-swim-goggles': 'swimming goggles anti fog adult',
  'sweat-vest-men': 'neoprene sweat vest men sauna',
  'fishing-reel-crossfire-40': 'daiwa crossfire spinning reel',
  'buster-pump': 'electric air pump inflatable',
  'buster-electric-pump-jdx809c': 'electric air pump inflatable 220v',
  'ball-pump-cc4': 'double action hand air pump ball',
  'nunchaku': 'wooden nunchaku chain',
  'kids-foam-nunchaku': 'foam nunchaku kids',
  'swim-ring-332-2-911-10': 'inflatable swim ring pool float adult',
  'swim-ring-5139-2': 'inflatable swim ring pool float adult',
  'swim-ring-911-9': 'inflatable swim ring pool float adult',
  'swim-ring-5139-1': 'inflatable swim ring pool float adult',
  'swim-ring-5144-12': 'inflatable swim ring pool float adult',
  'swim-ring-5144-13': 'inflatable swim ring pool float adult',
  'swim-ring-5144-5': 'inflatable swim ring pool float adult',
  'swim-ring-5506-1': 'inflatable swim ring pool float adult',
  'swim-ring-5506-5': 'inflatable swim ring pool float adult',
  'swim-ring-5507-8': 'inflatable swim ring pool float adult',
  'swim-ring-5553-8': 'inflatable swim ring pool float adult',
  'swim-ring-976-10': 'inflatable swim ring pool float adult',
  'viva-metal-hook-straps': 'weight lifting hook straps metal',
  'tn-93-tracksuit': 'nike tn tracksuit men',
  'tactics-board': 'football tactics board magnetic',
  'kawi-jacket': 'track jacket zip football training',
  'fabric-protector': 'boxing chest protector padded',
  'resistance-loop-md-03': 'resistance loop band fitness',
  'shaker-metal-box': 'protein shaker bottle with storage box',
  'shaker-bomb': 'protein shaker bottle 700ml',
  'shaker-colours': 'protein shaker bottle colors',
  'shaker-large': 'large protein shaker bottle 1 litre',
  'shaker-myb': 'gym protein shaker bottle',
  'stainless-steel-shaker': 'stainless steel protein shaker bottle',
};
for (const [slug, query] of Object.entries(QUERY_FIX)) if (out.has(slug)) out.get(slug).query = query;

const list = [...out.values()];
fs.writeFileSync(OUT, JSON.stringify(list, null, 1));
fs.writeFileSync(SKIPPED, skipped.join('\n') + '\n');
const by = {};
for (const p of list) by[`${p.sport}/${p.sub}`] = (by[`${p.sport}/${p.sub}`] ?? 0) + 1;
console.log(list.length, 'products;', skipped.length, 'skipped');
console.log(Object.entries(by).sort().map(([k, v]) => `${k} ${v}`).join(' | '));
