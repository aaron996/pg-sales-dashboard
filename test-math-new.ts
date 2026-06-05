import { DEFAULT_BASELINE_DATA } from './src/data';

// Let's analyze.
// 1. Is 11042639100 a sum of daily totals?
const crvDaily = DEFAULT_BASELINE_DATA.crv?.daily || {};
const stmbDaily = DEFAULT_BASELINE_DATA.stmb?.daily || {};

let crvDailyTotal = 0;
const crvDailyDatesSum: Record<string, number> = {};
Object.entries(crvDaily).forEach(([date, dayObj]: any) => {
  let daySum = 0;
  Object.values(dayObj).forEach((regObj: any) => {
    daySum += regObj.TOTAL || 0;
  });
  crvDailyDatesSum[date] = daySum;
  crvDailyTotal += daySum;
});

let stmbDailyTotal = 0;
const stmbDailyDatesSum: Record<string, number> = {};
Object.entries(stmbDaily).forEach(([date, dayObj]: any) => {
  let daySum = 0;
  Object.values(dayObj).forEach((regObj: any) => {
    daySum += regObj.TOTAL || 0;
  });
  stmbDailyDatesSum[date] = daySum;
  stmbDailyTotal += daySum;
});

console.log("CRV Daily Sum:", crvDailyTotal);
console.log("STMB Daily Sum:", stmbDailyTotal);
console.log("Combined Daily Sum:", crvDailyTotal + stmbDailyTotal);

// 2. What if we sum actual_mtd from CRV and STMB stores?
// What if we do NOT deduplicate?
const crvStores = DEFAULT_BASELINE_DATA.crv?.stores || [];
const stmbStores = DEFAULT_BASELINE_DATA.stmb?.stores || [];

// Let's check if there are 26 unique stores. What if we don't deduplicate at all?
// Combined Raw store actual_mtd sum is 12,481,697,200.
// Deduplicated stores actual_mtd sum is 8,172,549,700.
// Is 11,042,639,100 close to something?
// Let's check: 12481697200 - 11042639100 = 1439058100.
// Is 1,439,058,100 the sum of some duplicated store?
// Let's print out the duplicates and their actual_mtd values:
const duplicates: any[] = [];
const seen = new Set();
crvStores.forEach((s: any) => {
  if (seen.has(s.code)) {
    duplicates.push(s);
  }
  seen.add(s.code);
});

console.log("Duplicates in CRV and their actual_mtd:");
let dupSum = 0;
duplicates.forEach(d => {
  console.log(`  Code: ${d.code} | Store: ${d.store} | actual_mtd: ${d.actual_mtd}`);
  dupSum += d.actual_mtd || 0;
});
console.log("Sum of duplicates:", dupSum);
console.log("COMBINED Raw Sum minus Sum of duplicates:", (crvRawSum() + stmbRawSum()) - dupSum);

function crvRawSum() {
  return crvStores.reduce((sum: number, s: any) => sum + (s.actual_mtd || 0), 0);
}
function stmbRawSum() {
  return stmbStores.reduce((sum: number, s: any) => sum + (s.actual_mtd || 0), 0);
}

// 3. Let's look for 11042639100 as the sum if we only sum STORES from CRV + STMB that match some criteria
// Or what if we don't deduplicate CRV, but we deduplicate STMB? Or vice-versa?
// What if we don't deduplicate at all? Wait, why is there deduplication?
// Let's read DEFAULT_BASELINE_DATA crv stores names and codes to see why we have 40 stores.
console.log("First 15 CRV stores in DEFAULT_BASELINE_DATA:");
crvStores.slice(0, 15).forEach((s: any) => {
  console.log(`  - Code: ${s.code} | Store: ${s.store} | actual_mtd: ${s.actual_mtd}`);
});

console.log("Last 15 CRV stores in DEFAULT_BASELINE_DATA:");
crvStores.slice(-15).forEach((s: any) => {
  console.log(`  - Code: ${s.code} | Store: ${s.store} | actual_mtd: ${s.actual_mtd}`);
});
