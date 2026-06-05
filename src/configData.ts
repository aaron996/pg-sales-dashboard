// Project metadata and configurations parsed from data files
export interface ProductPrice {
  sku: string;
  category: string;
  price: number;
}

export interface StoreMapInfo {
  storeCode: string;
  storeName: string;
  sup: string;
  region: string;
}

export interface StoreShiftConfig {
  storeName: string;
  workDaysPerWeek: number;
  shiftDescription: string;
}

// 1. PRODUCT PRICE CATALOG (File 3)
export const PRODUCT_PRICES: Record<string, number> = {
  "HAIRCARE.H&S-DG-BAC HA-330ML": 132000,
  "HAIRCARE.H&S-DG-DA DAU NGUA-330ML": 132000,
  "HAIRCARE.H&S-DG-BAC HA MAT LANH-480ML": 156000,
  "HAIRCARE.H&S-DG-BAC HA MAT LANH-850ML": 240000,
  "HAIRCARE.H&S-DG-SUON MEM ONG MUOT-850ML": 240000,
  "HAIRCARE.H&S-DG-DA DAU NGUA-850ML": 240000,
  "HAIRCARE.H&S-DG-BAC HA MAT LANH-1200ML": 319000,
  "HAIRCARE.H&S-DG-DA DAU NGUA-1200ML": 319000,
  "HAIRCARE.H&S-DG-SUON MEM ONG MUOT-1200ML": 319000,
  "HAIRCARE.H&S-DG-BAC HA MAT LANH-625ML": 189000,
  "HAIRCARE.H&S-DG-SUON MEM ONG MUOT-625ML": 189000,
  "HAIRCARE.H&S-DG-NGAN RUNG TOC-625ML": 189000,
  "HAIRCARE.H&S-DG-HUONG TAO-625ML": 158000,
  "HAIRCARE.H&S-DG-DA DAU NGUA-625ML": 189000,
  "HAIRCARE.H&S-DG-CHANH MUA HE-625ML": 158000,
  "HAIRCARE.H&S-DG-ZERO BANG LANH-550ML": 159000,
  "HAIRCARE.H&S-DG-ZERO BANG LANH-800ML": 204000,
  "HAIRCARE.H&S-DG-BAC HA MAT LANH-1800ML": 465000,
  "HAIRCARE.H&S-DG-DA DAU NGUA-1800ML": 465000,
  "HAIRCARE.PTN-DG-SUON MUOT ONG A-300ML": 104000,
  "HAIRCARE.PTN-DG-NGAN RUNG TOC-300ML": 104000,
  "HAIRCARE.PTN-DG-PHUC HOI HU TON-300ML": 104000,
  "HAIRCARE.PTN-DG-PHUC HOI HU TON-650ML": 175000,
  "HAIRCARE.PTN-DG-SUON MUOT ONG A-650ML": 175000,
  "HAIRCARE.PTN-DG-NGAN RUNG TOC-650ML": 175000,
  "HAIRCARE.PTN-DG-TG SANSA-650ML": 179000,
  "HAIRCARE.PTN-DG-NHAT MEM MUOT-450ML": 169000,
  "HAIRCARE.PTN-DG-NHAT PHUC HOI HU TON-450ML": 169000,
  "HAIRCARE.PTN-DG-MIC SS TAO BIEN-530ML": 176000,
  "HAIRCARE.PTN-DG-MIC DA HOA SUNG-530ML": 155000,
  "HAIRCARE.PTN-DG-LSCAM NUOC HOA HONG-530ML": 155000,
  "HAIRCARE.PTN-DG-SUON MUOT ONG A-1800ML": 424000,
  "HAIRCARE.PTN-DG-NGAN RUNG TOC-1800ML": 424000,
  "HAIRCARE.PTN-DG-NGAN RUNG TOC-900ML": 239000,
  "HAIRCARE.PTN-DG-PHUC HOI HU TON-900ML": 239000,
  "HAIRCARE.PTN-DG-SUON MUOT ONG A-900ML": 239000,
  "HAIRCARE.PTN-DG-TG SANSA-900ML": 239000,
  "HAIRCARE.PTN-DG-NGAN RUNG TOC-1200ML": 239000,
  "HAIRCARE.PTN-DG-SUON MUOT ONG A-1200ML": 239000,
  "HAIRCARE.PTN-DG-PHUC HOI HU TON-1200ML": 239000,
  "HAIRCARE.PTN-DG-SIEU MUOT-300ML": 104000,
  "HAIRCARE.RJ-DG-SUON MUOT-630ML": 160000,
  "HAIRCARE.RJ-DG-TRI GAU-630ML": 160000,
  "HAIRCARE.RJ-DG-THOM MEM MUOT-630ML": 160000,
  "HAIRCARE.RJ-DG-RICH-630ML": 160000,
  "HAIRCARE.RJ-DG-SUON MUOT-900ML": 228000,
  "HAIRCARE.RJ-DG-TRI GAU-900ML": 228000,
  "HAIRCARE.RJ-DG-THOM MEM MUOT-900ML": 228000,
  "HAIRCARE.RJ-DG-RICH-900ML": 228000,
  "HAIRCARE.RJ-DG-SUON MUOT-1200ML": 275000,
  "HAIRCARE.RJ-DG-TRI GAU-1200ML": 275000,
  "HAIRCARE.RJ-DG-SIEU MUOT-1800ML": 392000,
  "HAIRCARE.RJ-DG-3 TRONG 1-1800ML": 392000,
  "HAIRCARE.HERBAL-DG-TINH CHAT ARGAN": 0, // Fallback if 0 in sheet
  "HAIRCARE.HERBAL-DG-TINH CHAT DAU TRANG": 0,
  "HAIRCARE.HERBAL-DG-TINH CHAT HUONG THAO": 0,
  "HAIRCARE.PTN-DX-3MM COLLAGEN CSHT-150ML": 68000,
  "HAIRCARE.PTN-DX-3MM BIOTIN NGAN RUNG TOC-150ML": 64000,
  "HAIRCARE.PTN-DX-3MM COLLAGEN CSHT-300ML": 124000,
  "HAIRCARE.PTN-DX-3MM BIOTIN NGAN RUNG TOC-300ML": 124000,
  "HAIRCARE.PTN-DX-3MM KERATIN SMOA-300ML": 124000,
  "HAIRCARE.PTN-DX-3MM BIOTIN-480ML": 189000,
  "HAIRCARE.PTN-DX-3MM COLLAGEN-480ML": 189000,
  "HAIRCARE.PTN-DX-MIC SS TAO BIEN-530ML": 155000,
  "HAIRCARE.PTN-DX-MIC DA HOA SUNG-530ML": 155000,
  "HAIRCARE.PTN-DX-LSCAM NUOC HOA HONG-530ML": 155000,
  "HAIRCARE.PTN-DX-NGAN RUNG TOC-650ML": 160000,
  "HAIRCARE.PTN-DX-PHUC HOI HU TON-650ML": 88000,
  "HAIRCARE.PTN-DX-DUONG MEM MUOT-400G": 197000,
  "HAIRCARE.RJ-DX-TG 3-IN-1 MT-630ML": 0,
  "HAIRCARE.RJ-DX-SIEU MUOT-300MLX12": 0,
  "HAIRCARE.GOLDIE-SERUM-U TOC HANG NGAY-180ML": 0,
  "HAIRCARE.GOLDIE-MAT NA-U TOC CHUYEN SAU-300ML": 175000,
  "HAIRCARE.HERBAL-DX-TINH CHAT ARGAN": 175000,
  "HAIRCARE.HERBAL-DX-TINH CHAT DAU TRANG": 138000,
  "HAIRCARE.HERBAL-DX-TINH CHAT HUONG THAO": 86000,
  "HAIRCARE.PTN-DG-MIRACLES BIOTIN-300ML": 235000,
  "HAIRCARE.PTN-DG-MIRACLES COLLAGEN-300ML": 235000,
  "HAIRCARE.PTN-DG-MIRACLES BIOTIN-500ML": 429000,
  "HAIRCARE.PTN-DG-MIRACLES COLLAGEN-500ML": 429000,
  "HAIRCARE.HERBAL-DG-POTENT ALOE+AVOCADO OIL": 429000,
  "HAIRCARE.HERBAL-DG-POTENT ALOE+EUCALYPTUS": 429000,
  "HAIRCARE.HERBAL-DX-POTENT ALOE+AVOCADO OIL": 549000,
  "HAIRCARE.HERBAL-DX-POTENT ALOE+EUCALYPTUS": 439000,
  "HAIRCARE.HERBAL-MAT NA-U TOC HERBAL DAU ARGAN": 398000,
  "HAIRCARE.HERBAL-MAT NA-U TOC HERBAL SUA DUA": 398000,
  "SKINCARE.OLAY-KEM D.DA-LUMINOUS TRANG DA BAN DEM-50G": 439000,
  "SKINCARE.OLAY-KEM D.DA-LUMINOUS TRANG DA BAN NGAY-50G": 351000,
  "SKINCARE.OLAY-SERUM-NIACINAMIDE AHA SANG DA-30ML": 439000,
  "SKINCARE.OLAY-KEM D.DA-NIACINAMIDE AHA SANG DA-50G": 549000,
  "SKINCARE.OLAY-KEM D.DA-LAM GIAM DOM NAU NIACINAMIDE & VITAMIN C-50G": 549000,
  "SKINCARE.OLAY-SERUM-TRANG DA OLAY NIACINAMIDE & VITAMIN C-30ML": 420000,
  "SKINCARE.OLAY-SUPER SERUM-FIRMS BRIGHTENS HYDRATES-30ML": 420000,
  "SKINCARE.OLAY-SERUM-REGENERIST-50ML": 0,
  "SKINCARE.OLAY-KEM D.DA-OLAY REGENERIST DEM-50G": 302000,
  "SKINCARE.OLAY-KEM D.DA-OLAY REGENERIST NGAY-50G": 302000,
  "SKINCARE.OLAY-KEM D.DA-OLAY COLLAGEN TAI TAO DA-50G": 219000,
  "SKINCARE.OLAY-KEM D.DA-OLAY NGUA LHOA CHONG TIA UV-50G": 219000,
  "SKINCARE.OLAY-SERUM-COLLAGEN TAI TAO DA-30ML": 279000,
  "SKINCARE.OLAY-KEM D.DA-OLAY REGENERIST SUPER COLLAGEN PEPTIDES-45G": 20500,
  "SKINCARE.OLAY-SERUM-REGENERIST ULTRA FIRMING-30ML": 51000,
  "SKINCARE.OLAY-SERUM-RETINOL24 TAI TAO DA BAN DEM-30ML": 103000,
  "SKINCARE.OLAY-KEM D.DA-OLAY RETINOL24 BAN DEM-50G": 82000,
  "SKINCARE.OLAY-KEM D.DA-OLAY RETINOL24 BAN DEM-15ML": 51000,
  "SKINCARE.OLAY-KEM D.DA-OLAY T.EFFECT DEM-50G": 14000,
  "SKINCARE.OLAY-KEM D.DA-OLAY T.EFFECT UV NGAY-50G": 69000,
  "SKINCARE.OLAY-LOTION-DUONG THE OLAY PROB5+ BERREIS-260G": 21000,
  "SKINCARE.OLAY-LOTION-DUONG THE OLAY DUONG AM LILY-260G": 56000,
  "SKINCARE.OLAY-LOTION-DUONG THE OLAY LAM SANG DA-260G": 103000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE 2 FLEXI 2S": 99000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE 2 FLEXI 5+2S": 103000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE 2 FLEXI 10+5": 32000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE2 8+2": 75000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE2 PLUS 5C": 20000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE3 1C": 42000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE3 4+2C": 68000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE3 GOI 2C": 223000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE3 COMFORT 2C": 156000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE3 COMFORT 4C": 154000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE3 COOL 4C": 209000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE BLUE3 SENSITIVE 4C": 359000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE FLEXI VIBE 1UP": 239000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE FLEXI VIBE 4UP": 238000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE FLEXI VIBE 2C": 288000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE SUPER THIN 5+1C": 459900,
  "SHAVECARE.GILLETTE-DCR-GILLETTE SUPER THIN 8+2C": 239000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE MACH3 + 2UP": 419000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE MACH3 CLEAN 1C": 265000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3 CLEAN 2C": 279000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3 LO HOI 2C": 240000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3 LO HOI 4C": 481000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3 TURBO 2C": 349000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3 TURBO 3D 2UP": 349000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE MACH3 TURBO 3": 279000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3 TURBO 3D 4C": 34000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3+ 3C": 37000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE MACH3+ 6C": 36000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE FUSION PROGLID": 65000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE FUSION PROGLIDE 2C": 95000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE FUSION 5 RF 1X4X6": 115000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE FUSION 5 CRT 4 RF 4X10": 92000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE PROGLIDE 5 POWER": 92000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE PROGLIDE 5 POWER": 58000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE PROGLIDE 5 PRO": 32000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE VECTOR PLUS*1 G27": 35000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE VECTOR 3 1UP": 112000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE VECTOR 2C": 188000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE VECTOR 4C": 235000,
  "SHAVECARE.GILLETTE-LDC-GILLETTE VECTOR 6+2C": 112000,
  "SHAVECARE.GILLETTE-DCR-GILLETTE VECTOR 3 6UP": 0,
  "SHAVECARE.GILLETTE-MOUSE-MOUSSE FOAMY 175G B?C": 0,
  "SHAVECARE.GILLETTE-MOUSE-MOUSSE FOAMY 175G CHANH": 68000,
  "SHAVECARE.GILLETTE-MOUSE-MOUSSE C?O RÂU FOAMY 50G CHANH": 60000,
  "SHAVECARE.VENUS-DCR-VENUS DAISY2 GOI 2 2X12X2": 60000,
  "SHAVECARE.VENUS-DCR-VENUS DAISY3 GOI 2 2X12X1": 68000,
  "SHAVECARE.VENUS-DCR-VENUS DAISY3 PRO GOI 4 4X": 68000,
  "SHAVECARE.VENUS-DCR-VENUS SMOOTH 2UP 1X6X6": 60000,
  "SHAVECARE.VENUS-DCR-VENUS GILDE W.TEA 2UP 1X4": 68000,
  "SHAVECARE.VENUS-LDC-VENUS W.TEA 4S": 60000,
  "SHAVECARE.VENUS-LDC-OLAYSBERRY 4CT": 68000,
  "SHAVECARE.VENUS-LDC-OLAY COMFORTGLIDE SUGARBERRY": 68000
};

