import { processExcelData } from './excelParser';
import { DEFAULT_BASELINE_DATA } from './data';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

(global as any).window = { XLSX };

// read the CSV from the user's prompt (I will just create a tiny version of it)
const crvCSV = `M bo co,Tn bo co,M ng??i duy?t / h?y,Tn ng??i duy?t / h?y,M ng??i ?nh gi,Tn ng??i ?nh gi,M nhn vin,Tn nhn vin,Knh,M c?a hng,Tn c?a hng,M vng,Ngy bo co,Gi? bo co,Tr?ng thi,C hnh,HAIRCARE.H&S-DG-BAC HA-330ML,HAIRCARE.H&S-DG-DA DAU NGUA-330ML
SO - CRV,BAO CAO BAN HANG - CRV,-,-,-,-,GOLT008,Nguyen Ngoc Cham,BIGC,BIGC0011,GO Go Vap,HCM,5/1/2026,21:02,M?i,0,2,0
SO - CRV,BAO CAO BAN HANG - CRV,-,-,-,-,GOLT008,Nguyen Ngoc Cham,BIGC,BIGC0011,GO Go Vap,HCM,5/31/2026,21:02,M?i,0,0,3`;
const stmbCSV = `M bo co,Tn bo co,M ng??i duy?t / h?y,Tn ng??i duy?t / h?y,M ng??i ?nh gi,Tn ng??i ?nh gi,M nhn vin,Tn nhn vin,Knh,M c?a hng,Tn c?a hng,M vng,Ngy bo co,Gi? bo co,Tr?ng thi,C hnh,HAIRCARE.H&S-DG-BAC HA-330ML,HAIRCARE.H&S-DG-DA DAU NGUA-330ML
SO STMB,BAO CAO BAN HANG,-,-,-,-,STMB053,Le Thi Thao,LCM,LCM010,Lan Chi,NORTH,5/1/2026,10:59,M?i,0,0,1`;

const crvAb = Buffer.from(crvCSV, 'utf-8');
const stmbAb = Buffer.from(stmbCSV, 'utf-8');

try {
  const result = processExcelData([{ name: "crv.csv", data: crvAb }, { name: "stmb.csv", data: stmbAb }], DEFAULT_BASELINE_DATA);
  console.log("SUCCESS!");
  console.log("CRV Actual MTD Total:", result.crv.total.actual_mtd);
  console.log("STMB Actual MTD Total:", result.stmb.total.actual_mtd);
  console.log("Raw Rows Length:", result.rawRows.length);
  if (result.rawRows.length > 0) {
    console.log("First raw row:", result.rawRows[0]);
  }
} catch (e) {
  console.error("FAIL:", e.stack || e.message);
}

