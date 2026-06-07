import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase, handleFirestoreError, OperationType } from '../lib/supabase';
import { 
  PRODUCT_PRICES, STORE_MAPPING, STORE_SHIFT_CONFIGS, CUSTOM_TARGETS,
  setDynamicProductPrices, setDynamicStoreMapping, setDynamicStoreShiftConfigs, setDynamicCustomTargets,
  getStoreTarget, StoreMapInfo
} from '../configData';
import { 
  DollarSign, Users, Target, Download, Save, Search, Plus, Trash2, 
  RefreshCw, CheckCircle, AlertCircle, Edit, FileSpreadsheet, Upload, Info,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check
} from 'lucide-react';

export async function loadSystemConfigurations() {
  try {
    const { data: pricesData } = await supabase
      .from('configurations')
      .select('value')
      .eq('key', 'productPrices')
      .maybeSingle();
    if (pricesData?.value?.data && Object.keys(pricesData.value.data).length > 0) {
      setDynamicProductPrices(pricesData.value.data);
    }

    const { data: mappingData } = await supabase
      .from('configurations')
      .select('value')
      .eq('key', 'storeMapping')
      .maybeSingle();
    if (mappingData?.value?.data && Object.keys(mappingData.value.data).length > 0) {
      setDynamicStoreMapping(mappingData.value.data);
    }

    const { data: targetData } = await supabase
      .from('configurations')
      .select('value')
      .eq('key', 'storeTargets')
      .maybeSingle();
    if (targetData?.value?.data) {
      setDynamicCustomTargets(targetData.value.data);
    }
  } catch (error) {
    console.error("Failed to load custom configurations from Supabase:", error);
  }
}

interface ConfigurePanelProps {
  onConfigChanged: () => void;
  interdistData: any;
}