// 2. STORE MAPPING (File 2)
export const STORE_MAPPING: Record<string, StoreMapInfo> = {
  "BIGC0019": { storeCode: "BIGC0019", storeName: "GO Thăng Long", sup: "CHIEN", region: "HN" },
  "BIGC0018": { storeCode: "BIGC0018", storeName: "GO Tân Hiệp", sup: "TUNG", region: "EAST" },
  "BIGC0009": { storeCode: "BIGC0009", storeName: "GO Đồng Nai", sup: "TUNG", region: "EAST" },
  "BIGC0008": { storeCode: "BIGC0008", storeName: "GO Dĩ An", sup: "TUNG", region: "EAST" },
  "BIGC0001": { storeCode: "BIGC0001", storeName: "GO An Lạc", sup: "HOA", region: "HCM" },
  "BIGC0014": { storeCode: "BIGC0014", storeName: "GO Long Biên", sup: "CHIEN", region: "HN" },
  "BIGC0044": { storeCode: "BIGC0044", storeName: "GO Bắc Giang", sup: "CHIEN", region: "NORTH" },
  "BIGC0042": { storeCode: "BIGC0042", storeName: "GO Hạ Long", sup: "KIET", region: "NORTH" },
  "BIGC0012": { storeCode: "BIGC0012", storeName: "GO Hải Phòng", sup: "CHIEN", region: "NORTH" },
  "BIGC0040": { storeCode: "BIGC0040", storeName: "GO Vĩnh Phúc", sup: "CHIEN", region: "NORTH" },
  "BIGC0045": { storeCode: "BIGC0045", storeName: "GO Hải Dương", sup: "KIET", region: "NORTH" },
  "BIGC0036": { storeCode: "BIGC0036", storeName: "GO Nam Định", sup: "CHIEN", region: "NORTH" },
  "BIGC0020": { storeCode: "BIGC0020", storeName: "GO Thanh Hóa", sup: "CHIEN", region: "NORTH" },
  "BIGC0027": { storeCode: "BIGC0027", storeName: "GO Vinh", sup: "KIET", region: "NORTH" },
  "BIGC0007": { storeCode: "BIGC0007", storeName: "GO Đà Nẵng", sup: "HOA", region: "CENTRAL" },
  "BIGC0029": { storeCode: "BIGC0029", storeName: "GO Quy Nhơn", sup: "HOA", region: "CENTRAL" },
  "BIGC0013": { storeCode: "BIGC0013", storeName: "GO Huế", sup: "TUNG", region: "CENTRAL" },
  "BIGC0050": { storeCode: "BIGC0050", storeName: "GO Buôn Ma Thuột", sup: "HOA", region: "CENTRAL" },
  "BIGC0016": { storeCode: "BIGC0016", storeName: "GO Nha Trang", sup: "TUNG", region: "EAST" },
  "BIGC0006": { storeCode: "BIGC0006", storeName: "GO Đà Lạt", sup: "HOA", region: "EAST" },
  "BIGC0003": { storeCode: "BIGC0003", storeName: "GO Bình Dương", sup: "TUNG", region: "EAST" },
  "BIGC0011": { storeCode: "BIGC0011", storeName: "GO Gò Vấp", sup: "KIET", region: "HCM" },
  "BIGC0015": { storeCode: "BIGC0015", storeName: "GO Miền Đông", sup: "HOA", region: "HCM" },
  "BIGC0024": { storeCode: "BIGC0024", storeName: "GO Trường Chinh", sup: "HOA", region: "HCM" },
  "BIGC0023": { storeCode: "BIGC0023", storeName: "GO Nguyễn Thị Thập", sup: "KIET", region: "HCM" },
  "BIGC0004": { storeCode: "BIGC0004", storeName: "GO Cần Thơ", sup: "HOA", region: "MEKONG" },
  "EMART0002": { storeCode: "EMART0002", storeName: "Emart Sala", sup: "TUNG", region: "HCM" },
  "EMART0001": { storeCode: "EMART0001", storeName: "Emart Phan Văn Trị", sup: "TUNG", region: "HCM" },
  "EMART0003": { storeCode: "EMART0003", storeName: "Emart Phan Huy ích", sup: "HOA", region: "HCM" },
  "LCM007": { storeCode: "LCM007", storeName: "Lan Chi Tam Điệp", sup: "CHIEN", region: "NORTH" },
  "LCM014": { storeCode: "LCM014", storeName: "Lan Chi Chợ Nghệ", sup: "CHIEN", region: "HN" },
  "LCM008": { storeCode: "LCM008", storeName: "Lan Chi Giao Thủy", sup: "CHIEN", region: "NORTH" },
  "LCM001": { storeCode: "LCM001", storeName: "Lan Chi Ba Vì", sup: "CHIEN", region: "HN" },
  "LCM010": { storeCode: "LCM010", storeName: "Lan Chi Kinh Môn", sup: "CHIEN", region: "NORTH" },
  "LCM004": { storeCode: "LCM004", storeName: "Lan Chi Phổ Yên", sup: "CHIEN", region: "NORTH" },
  "LCM005": { storeCode: "LCM005", storeName: "Lan Chi Thái Nguyên", sup: "CHIEN", region: "NORTH" },
  "LCM012": { storeCode: "LCM012", storeName: "Lan Chi Đồng Văn", sup: "CHIEN", region: "NORTH" },
  "LCM006": { storeCode: "LCM006", storeName: "Lan Chi Quảng Yên", sup: "CHIEN", region: "NORTH" },
  "LCM013": { storeCode: "LCM013", storeName: "Lan Chi Thuận Thành", sup: "CHIEN", region: "NORTH" }
};

