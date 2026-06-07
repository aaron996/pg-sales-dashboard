// Excel Parser algorithms & dates math
import { STORE_MAPPING, PRODUCT_PRICES, STORE_SHIFT_CONFIGS } from "./configData";
import * as XLSX from 'xlsx';

export const calculateStatus = (pct: number) => {
  if (pct >= 40) return "good";
  if (pct >= 30) return "warn";
  if (pct >= 20) return "mid";
  return "bad";
};

// Robust number parser that strips commas, spaces, and handles dot separators cleanly
export const parseRobustNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  const str = String(val).trim();
  if (!str) return 0;

  // Handle single dot thousands separator like "132.000" or "12.500" where VND has no decimals
  if (/^\d+\.\d{3}$/.test(str)) {
    const numWithDotRemoved = Number(str.replace(/\./g, ''));
    if (!isNaN(numWithDotRemoved)) return numWithDotRemoved;
  }

  // Strip thousands separators. Note: Some Vietnamese tables use "." for thousands and "," for decimal.
  // Others use "," for thousands and "." for decimal.
  // Standard cleanup:
  const cleaned = str.replace(/,/g, '');
  const num = Number(cleaned);
  if (!isNaN(num)) return num;

  // Try parsing VN format where . is thousands and , is decimal
  const cleanedVn = str.replace(/\./g, '').replace(/,/g, '.');
  const numVn = Number(cleanedVn);
  if (!isNaN(numVn)) return numVn;

  // Last resort: remove any non-numeric chars except dot/minus
  const lastResort = str.replace(/[^0-9.-]/g, '');
  const numLast = Number(lastResort);
  if (!isNaN(numLast)) return numLast;

  return 0;
};

// Accents-stripping helper for fuzzy store-name matches
const cleanAccentStr = (str: string) => {
  return str.toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
};

// Fuzzy lookup to map Excel columns back to store profile. Matches by uppercase storeCode OR fuzzy storeName
export const getStoreMapping = (code: string, name: string) => {
  const c = String(code || '').trim().toUpperCase();
  if (STORE_MAPPING[c]) return STORE_MAPPING[c];

  // If code did not match, attempt match by name fallback
  const n = String(name || '').trim();
  if (n) {
    const nLower = n.toLowerCase();
    // 1. Exact name match
    for (const info of Object.values(STORE_MAPPING)) {
      if (info.storeName.toLowerCase() === nLower) {
        return info;
      }
    }
    // 2. Partial name match
    for (const info of Object.values(STORE_MAPPING)) {
      const dbName = info.storeName.toLowerCase();
      if (dbName.includes(nLower) || nLower.includes(dbName)) {
        return info;
      }
    }
    // 3. Accents removed matches
    const cn = cleanAccentStr(n);
    for (const info of Object.values(STORE_MAPPING)) {
      if (cleanAccentStr(info.storeName) === cn) {
        return info;
      }
    }
  }
  return null;
};