export default function ConfigurePanel({ onConfigChanged, interdistData }: ConfigurePanelProps) {
  const [activeTab, setActiveTab] = useState<'prices' | 'sups' | 'targets' | 'excel'>('prices');
  
  // Status banner / toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' | null }>({
    message: '',
    type: null
  });

  const showToast = (message: string, type: 'success' | 'error' | 'loading') => {
    setToast({ message, type });
    if (type !== 'loading') {
      setTimeout(() => {
        setToast(prev => prev.message === message ? { message: '', type: null } : prev);
      }, 4000);
    }
  };

  const clearToast = () => {
    setToast({ message: '', type: null });
  };

  // --- TAB 1: PRODUCT PRICING ---
  const [pricesList, setPricesList] = useState(() => ({ ...PRODUCT_PRICES }));
  const [priceSearch, setPriceSearch] = useState('');
  const [pricesPage, setPricesPage] = useState(1);
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');

  const filteredPrices = useMemo(() => {
    return Object.entries(pricesList)
      .filter(([sku]) => sku.toLowerCase().includes(priceSearch.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [pricesList, priceSearch]);

  const itemsPerPage = 20;
  const totalPricesPages = Math.ceil(filteredPrices.length / itemsPerPage);
  
  // Guard current page check
  const safePricesPage = Math.min(Math.max(1, pricesPage), totalPricesPages || 1);

  const paginatedPrices = useMemo(() => {
    const start = (safePricesPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredPrices.slice(start, end);
  }, [filteredPrices, safePricesPage]);

  const handleAddPrice = () => {
    if (!newSku.trim()) {
      showToast('Vui lòng nhập mã sản phẩm (SKU)!', 'error');
      return;
    }
    const pVal = parseFloat(newPrice);
    if (isNaN(pVal) || pVal < 0) {
      showToast('Đơn giá phải là số dương hợp lệ!', 'error');
      return;
    }
    const skuUpper = newSku.trim().toUpperCase();
    setPricesList(prev => ({
      ...prev,
      [skuUpper]: pVal
    }));
    setNewSku('');
    setNewPrice('');
    showToast(`Đã thêm tạm thời SKU ${skuUpper}. Hãy nhấn "Lưu bảng giá cloud" để đồng bộ vĩnh viễn!`, 'success');
  };

  const handleDeletePrice = (sku: string) => {
    setPricesList(prev => {
      const copy = { ...prev };
      delete copy[sku];
      return copy;
    });
    showToast(`Đã xóa tạm thời SKU ${sku}. Nhớ nhấn "Lưu bảng giá cloud" để áp dụng lên hệ thống!`, 'success');
  };

  const handleUpdatePriceInline = (sku: string) => {
    const pVal = parseFloat(editingPriceVal);
    if (isNaN(pVal) || pVal < 0) {
      showToast('Đơn giá không hợp lệ!', 'error');
      return;
    }
    setPricesList(prev => ({
      ...prev,
      [sku]: pVal
    }));
    setEditingSku(null);
    showToast(`Đã cập nhật đơn giá của ${sku}. Nhấn "Lưu bảng giá cloud" để đồng bộ!`, 'success');
  };

  const handleSavePricesToFirebase = async () => {
    showToast('Đang lưu bảng giá lên cơ sở dữ liệu cloud...', 'loading');
    try {
      const { error } = await supabase.from('configurations').upsert({
        key: 'productPrices',
        value: { data: pricesList, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) throw error;
      setDynamicProductPrices(pricesList);
      onConfigChanged();
      showToast('Đã đồng bộ & lưu bảng giá thành công lên hệ thống!', 'success');
    } catch (e) {
      showToast('Lỗi lưu bảng giá. Vui lòng kiểm tra kết nối!', 'error');
      handleFirestoreError(e, OperationType.WRITE, 'configurations/productPrices');
    }
  };


  // --- TAB 2: STORE MAPPINGS & SUPERVISORS ---
  const [storeMapList, setStoreMapList] = useState<Record<string, StoreMapInfo>>(() => ({ ...STORE_MAPPING }));
  const [storeSearch, setStoreSearch] = useState('');
  const [editingStoreCode, setEditingStoreCode] = useState<string | null>(null);
  const [editSupField, setEditSupField] = useState('');
  const [editRegionField, setEditRegionField] = useState('');
  const [editNameField, setEditNameField] = useState('');

  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreSup, setNewStoreSup] = useState('CHIEN');
  const [newStoreRegion, setNewStoreRegion] = useState('NORTH');

  const supsList = ['CHIEN', 'TUNG', 'HOA', 'KIET', 'NAM'];
  const regionsList = ['HN', 'NORTH', 'CENTRAL', 'EAST', 'HCM', 'MEKONG'];

  const filteredStores = useMemo(() => {
    return (Object.values(storeMapList) as StoreMapInfo[])
      .filter(item => 
        (item.storeCode || '').toLowerCase().includes(storeSearch.toLowerCase()) ||
        (item.storeName || '').toLowerCase().includes(storeSearch.toLowerCase()) ||
         (item.sup || '').toLowerCase().includes(storeSearch.toLowerCase())
      )
      .sort((a, b) => (a.storeCode || '').localeCompare(b.storeCode || ''));
  }, [storeMapList, storeSearch]);

  const handleAddStoreMap = () => {
    const code = newStoreCode.trim().toUpperCase();
    const name = newStoreName.trim();
    if (!code || !name) {
      showToast('Vui lòng điền mã cửa hàng và tên cửa hàng!', 'error');
      return;
    }
    setStoreMapList(prev => ({
      ...prev,
      [code]: {
        storeCode: code,
        storeName: name,
        sup: newStoreSup,
        region: newStoreRegion
      }
    }));
    setNewStoreCode('');
    setNewStoreName('');
    showToast(`Đã thêm cửa hàng ${code} vào bộ nhớ tạm. Nhấp "Lưu ánh xạ SUP cloud" để hoàn tất!`, 'success');
  };

  const handleDeleteStoreMap = (code: string) => {
    setStoreMapList(prev => {
      const copy = { ...prev };
      delete copy[code];
      return copy;
    });
    showToast(`Đã gỡ cửa hàng ${code}. Nhấn "Lưu ánh xạ SUP cloud" để đồng bộ vĩnh viễn!`, 'success');
  };

  const handleUpdateStoreInline = (code: string) => {
    if (!editSupField.trim()) {
      showToast('Supervisor không được bỏ trống!', 'error');
      return;
    }
    setStoreMapList(prev => ({
      ...prev,
      [code]: {
         ...prev[code],
         storeName: editNameField.trim() || prev[code].storeName,
         sup: editSupField.trim().toUpperCase(),
         region: editRegionField.trim().toUpperCase()
      }
    }));
    setEditingStoreCode(null);
    showToast(`Đã chỉnh sửa thông tin cho ${code}. Nhớ bấm "Lưu ánh xạ SUP cloud" để ghi nhận!`, 'success');
  };

  const handleSaveStoreMapToFirebase = async () => {
    showToast('Đang lưu thông tin ánh xạ cửa hàng & SUP lên cloud...', 'loading');
    try {
      const { error } = await supabase.from('configurations').upsert({
        key: 'storeMapping',
        value: { data: storeMapList, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) throw error;
      setDynamicStoreMapping(storeMapList);
      onConfigChanged();
      showToast('Đã lưu danh sách ánh xạ SUP & Cửa hàng thành công vĩnh viễn!', 'success');
    } catch (e) {
      showToast('Lỗi lưu danh sách store mapping. Hãy thử lại!', 'error');
      handleFirestoreError(e, OperationType.WRITE, 'configurations/storeMapping');
    }
  };


  // --- TAB 3: TARGETS CONFIGURATIONS ---
  const [customTargetsList, setCustomTargetsList] = useState<Record<string, number>>(() => ({ ...CUSTOM_TARGETS }));
  const [targetSearch, setTargetSearch] = useState('');
  const [editingTargetCode, setEditingTargetCode] = useState<string | null>(null);
  const [newTargetVal, setNewTargetVal] = useState('');

  const activeStores = useMemo(() => {
    const list: Array<{ code: string; name: string; project: string; baseTarget: number }> = [];
    const seen = new Set<string>();

    ['stmb', 'crv'].forEach(proj => {
      const stores = interdistData?.[proj]?.stores || [];
      stores.forEach((s: any) => {
        const code = s.code || '';
        const name = s.store || s.name || '';
        const key = `${proj}-${code || name}`;
        if (seen.has(key)) return;
        seen.add(key);

        const baseTarget = s.target_full || s.target || 0;
        list.push({
          code,
          name,
          project: proj.toUpperCase(),
          baseTarget
        });
      });
    });

    return list.filter(item => 
      item.code.toLowerCase().includes(targetSearch.toLowerCase()) ||
      item.name.toLowerCase().includes(targetSearch.toLowerCase()) ||
      item.project.toLowerCase().includes(targetSearch.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [interdistData, targetSearch]);

  const handleUpdateTarget = (code: string | null, name: string) => {
    const key = code || name;
    const value = parseFloat(newTargetVal.replace(/[^0-9]/g, ''));
    if (isNaN(value) || value < 0) {
      showToast('Vui lòng nhập giá trị target hợp lệ!', 'error');
      return;
    }

    setCustomTargetsList(prev => ({
      ...prev,
      [key]: value
    }));
    setEditingTargetCode(null);
    setNewTargetVal('');
    showToast(`Đã ghi nhận target mới cho ${name}. Nhớ bấm "Áp dụng Target lên hệ thống" để lưu!`, 'success');
  };

  const handleClearCustomTarget = (key: string) => {
    setCustomTargetsList(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    showToast(`Đã reset target của cửa hàng về mặc định trong bộ nhớ tạm.`, 'success');
  };

  const handleSaveTargetsToFirebase = async () => {
    showToast('Đang đồng bộ cấu hình target lên cơ sở dữ liệu cloud...', 'loading');
    try {
      const { error } = await supabase.from('configurations').upsert({
        key: 'storeTargets',
        value: { data: customTargetsList, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) throw error;
      setDynamicCustomTargets(customTargetsList);
      onConfigChanged();
      showToast('Thành công! Đã đồng bộ & áp dụng cấu hình Target mới lên dashboard!', 'success');
    } catch (e) {
      showToast('Không thể lưu cấu hình target!', 'error');
      handleFirestoreError(e, OperationType.WRITE, 'configurations/storeTargets');
    }
  };


  // --- TAB 4: EXCEL EXPORTER / DOWNLOAD TEMPLATE ---
  const handleExportSystemConfigs = () => {
    showToast('Đang xuất cấu hình hệ thống ra Excel...', 'loading');
    try {
      // 1. Sheet Bảng Giá
      const pRows = Object.entries(pricesList).map(([sku, val]) => ({
        'SKU Sản phẩm': sku,
        'Ngành hàng': sku.split('.')[0] || 'Chưa phân loại',
        'Đơn Giá (VND)': val
      }));
      const wsPrices = XLSX.utils.json_to_sheet(pRows);

      // 2. Sheet Ánh xạ Store
      const smRows = (Object.values(storeMapList) as StoreMapInfo[]).map(m => ({
        'Mã Cửa Hàng (Store Code)': m.storeCode,
        'Tên Cửa Hàng (Store Name)': m.storeName,
        'Supervisor phụ trách (SUP)': m.sup,
        'Khu Vực (Region)': m.region
      }));
      const wsStoreMap = XLSX.utils.json_to_sheet(smRows);

      // 3. Sheet Target hiện hành
      const activeTargetsRows = activeStores.map(s => {
        const key = s.code || s.name;
        const currentTargetVal = customTargetsList[key] !== undefined ? customTargetsList[key] : s.baseTarget;
        const isCustomized = customTargetsList[key] !== undefined ? 'Đã tùy chỉnh' : 'Target gốc Excel';

        return {
          'Mã Cửa Hàng': s.code,
          'Tên Cửa Hàng': s.name,
          'Dự Án': s.project,
          'Target Gốc': s.baseTarget,
          'Target Hiện Hành (VND)': currentTargetVal,
          'Trạng Thế': isCustomized
        };
      });
      const wsTargets = XLSX.utils.json_to_sheet(activeTargetsRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsPrices, 'Bang_Gia_SKU');
      XLSX.utils.book_append_sheet(wb, wsStoreMap, 'Danh_Sach_SUP_Store');
      XLSX.utils.book_append_sheet(wb, wsTargets, 'Cau_Hinh_Targets');

      XLSX.writeFile(wb, `Cau_Hinh_Hethong_Interdist_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Đã tải tệp Excel cấu hình hệ thống thành công!', 'success');
    } catch (err) {
      showToast('Gặp lỗi khi xuất tệp tin Excel!', 'error');
      console.error(err);
    }
  };

  const handleDownloadBlankTemplate = () => {
    showToast('Đang tạo tệp Excel mẫu chuẩn...', 'loading');
    try {
      // 1. Sheet Bảng Giá
      const pRows = [
        {
          'SKU Sản phẩm': 'CRV.HAIRCARE.PANTENE_300ML',
          'Ngành hàng': 'CRV',
          'Đơn Giá (VND)': 120000
        }
      ];
      const wsPrices = XLSX.utils.json_to_sheet(pRows);

      // 2. Sheet Ánh xạ Store
      const smRows = [
        {
          'Mã Cửa Hàng (Store Code)': 'COOP_LY_THUONG_KIET',
          'Tên Cửa Hàng (Store Name)': 'Co.opmart Lý Thường Kiệt',
          'Supervisor phụ trách (SUP)': 'HOA',
          'Khu Vực (Region)': 'HCM'
        }
      ];
      const wsStoreMap = XLSX.utils.json_to_sheet(smRows);

      // 3. Sheet Target hiện hành
      const activeTargetsRows = [
        {
          'Mã Cửa Hàng': 'COOP_LY_THUONG_KIET',
          'Tên Cửa Hàng': 'Co.opmart Lý Thường Kiệt',
          'Dự Án': 'crv',
          'Target Gốc': 50000000,
          'Target Hiện Hành (VND)': 50000000,
          'Trạng Thế': 'Target gốc Excel'
        }
      ];
      const wsTargets = XLSX.utils.json_to_sheet(activeTargetsRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsPrices, 'Bang_Gia_SKU');
      XLSX.utils.book_append_sheet(wb, wsStoreMap, 'Danh_Sach_SUP_Store');
      XLSX.utils.book_append_sheet(wb, wsTargets, 'Cau_Hinh_Targets');

      XLSX.writeFile(wb, `Mau_Cau_Hinh_Hethong_Interdist.xlsx`);
      showToast('Đã tải tệp Excel mẫu chuẩn thành công!', 'success');
    } catch (err) {
      showToast('Gặp lỗi khi tạo tệp tin mẫu chuẩn!', 'error');
      console.error(err);
    }
  };


  // --- NEW FEATURE: IMPORT EXCEL CONFIGURATION SHEET ---
  const [importResults, setImportResults] = useState<{
    success: boolean;
    skuCount: number;
    storeCount: number;
    targetCount: number;
    details: string[];
    rawPrices: Record<string, number>;
    rawStores: Record<string, StoreMapInfo>;
    rawTargets: Record<string, number>;
  } | null>(null);

  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImportFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImportFile(e.target.files[0]);
    }
  };

  const processImportFile = (file: File) => {
    showToast(`Đang phân tích tệp ${file.name}...`, 'loading');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Không thể đọc file');
        const workbook = XLSX.read(data, { type: 'array' });
        
        let skuCount = 0;
        let storeCount = 0;
        let targetCount = 0;
        
        const rawPrices: Record<string, number> = {};
        const rawStores: Record<string, StoreMapInfo> = {};
        const rawTargets: Record<string, number> = {};
        const details: string[] = [];

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet) as any[];
          const nameLower = sheetName.toLowerCase();

          // Rule 1: pricing sheet
          if (nameLower.includes('gia') || nameLower.includes('price') || nameLower.includes('sku') || nameLower.includes('sản phẩm')) {
            rows.forEach(r => {
              const skuKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('sku') || 
                k.toLowerCase().includes('sản phẩm') || 
                k.toLowerCase().includes('mã')
              );
              const priceKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('đơn giá') || 
                k.toLowerCase().includes('giá') || 
                k.toLowerCase().includes('price') ||
                k.toLowerCase().includes('don gia')
              );

              if (skuKey) {
                const sku = String(r[skuKey]).trim().toUpperCase();
                const price = priceKey ? parseFloat(String(r[priceKey]).replace(/[^0-9.]/g, '')) : 0;
                if (sku && !isNaN(price)) {
                  rawPrices[sku] = price;
                  skuCount++;
                }
              }
            });
            details.push(`Nhận diện trang tính Bảng Giá "${sheetName}": nạp thành công ${skuCount} dòng sản phẩm SKU.`);
          }
          // Rule 2: supervisor / store mappings sheet
          else if (nameLower.includes('sup') || nameLower.includes('map') || nameLower.includes('store') || nameLower.includes('phụ trách') || nameLower.includes('giám sát')) {
            rows.forEach(r => {
              const codeKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('mã cửa hàng') || 
                k.toLowerCase().includes('store code') || 
                k.toLowerCase().includes('mã ch') || 
                k.toLowerCase().includes('mã_ch')
              );
              const nameKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('tên cửa hàng') || 
                k.toLowerCase().includes('store name') || 
                k.toLowerCase().includes('tên ch') ||
                k.toLowerCase().includes('tên_ch')
              );
              const supKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('supervisor') || 
                k.toLowerCase().includes('sup') || 
                k.toLowerCase().includes('người phụ trách')
              );
              const regionKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('khu vực') || 
                k.toLowerCase().includes('region') || 
                k.toLowerCase().includes('vùng')
              );

              if (codeKey) {
                const code = String(r[codeKey]).trim().toUpperCase();
                const name = nameKey ? String(r[nameKey]).trim() : '';
                const sup = supKey ? String(r[supKey]).trim().toUpperCase() : 'CHIEN';
                const region = regionKey ? String(r[regionKey]).trim().toUpperCase() : 'NORTH';

                if (code) {
                  rawStores[code] = {
                    storeCode: code,
                    storeName: name || code,
                    sup,
                    region
                  };
                  storeCount++;
                }
              }
            });
            details.push(`Nhận diện trang tính Ánh xạ Gán SUP "${sheetName}": gán thành công ${storeCount} cửa hàng.`);
          }
          // Rule 3: targets sheet
          else if (nameLower.includes('target') || nameLower.includes('chỉ tiêu') || nameLower.includes('chitieu')) {
            rows.forEach(r => {
              const codeKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('mã cửa hàng') || 
                k.toLowerCase().includes('mã ch') || 
                k.toLowerCase().includes('cửa hàng') ||
                k.toLowerCase().includes('store') ||
                k.toLowerCase().includes('mã')
              );
              const targetKey = Object.keys(r).find(k => 
                k.toLowerCase().includes('target') || 
                k.toLowerCase().includes('chỉ tiêu') || 
                k.toLowerCase().includes('target hiện hành') ||
                k.toLowerCase().includes('tiêu')
              );

              if (codeKey && targetKey) {
                const key = String(r[codeKey]).trim();
                const tgtVal = parseFloat(String(r[targetKey]).replace(/[^0-9.]/g, ''));
                if (key && !isNaN(tgtVal)) {
                  rawTargets[key] = tgtVal;
                  targetCount++;
                }
              }
            });
            details.push(`Nhận diện trang tính Target "${sheetName}": ghi đè thành công ${targetCount} chỉ tiêu.`);
          }
        });

        // Fallback parser if no tab names match
        if (skuCount === 0 && storeCount === 0 && targetCount === 0 && workbook.SheetNames.length > 0) {
          const firstTabName = workbook.SheetNames[0];
          const firstSheet = workbook.Sheets[firstTabName];
          const rows = XLSX.utils.sheet_to_json(firstSheet) as any[];
          details.push(`Không tìm thấy cấu hình khớp tab mặc định. Thử đọc cấu hình đơn lẻ từ tab đầu tiên: "${firstTabName}"`);
          
          if (rows.length > 0) {
            const keys = Object.keys(rows[0]);
            const isPricing = keys.some(k => k.toLowerCase().includes('sku') || k.toLowerCase().includes('đơn giá'));
            const isSupMap = keys.some(k => k.toLowerCase().includes('sup') || k.toLowerCase().includes('supervisor'));
            const isTarget = keys.some(k => k.toLowerCase().includes('target') || k.toLowerCase().includes('tiêu'));

            if (isPricing) {
              rows.forEach(r => {
                const skuKey = Object.keys(r).find(k => k.toLowerCase().includes('sku') || k.toLowerCase().includes('sản phẩm') || k.toLowerCase().includes('mã'));
                const priceKey = Object.keys(r).find(k => k.toLowerCase().includes('đơn giá') || k.toLowerCase().includes('giá') || k.toLowerCase().includes('price'));
                if (skuKey) {
                  const sku = String(r[skuKey]).trim().toUpperCase();
                  const price = priceKey ? parseFloat(String(r[priceKey]).replace(/[^0-9.]/g, '')) : 0;
                  if (sku && !isNaN(price)) {
                    rawPrices[sku] = price;
                    skuCount++;
                  }
                }
              });
              details.push(`Đã tự động nhận diện mẫu đơn giá: Nạp thành công ${skuCount} SKU từ trang "${firstTabName}"`);
            } else if (isTarget) {
              rows.forEach(r => {
                const codeKey = Object.keys(r).find(k => k.toLowerCase().includes('mã') || k.toLowerCase().includes('cửa hàng') || k.toLowerCase().includes('store'));
                const targetKey = Object.keys(r).find(k => k.toLowerCase().includes('target') || k.toLowerCase().includes('chỉ tiêu') || k.toLowerCase().includes('tiêu'));
                if (codeKey && targetKey) {
                  const key = String(r[codeKey]).trim();
                  const tgtVal = parseFloat(String(r[targetKey]).replace(/[^0-9.]/g, ''));
                  if (key && !isNaN(tgtVal)) {
                    rawTargets[key] = tgtVal;
                    targetCount++;
                  }
                }
              });
              details.push(`Đã tự động nhận diện mẫu Target: Nạp thành công ${targetCount} ghi đè từ trang "${firstTabName}"`);
            }
          }
        }

        if (skuCount === 0 && storeCount === 0 && targetCount === 0) {
          throw new Error('Tệp tải lên không đồng nhất cấu trúc mẫu chuẩn. Vui lòng sử dụng cấu trúc tệp mẫu tải về của hệ thống!');
        }

        setImportResults({
          success: true,
          skuCount,
          storeCount,
          targetCount,
          details,
          rawPrices,
          rawStores,
          rawTargets
        });

        showToast('Nạp nội dung tệp Excel thành công! Vui lòng xem bản phác thảo và ấn xác nhận.', 'success');
      } catch (err: any) {
        setImportResults({
          success: false,
          skuCount: 0,
          storeCount: 0,
          targetCount: 0,
          details: [err.message || 'Lỗi cấu trúc tệp Excel'],
          rawPrices: {},
          rawStores: {},
          rawTargets: {}
        });
        showToast(err.message || 'Lỗi cấu trúc tệp Excel', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyImportedData = async () => {
    if (!importResults) return;
    showToast('Đang ghi đè và lưu cấu hình nhập vào Cloud...', 'loading');
    
    try {
      // Create local working copies
      const mergedPrices = { ...pricesList, ...importResults.rawPrices };
      const mergedStores = { ...storeMapList, ...importResults.rawStores };
      const mergedTargets = { ...customTargetsList, ...importResults.rawTargets };

      // 1. Sync to Supabase
      if (importResults.skuCount > 0) {
        const { error } = await supabase.from('configurations').upsert({
          key: 'productPrices',
          value: { data: mergedPrices, updatedAt: new Date().toISOString() },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error) throw error;
        setDynamicProductPrices(mergedPrices);
        setPricesList(mergedPrices);
      }

      if (importResults.storeCount > 0) {
        const { error } = await supabase.from('configurations').upsert({
          key: 'storeMapping',
          value: { data: mergedStores, updatedAt: new Date().toISOString() },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error) throw error;
        setDynamicStoreMapping(mergedStores);
        setStoreMapList(mergedStores);
      }

      if (importResults.targetCount > 0) {
        const { error } = await supabase.from('configurations').upsert({
          key: 'storeTargets',
          value: { data: mergedTargets, updatedAt: new Date().toISOString() },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error) throw error;
        setDynamicCustomTargets(mergedTargets);
        setCustomTargetsList(mergedTargets);
      }

      onConfigChanged();
      showToast('Đã áp dụng & lưu cấu hình toàn bộ lên Supabase Cloud!', 'success');
      setImportResults(null);
    } catch (e) {
      showToast('Gặp lỗi khi tải cấu hình lên Cloud!', 'error');
      console.error(e);
    }
  };

  return (
    <div id="configure-panel" className="anim-rise">
      {/* Toast Notification Bar */}
      {toast.type && (
        <div className={`config-toast config-toast-${toast.type}`}>
          <div className="config-toast-content">
             {toast.type === 'success' && <CheckCircle size={18} className="good" />}
             {toast.type === 'error' && <AlertCircle size={18} className="bad" />}
             {toast.type === 'loading' && <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />}
             <span>{toast.message}</span>
          </div>
          {toast.type !== 'loading' && (
            <button onClick={clearToast} className="config-toast-close">
              Đóng
            </button>
          )}
        </div>
      )}

      {/* Header section designed beautifully and strictly conforming to main UI */}
      <div className="config-header-container">
        <div className="config-title-group">
          <div className="config-title-flex">
            <h2 className="config-title">
              Cấu hình Hệ thống
            </h2>
            <span className="config-status-badge">
              <span className="status-dot w-1.5 h-1.5 bg-emerald-500 rounded-full" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--c-good)' }}></span> Cloud Active (Supabase)
            </span>
          </div>
          <p className="config-desc">
            Quản lý tập trung bảng đơn giá SKU, phân công giám sát (SUP), và thiết lập chỉ tiêu Target. Dữ liệu được đồng bộ hóa an toàn.
          </p>
        </div>
      </div>

      {/* Inner split layout with responsive sidebar menu */}
      <div className="config-layout">
        
        {/* Modern Subpanel Navigation Menu - Cohesive and Adaptive */}
        <div className="config-sidebar">
          <div className="config-sidebar-section-title">Quản lý Dữ liệu</div>
          <button
            onClick={() => setActiveTab('prices')}
            className={`config-nav-btn ${activeTab === 'prices' ? 'active' : ''}`}
          >
            <DollarSign size={15} />
            <span>Bảng Giá Sản Phẩm</span>
          </button>

          <button
            onClick={() => setActiveTab('sups')}
            className={`config-nav-btn ${activeTab === 'sups' ? 'active' : ''}`}
          >
            <Users size={15} />
            <span>Phân Công Supervisor</span>
          </button>

          <button
            onClick={() => setActiveTab('targets')}
            className={`config-nav-btn ${activeTab === 'targets' ? 'active' : ''}`}
          >
            <Target size={15} />
            <span>Quản Lý Target Store</span>
          </button>

          <div className="config-sidebar-divider"></div>
          <div className="config-sidebar-section-title">Hệ thống</div>

          <button
            onClick={() => setActiveTab('excel')}
            className={`config-nav-btn ${activeTab === 'excel' ? 'active' : ''}`}
          >
            <FileSpreadsheet size={15} />
            <span>Nhập / Xuất Excel</span>
          </button>
        </div>

        {/* Dynamic Inner Configurations Screen */}
        <div style={{ flex: 1, minWidth: 0 }}>
          
          {/* TAB 1: PRODUCT VALUE CONFIGURING */}
          {activeTab === 'prices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="config-info-bar">
                <Info size={18} />
                <p>
                  <strong>Lưu ý:</strong> Bảng đơn giá sản phẩm được sử dụng để quy đổi sản lượng thành doanh số tiền VND khi đối chiếu dữ liệu. Hãy chỉnh sửa SKU hoặc bổ sung đơn giá tại chỗ. Nhấp "Lưu bảng giá cloud" để đồng bộ lên Supabase Cloud.
                </p>
              </div>

              {/* Add Pricing SKU Form */}
              <div className="config-card">
                <div className="config-card-header">
                  <div className="config-card-icon">
                    <Plus size={16} />
                  </div>
                  <h3 className="config-card-title">Thêm SKU & Đơn Giá Mới</h3>
                </div>
                <div className="config-form-row">
                  <div className="config-field">
                    <span className="config-field-label">Mã sản phẩm (SKU) mới</span>
                    <input
                      value={newSku}
                      onChange={e => setNewSku(e.target.value)}
                      placeholder="VD: HAIRCARE.PTN-DG-900ML"
                      className="config-input"
                    />
                  </div>
                  <div className="config-field" style={{ maxWidth: '240px' }}>
                    <span className="config-field-label">Giá bán tham chiếu (VND)</span>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      placeholder="VD: 239000"
                      className="config-input"
                    />
                  </div>
                  <button
                    onClick={handleAddPrice}
                    className="btn btn-primary"
                    style={{ height: '42px', padding: '0 24px', borderRadius: '10px' }}
                  >
                    <Plus size={16} />
                    <span>Thêm SKU</span>
                  </button>
                </div>
              </div>

              {/* Filter and Cloud Save Bar */}
              <div className="config-actions-bar">
                <div className="config-search-wrapper">
                  <Search size={14} className="config-search-icon" />
                  <input
                    value={priceSearch}
                    onChange={e => {
                      setPriceSearch(e.target.value);
                      setPricesPage(1);
                    }}
                    placeholder="Tìm mã sản phẩm (SKU)..."
                    className="config-search-input"
                  />
                </div>

                <button
                  onClick={handleSavePricesToFirebase}
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--c-accent-2)', borderColor: 'var(--c-accent-2)' }}
                >
                  <Save size={14} /> 
                  <span>Lưu bảng giá Cloud</span>
                </button>
              </div>

              {/* Data Table */}
              <div className="config-table-container">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>SKU Sản phẩm</th>
                      <th style={{ width: '25%' }}>Ngành Hàng</th>
                      <th className="config-cell-right" style={{ width: '20%' }}>Giá VND</th>
                      <th className="config-cell-center" style={{ width: '15%' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPrices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="config-cell-center" style={{ padding: '32px', color: 'var(--c-text-3)' }}>
                          Không tìm thấy SKU nào khớp với tìm kiếm!
                        </td>
                      </tr>
                    ) : (
                      paginatedPrices.map(([sku, price]) => (
                        <tr key={sku}>
                          <td className="config-cell-mono">{sku}</td>
                          <td>
                            <span className="config-badge config-badge-neutral">
                              {sku.split('.')[0] || 'Unsorted'}
                            </span>
                          </td>
                          <td className="config-cell-mono config-cell-right">
                            {editingSku === sku ? (
                              <input
                                type="number"
                                className="config-input"
                                style={{ width: '130px', textAlign: 'right', padding: '6px 10px' }}
                                value={editingPriceVal}
                                onChange={e => setEditingPriceVal(e.target.value)}
                                autoFocus
                              />
                            ) : (
                              new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
                            )}
                          </td>
                          <td className="config-cell-center">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              {editingSku === sku ? (
                                <>
                                  <button onClick={() => handleUpdatePriceInline(sku)} className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--c-accent-2)' }}>
                                    Lưu
                                  </button>
                                  <button onClick={() => setEditingSku(null)} className="btn btn-ghost btn-sm">
                                    Hủy
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingSku(sku);
                                      setEditingPriceVal(String(price));
                                    }}
                                    className="config-icon-btn"
                                    title="Chỉnh sửa đơn giá"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePrice(sku)}
                                    className="config-icon-btn delete"
                                    title="Gỡ SKU"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPricesPages > 1 && (
                <div className="config-pagination">
                  <div className="config-pagination-info">
                    Hiển thị <span>{Math.min(filteredPrices.length, (safePricesPage - 1) * itemsPerPage + 1)}</span> - <span>{Math.min(filteredPrices.length, safePricesPage * itemsPerPage)}</span> trong số <span>{filteredPrices.length}</span> SKU
                  </div>
                  
                  <div className="config-pagination-controls">
                    <button
                      onClick={() => setPricesPage(1)}
                      disabled={safePricesPage === 1}
                      className="config-page-btn"
                      title="Trang đầu"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      onClick={() => setPricesPage(p => Math.max(1, p - 1))}
                      disabled={safePricesPage === 1}
                      className="config-page-btn"
                      title="Trang trước"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    
                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, totalPricesPages) }, (_, i) => {
                      let pageNum = 1;
                      if (totalPricesPages <= 5) {
                        pageNum = i + 1;
                      } else {
                        const startPage = Math.max(1, Math.min(safePricesPage - 2, totalPricesPages - 4));
                        pageNum = startPage + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPricesPage(pageNum)}
                          className={`config-page-btn ${safePricesPage === pageNum ? 'active' : ''}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setPricesPage(p => Math.min(totalPricesPages, p + 1))}
                      disabled={safePricesPage === totalPricesPages}
                      className="config-page-btn"
                      title="Trang sau"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => setPricesPage(totalPricesPages)}
                      disabled={safePricesPage === totalPricesPages}
                      className="config-page-btn"
                      title="Trang cuối"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--c-text-3)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                Tổng cộng {filteredPrices.length} mã SKU sản phẩm.
              </div>
            </div>
          )}

          {/* TAB 2: STORE MAPS & SUPERVISORS ASSIGNMENTS */}
          {activeTab === 'sups' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="config-info-bar">
                <Info size={18} />
                <p>
                  <strong>Lợi ích:</strong> Bản đồ Supervisor và Vùng miền cho phép hệ thống tự động bóc tách doanh số làm việc của các PG gửi về để gom nhóm báo cáo chuẩn xác theo từng Giám sát thị trường. Nhấp "Lưu ánh xạ SUP cloud" để ghi nhớ.
                </p>
              </div>

              {/* Add Store Mapping Form */}
              <div className="config-card">
                <div className="config-card-header">
                  <div className="config-card-icon">
                    <Plus size={16} />
                  </div>
                  <h3 className="config-card-title">Phân Cửa Hàng Cho Giám Sát (SUP)</h3>
                </div>
                <div className="config-form-grid-5">
                  <div className="config-field">
                    <span className="config-field-label">Mã CH mới</span>
                    <input
                      value={newStoreCode}
                      onChange={e => setNewStoreCode(e.target.value)}
                      placeholder="e.g. BIGC0051"
                      className="config-input"
                    />
                  </div>
                  <div className="config-field">
                    <span className="config-field-label">Tên CH (Rút gọn)</span>
                    <input
                      value={newStoreName}
                      onChange={e => setNewStoreName(e.target.value)}
                      placeholder="e.g. GO Nha Trang"
                      className="config-input"
                    />
                  </div>
                  <div className="config-field">
                    <span className="config-field-label">Supervisor</span>
                    <select
                      value={newStoreSup}
                      onChange={e => setNewStoreSup(e.target.value)}
                      className="config-input"
                      style={{ fontWeight: 'bold' }}
                    >
                      {supsList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="config-field">
                    <span className="config-field-label">Phân Khu Vực</span>
                    <select
                      value={newStoreRegion}
                      onChange={e => setNewStoreRegion(e.target.value)}
                      className="config-input"
                      style={{ fontWeight: 'bold' }}
                    >
                      {regionsList.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={handleAddStoreMap}
                    className="btn btn-primary"
                    style={{ height: '42px', padding: '0 24px', borderRadius: '10px' }}
                  >
                    <Plus size={16} />
                    <span>Thêm Store</span>
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="config-actions-bar">
                <div className="config-search-wrapper">
                  <Search size={14} className="config-search-icon" />
                  <input
                    value={storeSearch}
                    onChange={e => setStoreSearch(e.target.value)}
                    placeholder="Tìm mã, tên cửa hàng, SUP..."
                    className="config-search-input"
                  />
                </div>

                <button
                  onClick={handleSaveStoreMapToFirebase}
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--c-accent-2)', borderColor: 'var(--c-accent-2)' }}
                >
                  <Save size={14} /> 
                  <span>Lưu ánh xạ SUP Cloud</span>
                </button>
              </div>

              {/* Data Table */}
              <div className="config-table-container">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Mã Cửa Hàng</th>
                      <th style={{ width: '35%' }}>Tên Cửa Hàng</th>
                      <th style={{ width: '20%' }}>Supervisor (SUP)</th>
                      <th style={{ width: '13%' }}>Vùng Miền</th>
                      <th className="config-cell-center" style={{ width: '12%' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="config-cell-center" style={{ padding: '32px', color: 'var(--c-text-3)' }}>
                          Không tìm thấy cấu hình cửa hàng nào!
                        </td>
                      </tr>
                    ) : (
                      filteredStores.map(item => (
                        <tr key={item.storeCode}>
                          <td className="config-cell-mono">{item.storeCode}</td>
                          <td className="config-cell-bold">
                            {editingStoreCode === item.storeCode ? (
                              <input
                                value={editNameField}
                                onChange={e => setEditNameField(e.target.value)}
                                className="config-input"
                                style={{ padding: '6px 10px' }}
                              />
                            ) : (
                              item.storeName
                            )}
                          </td>
                          <td className="config-cell-bold">
                            {editingStoreCode === item.storeCode ? (
                              <select
                                value={editSupField}
                                onChange={e => setEditSupField(e.target.value)}
                                className="config-input"
                                style={{ padding: '6px 10px', fontWeight: 'bold' }}
                              >
                                {supsList.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : (
                              item.sup
                            )}
                          </td>
                          <td>
                            {editingStoreCode === item.storeCode ? (
                              <select
                                value={editRegionField}
                                onChange={e => setEditRegionField(e.target.value)}
                                className="config-input"
                                style={{ padding: '6px 10px', fontWeight: 'bold' }}
                              >
                                {regionsList.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : (
                              <span className={`config-badge ${
                                item.region === 'NORTH' ? 'config-badge-blue' :
                                item.region === 'HCM' ? 'config-badge-purple' :
                                item.region === 'HN' ? 'config-badge-green' :
                                'config-badge-orange'
                              }`}>{item.region}</span>
                            )}
                          </td>
                          <td className="config-cell-center">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              {editingStoreCode === item.storeCode ? (
                                <>
                                  <button onClick={() => handleUpdateStoreInline(item.storeCode)} className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--c-accent-2)' }}>
                                    Lưu
                                  </button>
                                  <button onClick={() => setEditingStoreCode(null)} className="btn btn-ghost btn-sm">
                                    Hủy
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingStoreCode(item.storeCode);
                                      setEditNameField(item.storeName);
                                      setEditSupField(item.sup);
                                      setEditRegionField(item.region);
                                    }}
                                    className="config-icon-btn"
                                    title="Chỉnh sửa thông tin"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStoreMap(item.storeCode)}
                                    className="config-icon-btn delete"
                                    title="Xóa cửa hàng"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--c-text-3)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                Tổng cộng {filteredStores.length} cửa hàng.
              </div>
            </div>
          )}

          {/* TAB 3: TARGET RETAIL STORES */}
          {activeTab === 'targets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="config-info-bar">
                <Info size={18} />
                <p>
                  <strong>Chỉ tiêu Target tùy biến:</strong> Toàn bộ store trong chu kỳ tính toán sẽ được tự động đồng bộ. Bạn có thể thiết lập mức doanh số Target riêng cho bất kỳ Store nào để ghi đè số cũ trong file Excel, thích hợp để điều chỉnh khi chạy sự kiện giữa tháng.
                </p>
              </div>

              {/* Action and Search bar */}
              <div className="config-actions-bar">
                <div className="config-search-wrapper">
                  <Search size={14} className="config-search-icon" />
                  <input
                    value={targetSearch}
                    onChange={e => setTargetSearch(e.target.value)}
                    placeholder="Tìm tên, mã store hoặc dự án..."
                    className="config-search-input"
                  />
                </div>

                <button
                  onClick={handleSaveTargetsToFirebase}
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--c-accent-2)', borderColor: 'var(--c-accent-2)' }}
                >
                  <Save size={14} /> 
                  <span>Áp dụng Target thực tế</span>
                </button>
              </div>

              {/* Table */}
              <div className="config-table-container">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>Dự Án</th>
                      <th style={{ width: '15%' }}>Mã CH</th>
                      <th style={{ width: '30%' }}>Tên Cửa Hàng</th>
                      <th className="config-cell-right" style={{ width: '18%' }}>Target Gốc Excel</th>
                      <th className="config-cell-right" style={{ width: '25%' }}>Target Áp Dụng Thực Tế</th>
                      <th className="config-cell-center" style={{ width: '10%' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStores.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="config-cell-center" style={{ padding: '32px', color: 'var(--c-text-3)' }}>
                          Không tìm thấy thông tin điểm bán nào hoạt động trong chu kỳ này!
                        </td>
                      </tr>
                    ) : (
                      activeStores.map(store => {
                        const key = store.code || store.name;
                        const isOverridden = customTargetsList[key] !== undefined;
                        const currentTarget = isOverridden ? customTargetsList[key] : store.baseTarget;

                        return (
                          <tr key={key}>
                            <td>
                              <span className={`config-badge ${
                                store.project === 'CRV' ? 'config-badge-blue' : 'config-badge-orange'
                              }`}>{store.project}</span>
                            </td>
                            <td className="config-cell-mono">{store.code || '---'}</td>
                            <td className="config-cell-bold">{store.name}</td>
                            <td className="config-cell-mono config-cell-right" style={{ color: 'var(--c-text-3)' }}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(store.baseTarget)}
                            </td>
                            <td className="config-cell-mono config-cell-right">
                              {editingTargetCode === key ? (
                                <input
                                  type="number"
                                  placeholder="VND..."
                                  className="config-input"
                                  style={{ width: '150px', textAlign: 'right', padding: '6px 10px' }}
                                  value={newTargetVal}
                                  onChange={e => setNewTargetVal(e.target.value)}
                                  autoFocus
                                />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  <span className="config-cell-bold">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentTarget)}</span>
                                  {isOverridden && (
                                    <span className="config-badge config-badge-green" style={{ fontSize: '9px', padding: '1px 6px' }}>
                                      <Check size={10} /> Đã chỉnh sửa Cloud
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="config-cell-center">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {editingTargetCode === key ? (
                                  <>
                                    <button onClick={() => handleUpdateTarget(store.code, store.name)} className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--c-accent-2)' }}>
                                      Lưu
                                    </button>
                                    <button onClick={() => setEditingTargetCode(null)} className="btn btn-ghost btn-sm">
                                      Hủy
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingTargetCode(key);
                                        setNewTargetVal(String(currentTarget));
                                      }}
                                      className="btn btn-ghost btn-sm"
                                      style={{ fontWeight: 'bold' }}
                                    >
                                      Sửa Target
                                    </button>
                                    {isOverridden && (
                                      <button
                                        onClick={() => handleClearCustomTarget(key)}
                                        className="btn btn-ghost btn-sm"
                                        style={{ color: 'var(--c-bad)', fontWeight: 'bold' }}
                                      >
                                        Hủy gán
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--c-text-3)', fontFamily: 'var(--font-mono)' }}>
                Tổng cộng {activeStores.length} điểm bán có target.
              </div>
            </div>
          )}

          {/* TAB 4: IMPORT & EXPORT EXCEL CENTRAL CONTROL - BENTO GRID */}
          {activeTab === 'excel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Bento Grid layout for importing and exporting */}
              <div className="config-bento-grid">
                
                {/* Left block: EXCEL IMPORT ZONE */}
                <div className="config-card" style={{ minHeight: '380px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="config-card-header">
                      <div className="config-card-icon">
                        <Upload size={18} />
                      </div>
                      <h3 className="config-card-title">Tải lên Cấu hình Excel</h3>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--c-text-2)', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                      Lựa chọn hoặc kéo thả tệp Excel sao lưu cấu hình có chứa các trang tính khớp với mẫu gộp của hệ thống:
                    </p>
                    
                    <ul style={{ fontSize: '12px', color: 'var(--c-text-3)', paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
                      <li><strong style={{ color: 'var(--c-text-2)' }}>Bang_Gia_SKU</strong>: Cập nhật giá bán sỉ/lẻ sản phẩm.</li>
                      <li><strong style={{ color: 'var(--c-text-2)' }}>Danh_Sach_SUP_Store</strong>: Đồng bộ sơ đồ nhân sự Giám sát.</li>
                      <li><strong style={{ color: 'var(--c-text-2)' }}>Cau_Hinh_Targets</strong>: Ghi đè chỉ tiêu doanh thu thực tế.</li>
                    </ul>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`config-upload-zone ${dragActive ? 'drag-active' : ''}`}
                  >
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      id="excel-import-uploader"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="excel-import-uploader" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px 0' }}>
                      <div className="config-upload-icon-wrapper">
                        <FileSpreadsheet size={26} />
                      </div>
                      <span className="config-upload-text">Kéo thả tệp tin hoặc nhấn để chọn</span>
                      <span className="config-upload-subtext">Hỗ trợ định dạng .xlsx, .xls tối đa 50MB</span>
                    </label>
                  </div>
                </div>

                {/* Right block: EXCEL EXPORT ZONE */}
                <div className="config-card" style={{ minHeight: '380px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="config-card-header">
                      <div className="config-card-icon" style={{ color: 'var(--c-accent-2)', backgroundColor: 'rgba(45, 183, 87, 0.08)' }}>
                        <Download size={18} />
                      </div>
                      <h3 className="config-card-title">Tải về Bản Thao Tác Hệ Thống</h3>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--c-text-2)', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                      Trích xuất cấu hình Bảng giá bán, Bản đồ Sup, và Target hiện tại trong bộ nhớ thành một tệp Excel nhiều trang chuẩn hóa. Tệp tin này dùng làm mẫu chính xác để sửa đổi ngoại tuyến và nhập ngược lại phía đối diện.
                    </p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                      <span className="config-badge config-badge-blue">Bang_Gia_SKU</span>
                      <span className="config-badge config-badge-purple">Danh_Sach_SUP_Store</span>
                      <span className="config-badge config-badge-green">Cau_Hinh_Targets</span>
                    </div>
                  </div>

                  <div style={{ paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      onClick={handleExportSystemConfigs}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '12px', gap: '8px', display: 'flex', alignItems: 'center' }}
                    >
                      <Download size={14} />
                      <span>Xuất tệp cấu hình (.xlsx)</span>
                    </button>
                    <button
                      onClick={handleDownloadBlankTemplate}
                      className="btn btn-secondary"
                      style={{ 
                        width: '100%', 
                        justifyContent: 'center', 
                        padding: '12px', 
                        gap: '8px', 
                        display: 'flex', 
                        alignItems: 'center',
                        backgroundColor: 'var(--c-bg)',
                        border: '1px solid var(--c-accent)',
                        borderColor: 'var(--c-accent)',
                        color: 'var(--c-accent)'
                      }}
                    >
                      <FileSpreadsheet size={14} />
                      <span>Tải Excel mẫu chuẩn (.xlsx)</span>
                    </button>
                    <span style={{ display: 'block', textAlign: 'center', fontSize: '9px', color: 'var(--c-text-3)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Dữ liệu kết xuất động theo thời gian thực từ Supabase Cloud</span>
                  </div>
                </div>

              </div>

              {/* Parsed summary results panel if loaded successfully */}
              {importResults && (
                <div className="config-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--c-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle className="good animate-pulse" size={18} />
                      <h4 className="config-card-title" style={{ fontSize: '13px' }}>Xem Phác Thảo Bản Phân Tích Excel</h4>
                    </div>
                    <span className="config-badge config-badge-green" style={{ padding: '4px 12px' }}>Đã sẵn sàng đồng bộ</span>
                  </div>

                  <p style={{ fontSize: '12.5px', color: 'var(--c-text-2)', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                     Hệ thống đã nhận diện dữ liệu sửa đổi trong tệp tin. Vui lòng xác định số lượng bản ghi dưới đây trước khi đồng bộ hóa vĩnh viễn:
                  </p>

                  <div className="config-preview-grid">
                    <div className="config-preview-card">
                      <span className="config-preview-card-label">SKU Đơn Giá</span>
                      <span className="config-preview-card-value">{importResults.skuCount}</span>
                    </div>
                    <div className="config-preview-card">
                      <span className="config-preview-card-label">Cửa hàng - SUP</span>
                      <span className="config-preview-card-value">{importResults.storeCount}</span>
                    </div>
                    <div className="config-preview-card">
                      <span className="config-preview-card-label">Ghi đè Chỉ tiêu Target</span>
                      <span className="config-preview-card-value">{importResults.targetCount}</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--c-surface-2)', padding: '16px', borderRadius: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--c-border)', color: 'var(--c-text-2)', fontWeight: 500 }}>
                    {importResults.details.map((item, idx) => (
                      <p key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: 0 }}>
                        <span className="status-dot w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--c-good)', borderRadius: '50%' }}></span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--c-border)' }}>
                    <button
                      onClick={() => setImportResults(null)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', borderRadius: '10px' }}
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      onClick={handleApplyImportedData}
                      className="btn btn-primary"
                      style={{ backgroundColor: 'var(--c-accent-2)', borderColor: 'var(--c-accent-2)', padding: '8px 16px', borderRadius: '10px' }}
                    >
                      <Save size={14} /> 
                      <span>Ghi Đè Lên Supabase & Áp Dụng</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Informative tutorial notes - Cohesive styling */}
              <div className="config-alert-card">
                <h4 className="config-alert-card-title">
                  <AlertCircle size={18} /> 
                  HƯỚNG DẪN QUẢN TRỊ DỮ LIỆU CỐ ĐỊNH PHIÊN LÀM VIỆC
                </h4>
                <p className="config-alert-card-desc">
                  Mọi tùy chỉnh hoặc tệp Excel nhập vào bảng điều khiển được đồng bộ trực tuyến vào <strong>cơ sở dữ liệu Supabase Cloud</strong> liên kết với tài khoản làm việc của bạn.
                </p>
                <div style={{ borderTop: '1px solid rgba(245, 158, 11, 0.15)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#b45309', fontSize: '12px' }}>
                    Lợi ích cốt lõi của việc này:
                  </p>
                  <ul className="config-alert-card-list">
                    <li><strong>Cố định dữ liệu:</strong> Cấu hình (đơn giá sản phẩm, giám sát vùng, target) không bị biến mất khi dọn dẹp bộ nhớ đệm (Clear cache) hay khi đóng trình duyệt.</li>
                    <li><strong>Độc lập tải dữ liệu:</strong> Khi bạn tải lên tệp tin Excel số PG mới hàng tuần từ cổng quản trị chính, các quy tắc đơn giá và Ánh xạ SUP trên Cloud vẫn tự động áp dụng chính xác cho file mới mà không cần thiết lập lại từ đầu!</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