// 3. STORE SHIFT TARGETS CONFIGURATION (File 1)
export const STORE_SHIFT_CONFIGS: Record<string, StoreShiftConfig> = {
  "GO Thăng Long": { storeName: "GO Thăng Long", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Tân Hiệp": { storeName: "GO Tân Hiệp", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Đồng Nai": { storeName: "GO Đồng Nai", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Dĩ An": { storeName: "GO Dĩ An", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO An Lạc": { storeName: "GO An Lạc", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Long Biên": { storeName: "GO Long Biên", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Bắc Giang": { storeName: "GO Bắc Giang", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Hạ Long": { storeName: "GO Hạ Long", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Hải Phòng": { storeName: "GO Hải Phòng", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Vĩnh Phúc": { storeName: "GO Vĩnh Phúc", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Hải Dương": { storeName: "GO Hải Dương", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Nam Định": { storeName: "GO Nam Định", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Thanh Hóa": { storeName: "GO Thanh Hóa", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Vinh": { storeName: "GO Vinh", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Đà Nẵng": { storeName: "GO Đà Nẵng", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Quy Nhơn": { storeName: "GO Quy Nhơn", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Huế": { storeName: "GO Huế", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Buôn Ma Thuột": { storeName: "GO Buôn Ma Thuột", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Nha Trang": { storeName: "GO Nha Trang", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Đà Lạt": { storeName: "GO Đà Lạt", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Bình Dương": { storeName: "GO Bình Dương", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Gò Vấp": { storeName: "GO Gò Vấp", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Miền Đông": { storeName: "GO Miền Đông", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Trường Chinh": { storeName: "GO Trường Chinh", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Nguyễn Thị Thập": { storeName: "GO Nguyễn Thị Thập", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "GO Cần Thơ": { storeName: "GO Cần Thơ", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Emart Sala": { storeName: "Emart Sala", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Emart Phan Văn Trị": { storeName: "Emart Phan Văn Trị", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Emart Phan Huy ích": { storeName: "Emart Phan Huy ích", workDaysPerWeek: 6, shiftDescription: "từ thứ 3 đến thứ 6: 1 ca chiều; Thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Tam Điệp": { storeName: "Lan Chi Tam Điệp", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Chợ Nghệ": { storeName: "Lan Chi Chợ Nghệ", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Giao Thủy": { storeName: "Lan Chi Giao Thủy", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Ba Vì": { storeName: "Lan Chi Ba Vì", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Kinh Môn": { storeName: "Lan Chi Kinh Môn", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Phổ Yên": { storeName: "Lan Chi Phổ Yên", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Thái Nguyên": { storeName: "Lan Chi Thái Nguyên", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Đồng Văn": { storeName: "Lan Chi Đồng Văn", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Quảng Yên": { storeName: "Lan Chi Quảng Yên", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" },
  "Lan Chi Thuận Thành": { storeName: "Lan Chi Thuận Thành", workDaysPerWeek: 3, shiftDescription: "thứ 6 1 ca chiều; thứ 7-CN: 2 ca/ngày, sáng-chiều" }
};

// Dynamic runtime updator functions to modify imported collections in-place
export function setDynamicProductPrices(newPrices: Record<string, number>) {
  Object.keys(PRODUCT_PRICES).forEach(k => delete PRODUCT_PRICES[k]);
  Object.assign(PRODUCT_PRICES, newPrices);
}

export function setDynamicStoreMapping(newMap: Record<string, StoreMapInfo>) {
  Object.keys(STORE_MAPPING).forEach(k => delete STORE_MAPPING[k]);
  Object.assign(STORE_MAPPING, newMap);
}

export function setDynamicStoreShiftConfigs(newConfigs: Record<string, StoreShiftConfig>) {
  Object.keys(STORE_SHIFT_CONFIGS).forEach(k => delete STORE_SHIFT_CONFIGS[k]);
  Object.assign(STORE_SHIFT_CONFIGS, newConfigs);
}

// Custom targets cache stored in Firestore
export const CUSTOM_TARGETS: Record<string, number> = {};

export function setDynamicCustomTargets(newTargets: Record<string, number>) {
  Object.keys(CUSTOM_TARGETS).forEach(k => delete CUSTOM_TARGETS[k]);
  Object.assign(CUSTOM_TARGETS, newTargets);
}

export function getStoreTarget(storeName: string, storeCode: string, defaultTarget: number): number {
  const code = (storeCode || '').trim();
  const name = (storeName || '').trim();
  if (code && CUSTOM_TARGETS[code] !== undefined) {
    return CUSTOM_TARGETS[code];
  }
  if (name && CUSTOM_TARGETS[name] !== undefined) {
    return CUSTOM_TARGETS[name];
  }
  return defaultTarget;
}