export const parseExcelDate = (val: any, formatPreference?: 'DMY' | 'MDY', expectedMonth?: number) => {
  if (!val) return null;
  
  const expectedMonthIndex = expectedMonth !== undefined ? expectedMonth - 1 : undefined;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    
    // Healing block for SheetJS date parsing swaps (e.g., May 1st parsed as January 5th due to DMY/MDY locale mixup)
    if (expectedMonthIndex !== undefined && val.getFullYear() === 2026) {
      const curMonthIndex = val.getMonth();
      const curDay = val.getDate();
      if (curMonthIndex !== expectedMonthIndex && curDay === (expectedMonthIndex + 1)) {
        const curMonth = curMonthIndex + 1;
        if (curMonth >= 1 && curMonth <= 31) {
          const healedDate = new Date(val.getFullYear(), expectedMonthIndex, curMonth, val.getHours(), val.getMinutes(), val.getSeconds());
          if (!isNaN(healedDate.getTime())) {
            return healedDate;
          }
        }
      }
    }
    return val;
  }
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    const tzOffset = date.getTimezoneOffset() * 60 * 1000;
    const correctedDate = new Date(date.getTime() + tzOffset);
    if (!isNaN(correctedDate.getTime())) return correctedDate;
  }
  if (typeof val === 'string') {
    // Extract only the date part, ignore any trailing times (e.g., "13/05/2026 21:02:00")
    // Normalize dot separators to slashes for uniform parsing
    const cleaned = val.trim().split(' ')[0].replace(/\./g, '/');
    if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      if (parts.length === 3) {
        let day, month, year;
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        } else if (parts[2].length === 4) {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (formatPreference === 'MDY') {
            month = p0 - 1;
            day = p1;
          } else if (formatPreference === 'DMY') {
            day = p0;
            month = p1 - 1;
          } else {
            if (p0 > 12) {
              day = p0;
              month = p1 - 1;
            } else if (p1 > 12) {
               month = p0 - 1;
               day = p1;
            } else {
              // Both <= 12 and formatPreference undefined, let's disambiguate using expectedMonth
              if (expectedMonth && p0 === expectedMonth && p1 !== expectedMonth) {
                month = p0 - 1;
                day = p1;
              } else if (expectedMonth && p1 === expectedMonth && p0 !== expectedMonth) {
                day = p0;
                month = p1 - 1;
              } else {
                day = p0;
                month = p1 - 1;
              }
            }
          }
        } else {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          if (formatPreference === 'MDY') {
            month = p0 - 1;
            day = p1;
          } else if (formatPreference === 'DMY') {
            day = p0;
            month = p1 - 1;
          } else {
            if (p0 > 12) {
              day = p0;
              month = p1 - 1;
            } else if (p1 > 12) {
              month = p0 - 1;
              day = p1;
            } else {
              // Disambiguate with expectedMonth
              if (expectedMonth && p0 === expectedMonth && p1 !== expectedMonth) {
                month = p0 - 1;
                day = p1;
              } else if (expectedMonth && p1 === expectedMonth && p0 !== expectedMonth) {
                day = p0;
                month = p1 - 1;
              } else {
                day = p0;
                month = p1 - 1;
              }
            }
          }
        }
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (cleaned.includes('/')) {
      const parts = cleaned.split('/');
      if (parts.length === 3) {
        let day, month, year;
        if (parts[2].length === 4) {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (formatPreference === 'MDY') {
            month = p0 - 1;
            day = p1;
          } else if (formatPreference === 'DMY') {
            day = p0;
            month = p1 - 1;
          } else {
            if (p0 > 12) {
              day = p0;
              month = p1 - 1;
            } else if (p1 > 12) {
              month = p0 - 1;
              day = p1;
            } else {
              // Disambiguate with expectedMonth
              if (expectedMonth && p0 === expectedMonth && p1 !== expectedMonth) {
                month = p0 - 1;
                day = p1;
              } else if (expectedMonth && p1 === expectedMonth && p0 !== expectedMonth) {
                day = p0;
                month = p1 - 1;
              } else {
                day = p0;
                month = p1 - 1;
              }
            }
          }
        } else if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        } else {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          if (formatPreference === 'MDY') {
            month = p0 - 1;
            day = p1;
          } else if (formatPreference === 'DMY') {
            day = p0;
            month = p1 - 1;
          } else {
            if (p0 > 12) {
              day = p0;
              month = p1 - 1;
            } else if (p1 > 12) {
              month = p0 - 1;
              day = p1;
            } else {
              // Disambiguate with expectedMonth
              if (expectedMonth && p0 === expectedMonth && p1 !== expectedMonth) {
                month = p0 - 1;
                day = p1;
              } else if (expectedMonth && p1 === expectedMonth && p0 !== expectedMonth) {
                day = p0;
                month = p1 - 1;
              } else {
                day = p0;
                month = p1 - 1;
              }
            }
          }
        }
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
    }
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

export const formatDateYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getISOWeek = (date: Date) => {
  const tempDate = new Date(date.valueOf());
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  return Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const findMatchingKeyForField = (row: any, fieldType: 'date' | 'store_code' | 'store_name' | 'region' | 'staff' | 'category' | 'amt') => {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const rawKey of keys) {
    const k = rawKey.trim().toLowerCase();
    
    // Direct matches
    if (fieldType === 'date') {
      if (k === 'ngày báo cáo' || k === 'ngay bao cao' || k === 'date' || k === 'day' || k.includes('ngay') || k.includes('ngy')) return rawKey;
    }
    if (fieldType === 'store_code') {
      if (k === 'mã cửa hàng' || k === 'ma cua hang' || k === 'storecode' || k === 'store_code' || k.includes('mã cửa hàng') || k.includes('ma cua hang') || k.includes('mã ch') || k.includes('ma ch') || (k.includes('m') && k.includes('hng') && !k.includes('tn')) || k.includes('mchng') || k === 'ch' || k === 'code' || k === 'mã') return rawKey;
    }
    if (fieldType === 'store_name') {
      if (k === 'tên cửa hàng' || k === 'ten cua hang' || k === 'storename' || k === 'store_name' || k.includes('tên cửa hàng') || k.includes('ten cua hang') || k.includes('tên ch') || k.includes('ten ch') || (k.includes('tn') && k.includes('hng')) || k.includes('tnchng') || k.includes('cửa hàng') || k.includes('cua hang') || k === 'name' || k === 'store') return rawKey;
    }
    if (fieldType === 'region') {
      if (k === 'mã vùng' || k === 'ma vung' || k === 'region' || k.includes('vùng') || k.includes('vung') || k.includes('mvng') || (k.includes('m') && k.includes('vng'))) return rawKey;
    }
    if (fieldType === 'staff') {
      if (k === 'mã nhân viên' || k === 'ma nhan vien' || k === 'staff' || k.includes('nhân viên') || k.includes('nhan vien') || k.includes('nvn') || k.includes('nhn v') || k.includes('pg') || k.includes('sup')) return rawKey;
    }
    if (fieldType === 'category') {
      if (k === 'category' || k === 'cat' || k === 'thể loại' || k.includes('category') || k.includes('nhóm') || k.includes('ngành hàng') || k.includes('nganh hang') || k.includes('nhom hang') || k.includes('nhóm hàng') || k.includes('cat')) return rawKey;
    }
    if (fieldType === 'amt') {
      if (k === 'amt' || k === 'amount' || k === 'doanh thu' || k === 'actual' || k === 'thực tế' || k === 'thuc te' || k.includes('amt') || k.includes('tien') || k.includes('doanh') || k.includes('actual') || k.includes('thực tế') || k.includes('thuc te') || k.includes('doanh số') || k.includes('doanh so')) return rawKey;
    }
  }
  
  // Secondary fallback check based on stripping non-alphanumeric
  const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const rawKey of keys) {
    const ck = clean(rawKey);
    if (fieldType === 'date' && (ck.includes('ngay') || ck.includes('ngy') || ck === 'date')) return rawKey;
    if (fieldType === 'store_code' && (ck.includes('macuahang') || ck.includes('mchng') || ck.includes('storecode') || ck === 'mach' || ck === 'code' || ck === 'ma')) return rawKey;
    if (fieldType === 'store_name' && (ck.includes('tencuahang') || ck.includes('tnchng') || ck.includes('storename') || ck.includes('cuahang') || ck === 'ch' || ck === 'name')) return rawKey;
    if (fieldType === 'region' && (ck.includes('mavung') || ck.includes('mvng') || ck === 'region')) return rawKey;
    if (fieldType === 'staff' && (ck.includes('manhanvien') || ck.includes('mnhnvn') || ck === 'staff' || ck.includes('pg') || ck.includes('sup'))) return rawKey;
    if (fieldType === 'category' && (ck.includes('category') || ck.includes('cat') || ck.includes('nhom') || ck.includes('nganhhang') || ck.includes('nhomhang'))) return rawKey;
    if (fieldType === 'amt' && (ck.includes('amt') || ck.includes('amount') || ck.includes('doanhthu') || ck.includes('tien') || ck.includes('actual') || ck.includes('thucte') || ck.includes('doanhso'))) return rawKey;
  }
  
  return null;
};

// Fuzzy helper to match SKU headers to PRODUCTS and categories
export const matchSkuInCatalog = (columnName: string) => {
  const colUpper = String(columnName || '').toUpperCase().trim();
  if (Object.prototype.hasOwnProperty.call(PRODUCT_PRICES, colUpper)) {
    // Exact match
    return { fullSku: colUpper, price: PRODUCT_PRICES[colUpper], category: colUpper.split('.')[0] };
  }
  
  // Fuzzy match where column name might be "H&S-DG-BAC HA-330ML" and catalog key is "HAIRCARE.H&S-DG-BAC HA-330ML"
  for (const [skuKey, price] of Object.entries(PRODUCT_PRICES)) {
    const skuNoPrefix = skuKey.includes('.') ? skuKey.split('.').slice(1).join('.') : skuKey;
    if (skuNoPrefix === colUpper || skuKey === colUpper) {
      return { fullSku: skuKey, price, category: skuKey.split('.')[0] };
    }
  }

  // Fallback: check if the skuKey contains the column name
  for (const [skuKey, price] of Object.entries(PRODUCT_PRICES)) {
    if (skuKey.includes(colUpper) || colUpper.includes(skuKey)) {
      return { fullSku: skuKey, price, category: skuKey.split('.')[0] || 'UNKNOWN' };
    }
  }

  return null;
};

