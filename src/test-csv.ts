import * as XLSX from 'xlsx';

const str = "A,B,HAIRCARE\n1,2,3";
const wb = XLSX.read(str, { type: 'string' });
console.log(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
