/**
 * The 58 wilayas the couriers deliver to, with ZR Express starting prices in DA.
 *
 * ZR Express does not publish one official price list: every shop gets its own rates in its
 * contract (they depend on the shop's own wilaya and on parcel weight). These starting prices are
 * the per-wilaya rates a ZR Express shop published in 2026 (home delivery / stop desk, parcel up to
 * 5 kg). Replace them with the rates in your own contract in Admin → Delivery; what you save there
 * overrides this file. `null` = that kind of delivery isn't offered there.
 *
 * Wilayas created in 2025 (codes 59–69) are still served under the wilaya they were part of, which
 * is how the couriers list them, so the customer picks that one.
 */

export interface Wilaya {
  code: number;
  name: string;
  ar: string;
  /** home delivery, DA */
  home: number | null;
  /** stop desk (pick-up at the courier's office), DA */
  desk: number | null;
  /** true where the published list had no clear price and this one is an estimate */
  estimate?: boolean;
}

export const WILAYAS: Wilaya[] = [
  { code: 1, name: 'Adrar', ar: 'أدرار', home: 1400, desk: 970 },
  { code: 2, name: 'Chlef', ar: 'الشلف', home: 800, desk: 520 },
  { code: 3, name: 'Laghouat', ar: 'الأغواط', home: 950, desk: 670 },
  { code: 4, name: 'Oum El Bouaghi', ar: 'أم البواقي', home: 800, desk: 520 },
  { code: 5, name: 'Batna', ar: 'باتنة', home: 800, desk: 520 },
  { code: 6, name: 'Béjaïa', ar: 'بجاية', home: 800, desk: 520 },
  { code: 7, name: 'Biskra', ar: 'بسكرة', home: 950, desk: 670 },
  { code: 8, name: 'Béchar', ar: 'بشار', home: 1100, desk: 720 },
  { code: 9, name: 'Blida', ar: 'البليدة', home: 750, desk: 520 },
  { code: 10, name: 'Bouira', ar: 'البويرة', home: 800, desk: 520 },
  { code: 11, name: 'Tamanrasset', ar: 'تمنراست', home: 1600, desk: 1120 },
  { code: 12, name: 'Tébessa', ar: 'تبسة', home: 900, desk: 520 },
  { code: 13, name: 'Tlemcen', ar: 'تلمسان', home: 700, desk: 520, estimate: true },
  { code: 14, name: 'Tiaret', ar: 'تيارت', home: 750, desk: 520 },
  { code: 15, name: 'Tizi Ouzou', ar: 'تيزي وزو', home: 800, desk: 520 },
  { code: 16, name: 'Alger', ar: 'الجزائر', home: 650, desk: 470 },
  { code: 17, name: 'Djelfa', ar: 'الجلفة', home: 950, desk: 670 },
  { code: 18, name: 'Jijel', ar: 'جيجل', home: 800, desk: 520 },
  { code: 19, name: 'Sétif', ar: 'سطيف', home: 800, desk: 520 },
  { code: 20, name: 'Saïda', ar: 'سعيدة', home: 750, desk: 570 },
  { code: 21, name: 'Skikda', ar: 'سكيكدة', home: 800, desk: 520 },
  { code: 22, name: 'Sidi Bel Abbès', ar: 'سيدي بلعباس', home: 700, desk: 520 },
  { code: 23, name: 'Annaba', ar: 'عنابة', home: 850, desk: 520 },
  { code: 24, name: 'Guelma', ar: 'قالمة', home: 850, desk: 520 },
  { code: 25, name: 'Constantine', ar: 'قسنطينة', home: 800, desk: 520 },
  { code: 26, name: 'Médéa', ar: 'المدية', home: 750, desk: 520 },
  { code: 27, name: 'Mostaganem', ar: 'مستغانم', home: 700, desk: 520 },
  { code: 28, name: "M'Sila", ar: 'المسيلة', home: 900, desk: 670 },
  { code: 29, name: 'Mascara', ar: 'معسكر', home: 700, desk: 520 },
  { code: 30, name: 'Ouargla', ar: 'ورقلة', home: 1000, desk: 720 },
  { code: 31, name: 'Oran', ar: 'وهران', home: 700, desk: 520 },
  { code: 32, name: 'El Bayadh', ar: 'البيض', home: 1000, desk: 670 },
  { code: 33, name: 'Illizi', ar: 'إليزي', home: null, desk: null },
  { code: 34, name: 'Bordj Bou Arréridj', ar: 'برج بوعريريج', home: 800, desk: 520 },
  { code: 35, name: 'Boumerdès', ar: 'بومرداس', home: 800, desk: 520 },
  { code: 36, name: 'El Tarf', ar: 'الطارف', home: 850, desk: 520 },
  { code: 37, name: 'Tindouf', ar: 'تندوف', home: null, desk: null },
  { code: 38, name: 'Tissemsilt', ar: 'تيسمسيلت', home: 750, desk: 520 },
  { code: 39, name: 'El Oued', ar: 'الوادي', home: 1000, desk: 720 },
  { code: 40, name: 'Khenchela', ar: 'خنشلة', home: 800, desk: 520 },
  { code: 41, name: 'Souk Ahras', ar: 'سوق أهراس', home: 800, desk: 520 },
  { code: 42, name: 'Tipaza', ar: 'تيبازة', home: 800, desk: 520 },
  { code: 43, name: 'Mila', ar: 'ميلة', home: 800, desk: 520 },
  { code: 44, name: 'Aïn Defla', ar: 'عين الدفلى', home: 750, desk: 520 },
  { code: 45, name: 'Naâma', ar: 'النعامة', home: 1000, desk: 670 },
  { code: 46, name: 'Aïn Témouchent', ar: 'عين تموشنت', home: 650, desk: 520 },
  { code: 47, name: 'Ghardaïa', ar: 'غرداية', home: 1000, desk: 670 },
  { code: 48, name: 'Relizane', ar: 'غليزان', home: 750, desk: 520 },
  { code: 49, name: 'Timimoun', ar: 'تيميمون', home: 1400, desk: 970 },
  { code: 50, name: 'Bordj Badji Mokhtar', ar: 'برج باجي مختار', home: null, desk: null },
  { code: 51, name: 'Ouled Djellal', ar: 'أولاد جلال', home: 950, desk: 670 },
  { code: 52, name: 'Béni Abbès', ar: 'بني عباس', home: 1200, desk: 970 },
  { code: 53, name: 'In Salah', ar: 'عين صالح', home: 1600, desk: 1120 },
  { code: 54, name: 'In Guezzam', ar: 'عين قزام', home: 1600, desk: null },
  { code: 55, name: 'Touggourt', ar: 'تقرت', home: 1000, desk: 720 },
  { code: 56, name: 'Djanet', ar: 'جانت', home: null, desk: null },
  { code: 57, name: "El M'Ghair", ar: 'المغير', home: 1000, desk: null },
  { code: 58, name: 'El Meniaa', ar: 'المنيعة', home: 1000, desk: 720 },
];

export const COURIER = 'ZR Express';
export const wilayaName = (code: number) => WILAYAS.find((w) => w.code === code)?.name ?? `Wilaya ${code}`;