export const processExcelData = (arrayBuffer: any, baselineTemplate: any) => {

  let expectedYear = 2026;
  let expectedMonth = 5; // May
  if (baselineTemplate && baselineTemplate.stmb && baselineTemplate.stmb.meta) {
    const startDay = baselineTemplate.stmb.meta.start_day; // e.g. "2026-05-01"
    if (startDay) {
      const parts = startDay.split('-');
      if (parts.length === 3) {
        expectedYear = parseInt(parts[0], 10);
        expectedMonth = parseInt(parts[1], 10);
      }
    }
  } else if (baselineTemplate && baselineTemplate.crv && baselineTemplate.crv.meta) {
    const startDay = baselineTemplate.crv.meta.start_day;
    if (startDay) {
      const parts = startDay.split('-');
      if (parts.length === 3) {
        expectedYear = parseInt(parts[0], 10);
        expectedMonth = parseInt(parts[1], 10);
      }
    }
  }

  const flatRows: any[] = [];
  const inputs = Array.isArray(arrayBuffer) ? arrayBuffer : [arrayBuffer];

  for (const item of inputs) {
    try {
      let workbook;
      if (typeof item === 'string') {
        workbook = XLSX.read(item, { type: 'string' });
      } else if (item && typeof item === 'object' && item.data) {
        if (typeof item.data === 'string') {
          workbook = XLSX.read(item.data, { type: 'string' });
        } else {
          workbook = XLSX.read(item.data, { type: 'array', cellDates: true, codepage: 65001 });
        }
      } else {
        if (typeof item === 'string') {
          workbook = XLSX.read(item, { type: 'string' });
        } else {
          workbook = XLSX.read(item, { type: 'array', cellDates: true, codepage: 65001 });
        }
      }

      let sheetName = 'Data (qty>0)';
      let worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        const foundName = workbook.SheetNames.find((name: string) => 
          name.toLowerCase().includes('data') || 
          name.toLowerCase().includes('báo cáo') || 
          name.toLowerCase().includes('bao cao') ||
          name.toLowerCase().includes('sales') ||
          name.toLowerCase().includes('sheet')
        ) || workbook.SheetNames[0];
        
        if (foundName) {
          sheetName = foundName;
          worksheet = workbook.Sheets[sheetName];
        }
      }

      if (worksheet) {
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        if (rows && rows.length > 0) {
          const firstRow = rows[0];
          
          // Match keys specific to this sheet's headers
          const dateKey = findMatchingKeyForField(firstRow, 'date');
          const storeCodeKey = findMatchingKeyForField(firstRow, 'store_code') || 'Mã cửa hàng';
          const storeNameKey = findMatchingKeyForField(firstRow, 'store_name') || 'Tên cửa hàng';
          const regionKey = findMatchingKeyForField(firstRow, 'region') || 'Mã vùng';
          const staffKey = findMatchingKeyForField(firstRow, 'staff') || 'Mã nhân viên';
          const amtKey = findMatchingKeyForField(firstRow, 'amt');
          const catKey = findMatchingKeyForField(firstRow, 'category');

          if (!dateKey) {
            console.warn("Không tìm thấy cột ngày báo cáo trong file:", item.name);
            continue; // Skip this sheet if no date is found
          }

          // Detect horizontal (product-columns) vs vertical format for this sheet
          let skuColumnsCount = 0;
          Object.keys(firstRow).forEach(key => {
            if (matchSkuInCatalog(key)) {
              skuColumnsCount++;
            }
          });
          const isHorizontal = !amtKey || !catKey;

          // Autodetect date format (MDY vs DMY) across rows in this sheet
          let formatPreference: 'DMY' | 'MDY' | undefined = undefined;
          let countDMY = 0;
          let countMDY = 0;
          rows.forEach((row: any) => {
            const val = row[dateKey];
            if (val && typeof val === 'string') {
              const cleaned = val.trim().split(' ')[0].replace(/\./g, '/');
              const sep = cleaned.includes('/') ? '/' : cleaned.includes('-') ? '-' : null;
              if (sep) {
                const parts = cleaned.split(sep);
                if (parts.length === 3) {
                  const p0 = parseInt(parts[0], 10);
                  const p1 = parseInt(parts[1], 10);
                  const p2 = parseInt(parts[2], 10);
                  if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
                    if (parts[2].length === 4 || (parts[0].length !== 4 && parts[2].length === 2)) {
                      if (p0 > 12 && p0 <= 31 && p1 <= 12) {
                        countDMY++;
                      } else if (p1 > 12 && p1 <= 31 && p0 <= 12) {
                        countMDY++;
                      }
                    }
                  }
                }
              }
            }
          });

          if (countMDY > countDMY) {
            formatPreference = 'MDY';
          } else if (countDMY > countMDY) {
            formatPreference = 'DMY';
          }

          // Pre-detect correct expected month from rows to avoid date healing errors
          let currentExpectedMonthValue = expectedMonth;
          if (rows && rows.length > 0) {
            const mVotes: Record<number, number> = {};
            rows.slice(0, 150).forEach((r: any) => {
              const val = r[dateKey];
              if (!val) return;
              if (val instanceof Date) {
                if (!isNaN(val.getTime())) {
                  mVotes[val.getMonth()] = (mVotes[val.getMonth()] || 0) + 1;
                }
              } else if (typeof val === 'number') {
                const d = new Date((val - 25569) * 86400 * 1000);
                if (!isNaN(d.getTime())) {
                  mVotes[d.getMonth()] = (mVotes[d.getMonth()] || 0) + 1;
                }
              } else if (typeof val === 'string') {
                const cleaned = val.trim().split(' ')[0].replace(/\./g, '/');
                const sep = cleaned.includes('/') ? '/' : cleaned.includes('-') ? '-' : null;
                if (sep) {
                  const parts = cleaned.split(sep);
                  if (parts.length === 3) {
                    let m = -1;
                    if (parts[0].length === 4) {
                      m = parseInt(parts[1], 10) - 1; // YYYY-MM-DD
                    } else if (parts[2].length === 4) {
                      const p0 = parseInt(parts[0], 10);
                      const p1 = parseInt(parts[1], 10);
                      if (formatPreference === 'MDY') {
                        m = p0 - 1;
                      } else if (formatPreference === 'DMY') {
                        m = p1 - 1;
                      } else {
                        if (p1 >= 1 && p1 <= 12) mVotes[p1 - 1] = (mVotes[p1 - 1] || 0) + 0.5;
                        if (p0 >= 1 && p0 <= 12) mVotes[p0 - 1] = (mVotes[p0 - 1] || 0) + 0.5;
                      }
                    }
                    if (m >= 0 && m <= 11) {
                      mVotes[m] = (mVotes[m] || 0) + 1;
                    }
                  }
                }
              }
            });

            let bestV = -1;
            let maxV = 0;
            for (const [m, votes] of Object.entries(mVotes)) {
              if (votes > maxV) {
                maxV = votes;
                bestV = Number(m);
              }
            }
            if (bestV !== -1) {
              currentExpectedMonthValue = bestV + 1;
            }
          }

          if (!isHorizontal && amtKey && catKey) {
            // Processing vertical format for this sheet
            rows.forEach((row: any) => {
              const dt = parseExcelDate(row[dateKey], formatPreference, currentExpectedMonthValue);
              if (!dt) return;

              const amt = parseRobustNumber(row[amtKey]);
              let storeCode = String(row[storeCodeKey] || 'UNKNOWN').trim().toUpperCase();
              let storeName = String(row[storeNameKey] || 'UNKNOWN').trim();
              let regionCode = String(row[regionKey] || 'UNKNOWN').trim();
              const category = String(row[catKey] || 'UNKNOWN').trim();
              const staffCode = String(row[staffKey] || 'UNKNOWN').trim();

              const mapInfo = getStoreMapping(storeCode, storeName);
              if (mapInfo) {
                storeCode = mapInfo.storeCode;
                storeName = mapInfo.storeName;
                regionCode = mapInfo.region;
              }

              const skuKey = Object.keys(row).find(k => {
                const l = k.trim().toLowerCase();
                return l === 'sản phẩm' || l === 'sku' || l === 'tên sản phẩm' || l === 'mã sản phẩm' || l.includes('sku') || l.includes('sanpham') || l.includes('sản phẩm');
              }) || '';
              const skuVal = skuKey ? String(row[skuKey] || '').trim() : '';
              const matchedSku = matchSkuInCatalog(skuVal);
              const priceVal = matchedSku ? matchedSku.price : 0;
              const qtyKey = Object.keys(row).find(k => {
                const l = k.trim().toLowerCase();
                return l === 'số lượng' || l === 'qty' || l === 'quantity' || l.includes('solueng') || l.includes('số lượng') || l.includes('qty');
              }) || '';
              const qtyVal = qtyKey ? parseRobustNumber(row[qtyKey]) : (priceVal > 0 ? Math.round(amt / priceVal) : 0);

              flatRows.push({
                ...row,
                'Ngày báo cáo': dt,
                'Mã cửa hàng': storeCode,
                'Tên cửa hàng': storeName,
                'Mã vùng': regionCode,
                'Category': category,
                'Mã nhân viên': staffCode,
                'AMT': amt,
                'Qty': qtyVal,
                'SKU': skuVal || category,
                'Giá': priceVal
              });
            });
          } else {
            // Processing horizontal (product-columns) format for this sheet
            rows.forEach((row: any) => {
              const dt = parseExcelDate(row[dateKey], formatPreference, currentExpectedMonthValue);
              if (!dt) return;

              let storeCode = String(row[storeCodeKey] || 'UNKNOWN').trim().toUpperCase();
              let storeName = String(row[storeNameKey] || 'UNKNOWN').trim();
              let regionCode = String(row[regionKey] || 'UNKNOWN').trim();
              const staffCode = String(row[staffKey] || 'UNKNOWN').trim();

              const mapInfo = getStoreMapping(storeCode, storeName);
              if (mapInfo) {
                storeCode = mapInfo.storeCode;
                storeName = mapInfo.storeName;
                regionCode = mapInfo.region;
              }

              // Create a cleansed row without the product columns
              const cleansedRow = { ...row };
              Object.keys(row).forEach(key => {
                 if (matchSkuInCatalog(key)) {
                   delete cleansedRow[key];
                 }
              });

              Object.entries(row).forEach(([key, val]) => {
                const qty = parseRobustNumber(val);
                if (qty <= 0) return;

                const matchedSku = matchSkuInCatalog(key);
                if (matchedSku) {
                  const amt = qty * matchedSku.price;

                  flatRows.push({
                    ...cleansedRow,
                    'Ngày báo cáo': dt,
                    'Mã cửa hàng': storeCode,
                    'Tên cửa hàng': storeName,
                    'Mã vùng': regionCode,
                    'Category': matchedSku.category,
                    'Mã nhân viên': staffCode,
                    'AMT': amt,
                    'Qty': qty,
                    'SKU': matchedSku.fullSku,
                    'Giá': matchedSku.price,
                  });
                }
              });
            });
          }
        }
      }
    } catch (e: any) {
      console.error("Lỗi khi đọc file:", item.name, e);
    }
  }

  if (flatRows.length === 0) {
    throw new Error("Không tìm thấy dữ liệu hợp lệ trong bất kỳ tệp dữ liệu nào được chọn.");
  }

  const parsedDates = flatRows.map(r => r['Ngày báo cáo']).filter(Boolean) as Date[];

  // Select the latest date in the dataset and use its month as the active target month
  let maxDateVal = parsedDates[0];
  parsedDates.forEach(d => {
    if (d.getTime() > maxDateVal.getTime()) {
      maxDateVal = d;
    }
  });

  const targetYear = maxDateVal.getFullYear();
  const targetMonthIndex = maxDateVal.getMonth();
  const bestKey = `${targetYear}-${targetMonthIndex}`;

  const targetDates = parsedDates.filter(d => d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex);
  
  const maxDate = new Date(Math.max(...targetDates.map(d => d.getTime())));
  const year = targetYear;
  const monthIndex = targetMonthIndex;
  const elapsedDays = maxDate.getDate();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  const dayOfWeek = maxDate.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const wtdStart = new Date(maxDate);
  wtdStart.setDate(maxDate.getDate() - daysToSubtract);
  wtdStart.setHours(0, 0, 0, 0);
  const wtdDays = Math.round((maxDate.getTime() - wtdStart.getTime()) / (24 * 3600 * 1000)) + 1;

  const startDayStr = formatDateYYYYMMDD(new Date(year, monthIndex, 1));
  const endDayStr = formatDateYYYYMMDD(new Date(year, monthIndex, totalDays));
  const updatedToStr = formatDateYYYYMMDD(maxDate);
  const timegonePct = (elapsedDays / totalDays) * 100;

  const mtdStartTime = new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime();
  const wtdStartTime = wtdStart.getTime();
  const maxDateTime = maxDate.getTime();

  const processedRawRows: any[] = [];
  const mtdRows: any[] = [];
  const wtdRows: any[] = [];

  flatRows.forEach((row: any) => {
    const dt = row['Ngày báo cáo'];
    const dtTime = dt.getTime();

    const amt = row['AMT'];
    const storeCode = row['Mã cửa hàng'];
    const storeName = row['Tên cửa hàng'];
    let regionCode = row['Mã vùng'];
    const category = row['Category'];
    const staffCode = row['Mã nhân viên'];
    const proj = (storeCode.startsWith('BIGC') || storeCode.startsWith('EMART')) ? 'crv' : 'stmb';
    
    const dateDDMM = String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');

    if (regionCode === 'UNKNOWN' || !regionCode) {
      if (proj === 'stmb') regionCode = 'NORTH';
      else regionCode = 'HN'; // default fallback
    }

    const mapInfo = getStoreMapping(storeCode, storeName);
    const sup = row.Supervisor || row.Supervisor_Label || row.SUP || mapInfo?.sup || (proj === 'crv' ? `Region ${regionCode}` : 'A. Tuấn (STMB)');

    const normalizedRow = {
      ...row,
      'Ngày báo cáo': dt,
      'Date_DD_MM': dateDDMM,
      'AMT': amt,
      'Mã cửa hàng': storeCode,
      'Tên cửa hàng': storeName,
      'Mã vùng': regionCode,
      'Category': category,
      'Mã nhân viên': staffCode,
      'Project': proj,
      'Supervisor': sup,
      time: dtTime
    };

    processedRawRows.push(normalizedRow);

    if (dtTime <= maxDateTime) {
      if (dtTime >= mtdStartTime) {
        mtdRows.push(normalizedRow);
      }
      if (dtTime >= wtdStartTime) {
        wtdRows.push(normalizedRow);
      }
    }
  });

  const data = JSON.parse(JSON.stringify(baselineTemplate));

  for (const proj of ['stmb', 'crv']) {
    if (!data[proj]) continue;

    data[proj].meta = {
      start_day: startDayStr,
      end_day: endDayStr,
      updated_to: updatedToStr,
      wtd_start: formatDateYYYYMMDD(wtdStart),
      timegone: Math.round(timegonePct * 10) / 10
    };

    data[proj].daily = {};

    const storeMtdSum: any = {};
    const storeWtdSum: any = {};
    const storeMetadata: Record<string, { name: string, region: string }> = {};

    mtdRows.filter(r => r.Project === proj).forEach(r => {
      const code = r['Mã cửa hàng'];
      storeMtdSum[code] = (storeMtdSum[code] || 0) + r.AMT;
      storeMetadata[code] = {
        name: r['Tên cửa hàng'] || code,
        region: r['Mã vùng'] || 'NORTH'
      };
    });
    wtdRows.filter(r => r.Project === proj).forEach(r => {
      const code = r['Mã cửa hàng'];
      storeWtdSum[code] = (storeWtdSum[code] || 0) + r.AMT;
    });

    // Dynamically discover store codes not in the baseline template and add them
    if (data[proj] && data[proj].stores) {
      const existingCodes = new Set(data[proj].stores.map((s: any) => String(s.code || '').trim().toUpperCase()));
      Object.keys(storeMetadata).forEach(code => {
        const normCode = code.trim().toUpperCase();
        if (!existingCodes.has(normCode)) {
          data[proj].stores.push({
            code: normCode,
            store: storeMetadata[code].name,
            region: storeMetadata[code].region,
            target: 0,
            target_full: 0,
            target_mtd: 0,
            target_wtd: 0,
            actual: 0,
            actual_mtd: 0,
            actual_wtd: 0,
            actual_full: 0,
            pct: 0,
            status: 'Alarm'
          });
          existingCodes.add(normCode);
        }
      });
    }

    data[proj].stores.forEach((store: any) => {
      const code = store.code;
      const actMtd = storeMtdSum[code] || 0;
      const actWtd = storeWtdSum[code] || 0;

      const tgtFull = store.target || store.target_full || 0;
      const originalTargetMtd = store.target_mtd || 0;
      const tgtMtd = originalTargetMtd > 0 ? originalTargetMtd : (tgtFull * elapsedDays / totalDays);
      const tgtWtd = tgtFull * wtdDays / totalDays;

      store.actual_mtd = actMtd;
      store.actual_wtd = actWtd;
      store.actual_full = actMtd;
      store.target_mtd = tgtMtd;
      store.target_wtd = tgtWtd;
      store.target_full = tgtFull;
      store.actual = actMtd;
      store.target = tgtFull;
      store.pct = tgtFull > 0 ? Math.round((actMtd / tgtFull * 100) * 10) / 10 : 0;
      store.status = calculateStatus(store.pct);
    });

    if (data[proj].regions) {
      const regionMtdSum: any = {};
      const regionWtdSum: any = {};
      mtdRows.filter(r => r.Project === proj).forEach(r => {
        regionMtdSum[r['Mã vùng']] = (regionMtdSum[r['Mã vùng']] || 0) + r.AMT;
      });
      wtdRows.filter(r => r.Project === proj).forEach(r => {
        regionWtdSum[r['Mã vùng']] = (regionWtdSum[r['Mã vùng']] || 0) + r.AMT;
      });

      for (const [rName, rData] of Object.entries(data[proj].regions) as any) {
        const actMtd = regionMtdSum[rName] || 0;
        const actWtd = regionWtdSum[rName] || 0;
        const tgtFull = rData.target || rData.target_full || 0;
        const tgtMtd = tgtFull * elapsedDays / totalDays;
        const tgtWtd = tgtFull * wtdDays / totalDays;

        rData.actual_mtd = actMtd;
        rData.actual_wtd = actWtd;
        rData.actual_full = actMtd;
        rData.target_mtd = tgtMtd;
        rData.target_wtd = tgtWtd;
        rData.target_full = tgtFull;
        rData.actual = actMtd;
        rData.target = tgtFull;
        rData.pct = tgtFull > 0 ? Math.round((actMtd / tgtFull * 100) * 10) / 10 : 0;
      }
    }

    const normalizeCat = (c: any) => String(c || '').toUpperCase().trim();
    const catMtdSum: any = {};
    const catWtdSum: any = {};
    mtdRows.filter(r => r.Project === proj).forEach(r => {
      const cNorm = normalizeCat(r.Category);
      catMtdSum[cNorm] = (catMtdSum[cNorm] || 0) + r.AMT;
    });
    wtdRows.filter(r => r.Project === proj).forEach(r => {
      const cNorm = normalizeCat(r.Category);
      catWtdSum[cNorm] = (catWtdSum[cNorm] || 0) + r.AMT;
    });

    data[proj].cats.forEach((cat: any) => {
      const cName = normalizeCat(cat.cat);
      const actMtd = catMtdSum[cName] || 0;
      const actWtd = catWtdSum[cName] || 0;
      const tgtFull = cat.target || cat.target_full || 0;
      const tgtMtd = tgtFull * elapsedDays / totalDays;
      const tgtWtd = tgtFull * wtdDays / totalDays;

      cat.actual_mtd = actMtd;
      cat.actual_wtd = actWtd;
      cat.actual_full = actMtd;
      cat.target_mtd = tgtMtd;
      cat.target_wtd = tgtWtd;
      cat.target_full = tgtFull;
      cat.actual = actMtd;
      cat.target = tgtFull;
      cat.pct = tgtFull > 0 ? Math.round((actMtd / tgtFull * 100) * 10) / 10 : 0;
    });

    const totActMtd = mtdRows.filter(r => r.Project === proj).reduce((s, r) => s + r.AMT, 0);
    const totActWtd = wtdRows.filter(r => r.Project === proj).reduce((s, r) => s + r.AMT, 0);
    const totTgtFull = data[proj].total.target || data[proj].total.target_full || 0;
    const originalTotalTgtMtd = data[proj].total.target_mtd || 0;
    const totTgtMtd = originalTotalTgtMtd > 0 ? originalTotalTgtMtd : (totTgtFull * elapsedDays / totalDays);
    const totTgtWtd = totTgtFull * wtdDays / totalDays;

    data[proj].total.actual_mtd = totActMtd;
    data[proj].total.actual_wtd = totActWtd;
    data[proj].total.actual_full = totActMtd;
    data[proj].total.target_mtd = totTgtMtd;
    data[proj].total.target_wtd = totTgtWtd;
    data[proj].total.target_full = totTgtFull;
    data[proj].total.actual = totActMtd;
    data[proj].total.target = totTgtFull;
    data[proj].total.pct = totTgtFull > 0 ? Math.round((totActMtd / totTgtFull * 100) * 10) / 10 : 0;

    processedRawRows.filter(r => r.Project === proj).forEach(r => {
      const d = r.Date_DD_MM;
      const reg = r['Mã vùng'];
      const c = normalizeCat(r.Category).replace(/\s+/g, '');
      const v = r.AMT;

      if (!data[proj].daily[d]) {
        data[proj].daily[d] = {};
      }
      if (!data[proj].daily[d][reg]) {
        data[proj].daily[d][reg] = { TOTAL: 0 };
      }
      data[proj].daily[d][reg][c] = (data[proj].daily[d][reg][c] || 0) + v;
      data[proj].daily[d][reg].TOTAL += v;
    });
  }

  const getSupervisor = (row: any) => {
    const storeCode = row['Mã cửa hàng'];
    const mapInfo = STORE_MAPPING[storeCode];
    if (mapInfo) {
      return mapInfo.sup;
    }
    const proj = row.Project;
    const region = row['Mã vùng'];
    if (proj === 'stmb') {
      return "CHIEN";
    }
    if (region === 'HN') return "CHIEN";
    if (region === 'NORTH') return "CHIEN";
    if (region === 'EAST') return "TUNG";
    if (region === 'CENTRAL') return "HOA";
    if (region === 'HCM') return "HOA";
    if (region === 'MEKONG') return "HOA";
    return "UNKNOWN";
  };

  processedRawRows.forEach(r => {
    r.Supervisor = getSupervisor(r);
    r.ISO_Week = getISOWeek(r['Ngày báo cáo']);
  });

  const uniqueWeekNums = [...new Set(processedRawRows.map(r => r.ISO_Week))].sort((a, b) => a - b);
  const weekMap: any = {};
  uniqueWeekNums.forEach((w, idx) => {
    weekMap[w] = `W ${idx + 1}`;
  });

  processedRawRows.forEach(r => {
    r.Week_Label = weekMap[r.ISO_Week];
  });

  const uniqueWeekLabels = uniqueWeekNums.map(w => weekMap[w]);

  const catLabelLocal = (cat: any) => {
    const m: any = {
      HAIRCARE: 'Hair Care',
      SHAVECARE: 'Shave Care',
      SKINCARE: 'Skin Care',
      LAUNDRY: 'Laundry',
      BVS: 'BVS',
      SAFEGUARD: 'Safeguard'
    };
    const k = String(cat).toUpperCase().replace(/\s+/g, '');
    return m[k] || cat;
  };

  const catsList = [...new Set(processedRawRows.map(r => r.Category))].sort();
  const soByWeekCat: any[] = [];
  catsList.forEach(cat => {
    const rowData: any = { category: catLabelLocal(cat) };
    let totalCat = 0;
    uniqueWeekLabels.forEach(w => {
      const val = mtdRows
        .filter(r => r.Category === cat && r.Week_Label === w)
        .reduce((s, r) => s + r.AMT, 0);
      rowData[w] = val;
      totalCat += val;
    });
    rowData.TOTAL = totalCat;
    soByWeekCat.push(rowData);
  });

  const totRowCat: any = { category: 'TOTAL' };
  uniqueWeekLabels.forEach(w => {
    totRowCat[w] = processedRawRows
      .filter(r => r.Week_Label === w)
      .reduce((s, r) => s + r.AMT, 0);
  });
  totRowCat.TOTAL = processedRawRows.reduce((s, r) => s + r.AMT, 0);
  soByWeekCat.push(totRowCat);

  const supsList = ['CHIEN', 'TUNG', 'HOA', 'KIET'];
  const soByWeekSup: any[] = [];
  supsList.forEach(sup => {
    const rowData: any = { supervisor: sup };
    let totalSup = 0;
    uniqueWeekLabels.forEach(w => {
      const val = mtdRows
        .filter(r => r.Supervisor === sup && r.Week_Label === w)
        .reduce((s, r) => s + r.AMT, 0);
      rowData[w] = val;
      totalSup += val;
    });
    rowData.TOTAL = totalSup;
    soByWeekSup.push(rowData);
  });

  const totRowSup: any = { supervisor: 'TOTAL' };
  uniqueWeekLabels.forEach(w => {
    totRowSup[w] = processedRawRows
      .filter(r => r.Week_Label === w)
      .reduce((s, r) => s + r.AMT, 0);
  });
  totRowSup.TOTAL = processedRawRows.reduce((s, r) => s + r.AMT, 0);
  soByWeekSup.push(totRowSup);

  const fullMonthCat: any[] = [];
  const mtdCat: any[] = [];
  catsList.forEach(cat => {
    const cLabel = catLabelLocal(cat);
    let tgtFull = 0;
    for (const proj of ['stmb', 'crv']) {
      if (data[proj] && data[proj].cats) {
        data[proj].cats.forEach((c: any) => {
          if (String(c.cat).toUpperCase().trim() === String(cat).toUpperCase().trim()) {
            tgtFull += c.target_full || c.target || 0;
          }
        });
      }
    }

    const actMtd = mtdRows
      .filter(r => r.Category === cat)
      .reduce((s, r) => s + r.AMT, 0);

    const pctFull = tgtFull > 0 ? (actMtd / tgtFull * 100) : 0;
    const gap = pctFull - timegonePct;

    fullMonthCat.push({
      category: cLabel,
      target: tgtFull,
      actual: actMtd,
      pct: pctFull,
      gap: gap
    });

    const tgtMtd = tgtFull * elapsedDays / totalDays;
    const pctMtd = tgtMtd > 0 ? (actMtd / tgtMtd * 100) : 0;

    mtdCat.push({
      category: cLabel,
      target: tgtMtd,
      actual: actMtd,
      pct: pctMtd
    });
  });

  const totTgtFullCat = fullMonthCat.reduce((s, x) => s + x.target, 0);
  const totActMtdCat = fullMonthCat.reduce((s, x) => s + x.actual, 0);
  const totPctFullCat = totTgtFullCat > 0 ? (totActMtdCat / totTgtFullCat * 100) : 0;
  const totGapCat = totPctFullCat - timegonePct;

  fullMonthCat.push({
    category: 'TOTAL',
    target: totTgtFullCat,
    actual: totActMtdCat,
    pct: totPctFullCat,
    gap: totGapCat
  });

  const totTgtMtdCat = totTgtFullCat * elapsedDays / totalDays;
  const totPctMtdCat = totTgtMtdCat > 0 ? (totActMtdCat / totTgtMtdCat * 100) : 0;

  mtdCat.push({
    category: 'TOTAL',
    target: totTgtMtdCat,
    actual: totActMtdCat,
    pct: totPctMtdCat
  });

  const regionsList = ['HN', 'EAST', 'HCM', 'NORTH', 'CENTRAL', 'MEKONG'];
  const fullMonthRegion: any[] = [];
  const mtdRegion: any[] = [];
  regionsList.forEach(reg => {
    let tgtFull = 0;
    if (data.crv && data.crv.regions && data.crv.regions[reg]) {
      tgtFull += data.crv.regions[reg].target_full || data.crv.regions[reg].target || 0;
    }
    if (reg === 'NORTH' && data.stmb && data.stmb.total) {
      tgtFull += data.stmb.total.target_full || data.stmb.total.target || 0;
    }

    const actMtd = mtdRows
      .filter(r => r['Mã vùng'] === reg)
      .reduce((s, r) => s + r.AMT, 0);

    const pctFull = tgtFull > 0 ? (actMtd / tgtFull * 100) : 0;
    const gap = pctFull - timegonePct;

    fullMonthRegion.push({
      region: reg,
      target: tgtFull,
      actual: actMtd,
      pct: pctFull,
      gap: gap
    });

    const tgtMtd = tgtFull * elapsedDays / totalDays;
    const pctMtd = tgtMtd > 0 ? (actMtd / tgtMtd * 100) : 0;

    mtdRegion.push({
      region: reg,
      target: tgtMtd,
      actual: actMtd,
      pct: pctMtd
    });
  });

  const totTgtFullReg = fullMonthRegion.reduce((s, x) => s + x.target, 0);
  const totActMtdReg = fullMonthRegion.reduce((s, x) => s + x.actual, 0);
  const totPctFullReg = totTgtFullReg > 0 ? (totActMtdReg / totTgtFullReg * 100) : 0;
  const totGapReg = totPctFullReg - timegonePct;

  fullMonthRegion.push({
    region: 'TOTAL',
    target: totTgtFullReg,
    actual: totActMtdReg,
    pct: totPctFullReg,
    gap: totGapReg
  });

  const totTgtMtdReg = totTgtFullReg * elapsedDays / totalDays;
  const totPctMtdReg = totTgtMtdReg > 0 ? (totActMtdReg / totTgtMtdReg * 100) : 0;

  mtdRegion.push({
    region: 'TOTAL',
    target: totTgtMtdReg,
    actual: totActMtdReg,
    pct: totPctMtdReg
  });

  const supTargets: any = {
    CHIEN: 0, TUNG: 0, HOA: 0, KIET: 0
  };
  ['stmb', 'crv'].forEach(proj => {
    if (data[proj] && data[proj].stores) {
      data[proj].stores.forEach((store: any) => {
        const storeCode = store.code;
        const mapInfo = STORE_MAPPING[storeCode];
        const sup = mapInfo ? mapInfo.sup : "UNKNOWN";
        if (supTargets[sup] !== undefined) {
          supTargets[sup] += store.target_full || store.target || 0;
        }
      });
    }
  });

  const mtdSup: any[] = [];
  supsList.forEach(sup => {
    const tgtFull = supTargets[sup] || 0;
    const tgtMtd = tgtFull * elapsedDays / totalDays;
    const actMtd = mtdRows
      .filter(r => r.Supervisor === sup)
      .reduce((s, r) => s + r.AMT, 0);
    const pctMtd = tgtMtd > 0 ? (actMtd / tgtMtd * 100) : 0;

    mtdSup.push({
      supervisor: sup,
      target: tgtMtd,
      actual: actMtd,
      pct: pctMtd
    });
  });

  const totTgtMtdSup = mtdSup.reduce((s, x) => s + x.target, 0);
  const totActMtdSup = mtdSup.reduce((s, x) => s + x.actual, 0);
  const totPctMtdSup = totTgtMtdSup > 0 ? (totActMtdSup / totTgtMtdSup * 100) : 0;

  mtdSup.push({
    supervisor: 'TOTAL',
    target: totTgtMtdSup,
    actual: totActMtdSup,
    pct: totPctMtdSup
  });

  const shiftsRegion: any[] = [];
  regionsList.forEach(reg => {
    // Dynamic shift targets summed from all stores under this region (File 1 & File 2)
    let regTgtShifts = 0;
    Object.entries(STORE_MAPPING).forEach(([code, info]) => {
      if (info.region === reg) {
        const conf = STORE_SHIFT_CONFIGS[info.storeName];
        const wDays = conf ? conf.workDaysPerWeek : 3;
        regTgtShifts += (wDays / 6) * 26 * elapsedDays / totalDays;
      }
    });

    const uniquePairs = new Set();
    processedRawRows.filter(r => r['Mã vùng'] === reg).forEach(r => {
      const formattedDate = formatDateYYYYMMDD(r['Ngày báo cáo']);
      uniquePairs.add(`${r['Mã nhân viên']}||${formattedDate}`);
    });

    const actShifts = uniquePairs.size;
    const pctShifts = regTgtShifts > 0 ? (actShifts / regTgtShifts * 100) : 0;

    shiftsRegion.push({
      region: reg,
      target: regTgtShifts,
      actual: actShifts,
      pct: pctShifts
    });
  });

  const totTgtShiftsReg = shiftsRegion.reduce((s, x) => s + x.target, 0);
  const totActShiftsReg = shiftsRegion.reduce((s, x) => s + x.actual, 0);
  const totPctShiftsReg = totTgtShiftsReg > 0 ? (totActShiftsReg / totTgtShiftsReg * 100) : 0;

  shiftsRegion.push({
    region: 'TOTAL',
    target: totTgtShiftsReg,
    actual: totActShiftsReg,
    pct: totPctShiftsReg
  });

  const shiftsSup: any[] = [];
  supsList.forEach(sup => {
    // Dynamic shift targets summed from all stores managed by this supervisor (File 1 & File 2)
    let supTgtShifts = 0;
    Object.entries(STORE_MAPPING).forEach(([code, info]) => {
      if (info.sup === sup) {
        const conf = STORE_SHIFT_CONFIGS[info.storeName];
        const wDays = conf ? conf.workDaysPerWeek : 3;
        supTgtShifts += (wDays / 6) * 26 * elapsedDays / totalDays;
      }
    });

    const uniquePairs = new Set();
    processedRawRows.filter(r => r.Supervisor === sup).forEach(r => {
      const formattedDate = formatDateYYYYMMDD(r['Ngày báo cáo']);
      uniquePairs.add(`${r['Mã nhân viên']}||${formattedDate}`);
    });

    const actShifts = uniquePairs.size;
    const pctShifts = supTgtShifts > 0 ? (actShifts / supTgtShifts * 100) : 0;

    shiftsSup.push({
      supervisor: sup,
      target: supTgtShifts,
      actual: actShifts,
      pct: pctShifts
    });
  });

  const totTgtShiftsSup = shiftsSup.reduce((s, x) => s + x.target, 0);
  const totActShiftsSup = shiftsSup.reduce((s, x) => s + x.actual, 0);
  const totPctShiftsSup = totTgtShiftsSup > 0 ? (totActShiftsSup / totTgtShiftsSup * 100) : 0;

  shiftsSup.push({
    supervisor: 'TOTAL',
    target: totTgtShiftsSup,
    actual: totActShiftsSup,
    pct: totPctShiftsSup
  });

  const weeklyGroupMap: any = {};
  processedRawRows.forEach(r => {
    const key = `${r.Project}||${r['Mã vùng']}||${r.Supervisor}||${r.Category}||${r.Week_Label}`;
    weeklyGroupMap[key] = (weeklyGroupMap[key] || 0) + r.AMT;
  });

  const weeklyData: any[] = [];
  for (const [key, amt] of Object.entries(weeklyGroupMap) as any) {
    const [proj, reg, sup, cat, weekLabel] = key.split('||');
    weeklyData.push({
      Project: proj,
      "Mã vùng": reg,
      Supervisor: sup,
      Category: cat,
      Week_Label: weekLabel,
      AMT: amt
    });
  }

  const shiftsUniqueMap = new Set();
  processedRawRows.forEach(r => {
    const formattedDate = formatDateYYYYMMDD(r['Ngày báo cáo']);
    shiftsUniqueMap.add(`${r.Project}||${r['Mã vùng']}||${r.Supervisor}||${r['Mã nhân viên']}||${formattedDate}`);
  });

  const shiftsGroupMap: any = {};
  shiftsUniqueMap.forEach(item => {
    const [proj, reg, sup, emp, date] = (item as string).split('||');
    const groupKey = `${proj}||${reg}||${sup}`;
    shiftsGroupMap[groupKey] = (shiftsGroupMap[groupKey] || 0) + 1;
  });

  const shiftsData: any[] = [];
  for (const [groupKey, count] of Object.entries(shiftsGroupMap) as any) {
    const [proj, reg, sup] = groupKey.split('||');
    shiftsData.push({
      Project: proj,
      "Mã vùng": reg,
      Supervisor: sup,
      actual_shifts: count
    });
  }

  data.tables_data = {
    so_by_week_cat: soByWeekCat,
    so_by_week_sup: soByWeekSup,
    full_month_cat: fullMonthCat,
    full_month_region: fullMonthRegion,
    mtd_cat: mtdCat,
    mtd_region: mtdRegion,
    mtd_sup: mtdSup,
    shifts_region: shiftsRegion,
    shifts_sup: shiftsSup,
    unique_weeks: uniqueWeekLabels,
    weekly_data: weeklyData,
    shifts_data: shiftsData
  };
  data.rawRows = processedRawRows;

  return data;
};

/* === Dynamic Client-Side HTML Bundler === */
export const downloadCompiledHTML = () => {
  try {
    if ((window as any).addDashboardLog) {
      (window as any).addDashboardLog("📦 Đang khởi tạo quy trình đóng gói Báo cáo HTML độc lập...");
    }
    
    // 1. Title and document tags
    const title = document.title || "Interdist · P&G Sales Ops";
    const fontLinks = Array.from(document.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]'))
      .map(el => el.outerHTML)
      .join('\n');
      
    // 2. CSS Styles (grab from active style sheets/tags)
    let cssContent = '';
    const styleTags = document.querySelectorAll('style');
    if (styleTags.length > 0) {
      styleTags.forEach(tag => {
        cssContent += tag.innerHTML + '\n';
      });
    }

    // 3. Reconstruct logging infrastructure & tweaks
    const loggerScript = `
  window.__DASHBOARD_LOGS = [];
  (window as any).addDashboardLog = function(msg) {
    var time = new Date().toLocaleTimeString('vi-VN');
    var logItem = "[" + time + "] " + msg;
    console.log(logItem);
    window.__DASHBOARD_LOGS.push(logItem);
    if (window.__triggerDebugRender) {
      try { window.__triggerDebugRender(); } catch(e) {}
    }
  };
  (window as any).onerror = function(message, source, lineno, colno, error) {
    var errorMsg = "L\u1ed2I H\u1ec6 TH\u1ed0NG: " + message + " (D\u00f2ng " + lineno + ")";
    (window as any).addDashboardLog("\u274c " + errorMsg);
    var errDiv = document.createElement("div");
    errDiv.style = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999999;background:#ef4444;color:white;padding:12px 20px;border-radius:8px;font-size:12px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px;";
    errDiv.innerHTML = "\\x3cspan\\x3e\u26a0\ufe0f \\x3cb\\x3eL\u1ed7i h\u1ec7 th\u1ed1ng:\\x3c/b\\x3e " + message + " (D\u00f2ng " + lineno + ")\\x3c/span\\x3e\\x3cbutton onclick=\\'this.parentElement.remove()\\' style=\\'border:none;background:rgba(255,255,255,0.2);color:white;cursor:pointer;border-radius:4px;padding:2px 6px;\\'\\x3e\u2715\\x3c/button\\x3e";
    document.body.appendChild(errDiv);
    return false;
  };
  (window as any).__INITIAL_TWEAKS = ${JSON.stringify((window as any).__INITIAL_TWEAKS || { theme: "light", density: "comfortable", accentChannel: "both", showActionRail: true })};
  (window as any).addDashboardLog("Kh\u1edfi t\u1ea1o h\u1ec7 th\u1ed1ng th\u00e0nh c\u00f4ng.");
    `;

    // 4. Serialize current active dataset
    const dataScript = `(window as any).INTERDIST_DATA = ${JSON.stringify((window as any).INTERDIST_DATA)};`;

    // 5. Gather raw JSX source codes in correct order
    let jsxContent = '';
    const babelScripts = document.querySelectorAll('script[type="text/babel"]');
    if (babelScripts.length > 0) {
      babelScripts.forEach(script => {
        jsxContent += `\n// --- ${(script as any).src || 'Inlined JSX Source'} ---\n` + script.textContent + '\n';
      });
    }

    // 6. Assemble standalone offline-ready HTML (escaping < to avoid Babel JSX tokenization bugs)
    const htmlOutput = `\x3C!DOCTYPE html>
\x3Chtml lang="vi">
\x3Chead>
  \x3Cmeta charset="utf-8" />
  \x3Ctitle>${title}\x3C/title>
  \x3Cmeta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  ${fontLinks}
  \x3Cstyle>
    ${cssContent}
  \x3C/style>
  \x3Cscript src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js">\x3C/script>
  \x3Cscript src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js">\x3C/script>
  \x3Cscript>
    ${loggerScript}
  \x3C/script>
\x3C/head>
\x3Cbody>
  \x3Ctemplate id="__bundler_thumbnail" data-bg-color="#faf9f6">
    \x3Csvg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
      \x3Crect width="1200" height="800" fill="#faf9f6"/>
      \x3Cg transform="translate(540 280)">
        \x3Crect x="0" y="0" width="56" height="56" rx="8" fill="#1a1815"/>
        \x3Crect x="64" y="0" width="56" height="56" rx="8" fill="#1a1815" opacity="0.55"/>
        \x3Crect x="0" y="64" width="56" height="56" rx="8" fill="#1a1815" opacity="0.55"/>
        \x3Crect x="64" y="64" width="56" height="56" rx="8" fill="#d35400"/>
      \x3C/g>
      \x3Ctext x="600" y="500" font-family="IBM Plex Sans, sans-serif" font-size="42" font-weight="700" fill="#1a1815" text-anchor="middle" letter-spacing="-1">Interdist\x3C/text>
      \x3Ctext x="600" y="540" font-family="IBM Plex Mono, monospace" font-size="14" fill="#94907f" text-anchor="middle" letter-spacing="3">P&amp;G · SALES OPS\x3C/text>
    \x3C/svg>
  \x3C/template>
  \x3Cdiv id="root">\x3C/div>

  \x3Cscript src="https://unpkg.com/react@18.3.1/umd/react.development.js">\x3C/script>
  \x3Cscript src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js">\x3C/script>
  \x3Cscript src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js">\x3C/script>

  \x3Cscript>
    ${dataScript}
  \x3C/script>

  \x3Cscript type="text/babel">
    ${jsxContent}
  \x3C/script>
\x3C/body>
\x3C/html>`;

    // 7. Download
    const blob = new Blob([htmlOutput], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const meta = (window as any).INTERDIST_DATA?.crv?.meta || { updated_to: 'new' };
    
    a.href = url;
    a.download = `PG_Interdist_Dashboard_${meta.updated_to}.html`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if ((window as any).addDashboardLog) {
      (window as any).addDashboardLog("✅ Đã xuất Báo cáo HTML độc lập thành công!");
    }
  } catch (err) {
    if ((window as any).addDashboardLog) {
      (window as any).addDashboardLog("❌ Lỗi xuất Báo cáo HTML: " + err.message);
    }
    alert("Không thể đóng gói HTML: " + err.message);
  }
};
