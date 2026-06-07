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
    <div className="w-full" id="configure-panel">
      {/* Toast Notification Bar */}
      {toast.type && (
        <div className={`p-4 mb-6 rounded-2xl flex items-center justify-between border transition-all duration-300 shadow-md ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
          toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400' :
          'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400 animate-pulse'
        }`}>
          <div className="flex items-center gap-3">
             {toast.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
             {toast.type === 'error' && <AlertCircle size={18} className="text-rose-500" />}
             {toast.type === 'loading' && <RefreshCw size={18} className="text-blue-500 animate-spin" />}
             <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
          </div>
          {toast.type !== 'loading' && (
            <button onClick={clearToast} className="text-[10px] font-bold uppercase tracking-wider opacity-60 hover:opacity-100 px-3 py-1.5 rounded-lg bg-[var(--c-bg-2)] border border-[var(--c-border)] cursor-pointer transition-all">
              Đóng
            </button>
          )}
        </div>
      )}

      {/* Header section designed beautifully and strictly conforming to main UI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end pb-6 mb-8 gap-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--c-text-1)] flex items-center gap-2">
              Cấu hình Hệ thống
            </h2>
            <span className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 rounded-full select-none shadow-sm">
              <span className="status-dot w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Cloud Active (Supabase)
            </span>
          </div>
          <p className="text-xs text-[var(--c-text-3)] font-semibold max-w-xl leading-relaxed">
            Quản lý tập trung bảng đơn giá SKU, phân công giám sát (SUP), và thiết lập chỉ tiêu Target. Dữ liệu được đồng bộ hóa an toàn.
          </p>
        </div>

        {/* Dynamic Global Action: Download System State Sheet */}
        <button 
          onClick={handleExportSystemConfigs}
          className="btn btn-secondary cursor-pointer shadow-sm hover:shadow-md hover:bg-[var(--c-surface-2)]/80 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 'bold' }}
        >
          <Download size={14} />
          <span>Xuất tệp cấu hình (.xlsx)</span>
        </button>
      </div>

      {/* Inner split layout with responsive sidebar menu */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
        
        {/* Modern Subpanel Navigation Menu - Cohesive and Adaptive */}
        <div className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2.5 lg:pb-0 lg:w-60 shrink-0 hide-scrollbar bg-[var(--c-bg-2)]/40 dark:bg-[var(--c-bg-2)]/20 p-2.5 rounded-2xl border border-[var(--c-border)]/50">
          <div className="text-[9px] font-bold text-[var(--c-text-3)] uppercase tracking-wider mb-2.5 mt-1 hidden lg:block px-3">Quản lý Dữ liệu</div>
          <button
            onClick={() => setActiveTab('prices')}
            className={`flex items-center gap-3 px-4 py-3 text-[13px] font-bold rounded-xl text-left whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'prices' 
                ? 'bg-[var(--c-accent)] text-white shadow-md shadow-[var(--c-accent)]/10 border border-[var(--c-accent)]' 
                : 'text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]/80 hover:text-[var(--c-text-1)] border border-transparent'
            }`}
          >
            <DollarSign size={15} className={activeTab === 'prices' ? 'text-white' : 'text-[var(--c-text-3)]'} />
            <span>Bảng Giá Sản Phẩm</span>
          </button>

          <button
            onClick={() => setActiveTab('sups')}
            className={`flex items-center gap-3 px-4 py-3 text-[13px] font-bold rounded-xl text-left whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'sups' 
                ? 'bg-[var(--c-accent)] text-white shadow-md shadow-[var(--c-accent)]/10 border border-[var(--c-accent)]' 
                : 'text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]/80 hover:text-[var(--c-text-1)] border border-transparent'
            }`}
          >
            <Users size={15} className={activeTab === 'sups' ? 'text-white' : 'text-[var(--c-text-3)]'} />
            <span>Phân Công Supervisor</span>
          </button>

          <button
            onClick={() => setActiveTab('targets')}
            className={`flex items-center gap-3 px-4 py-3 text-[13px] font-bold rounded-xl text-left whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'targets' 
                ? 'bg-[var(--c-accent)] text-white shadow-md shadow-[var(--c-accent)]/10 border border-[var(--c-accent)]' 
                : 'text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]/80 hover:text-[var(--c-text-1)] border border-transparent'
            }`}
          >
            <Target size={15} className={activeTab === 'targets' ? 'text-white' : 'text-[var(--c-text-3)]'} />
            <span>Quản Lý Target Store</span>
          </button>

          <div className="my-2.5 border-b border-[var(--c-border)] hidden lg:block mx-2"></div>
          <div className="text-[9px] font-bold text-[var(--c-text-3)] uppercase tracking-wider mb-2.5 mt-2 hidden lg:block px-3">Hệ thống</div>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-3 px-4 py-3 text-[13px] font-bold rounded-xl text-left whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'excel' 
                ? 'bg-[var(--c-accent)] text-white shadow-md shadow-[var(--c-accent)]/10 border border-[var(--c-accent)]' 
                : 'text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]/80 hover:text-[var(--c-text-1)] border border-transparent'
            }`}
          >
            <FileSpreadsheet size={15} className={activeTab === 'excel' ? 'text-white' : 'text-[var(--c-text-3)]'} />
            <span>Nhập / Xuất Excel</span>
          </button>
        </div>

        {/* Dynamic Inner Configurations Screen */}
        <div className="flex-1 min-w-0">
          
          {/* TAB 1: PRODUCT VALUE CONFIGURING */}
          {activeTab === 'prices' && (
            <div className="space-y-6">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/35 text-[12.5px] text-blue-800 dark:text-blue-300 p-4 rounded-2xl flex gap-3 items-start shadow-sm">
                <Info size={18} className="text-[var(--c-accent)] shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong className="font-semibold text-blue-900 dark:text-blue-200">Lưu ý:</strong> Bảng đơn giá sản phẩm được sử dụng để quy đổi sản lượng thành doanh số tiền VND khi đối chiếu dữ liệu. Hãy chỉnh sửa SKU hoặc bổ sung đơn giá tại chỗ. Nhấp "Lưu bảng giá cloud" để đồng bộ lên Supabase Cloud.
                </p>
              </div>

              {/* Add Pricing SKU Form */}
              <div className="bg-[var(--c-surface)] rounded-3xl p-6 border border-[var(--c-border)] shadow-sm space-y-4 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3.5 mb-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-[var(--c-accent)]">
                    <Plus size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-[var(--c-text-1)] uppercase tracking-wider">Thêm SKU & Đơn Giá Mới</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full space-y-2">
                    <span className="text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider block">Mã sản phẩm (SKU) mới</span>
                    <input
                      value={newSku}
                      onChange={e => setNewSku(e.target.value)}
                      placeholder="VD: HAIRCARE.PTN-DG-900ML"
                      className="w-full text-xs px-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-bg)]/40 text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 focus:bg-[var(--c-surface)] transition-all duration-200 placeholder:text-[var(--c-text-3)]"
                    />
                  </div>
                  <div className="w-full sm:w-56 space-y-2">
                    <span className="text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider block">Giá bán tham chiếu (VND)</span>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      placeholder="VD: 239000"
                      className="w-full text-xs px-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-bg)]/40 text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 focus:bg-[var(--c-surface)] transition-all duration-200 placeholder:text-[var(--c-text-3)]"
                    />
                  </div>
                  <button
                    onClick={handleAddPrice}
                    className="btn btn-primary h-[42px] px-6 rounded-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shadow-md shadow-[var(--c-accent)]/10 font-bold text-xs"
                  >
                    <Plus size={16} />
                    <span>Thêm SKU</span>
                  </button>
                </div>
              </div>

              {/* Filter and Cloud Save Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:max-w-xs">
                  <Search size={14} className="absolute left-3.5 top-3.5 text-[var(--c-text-3)]" />
                  <input
                    value={priceSearch}
                    onChange={e => {
                      setPriceSearch(e.target.value);
                      setPricesPage(1);
                    }}
                    placeholder="Tìm mã sản phẩm (SKU)..."
                    className="w-full text-xs pl-10 pr-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-surface)] text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 transition-all duration-200"
                  />
                </div>

                <button
                  onClick={handleSavePricesToFirebase}
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/25 shadow-md shadow-emerald-600/10 rounded-xl px-5 py-3 flex items-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Save size={14} /> 
                  <span>Lưu bảng giá Cloud</span>
                </button>
              </div>

              {/* Data Table */}
              <div className="border border-[var(--c-border)] rounded-3xl overflow-hidden bg-[var(--c-surface)] shadow-sm max-h-[480px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[var(--c-bg-2)]/60 border-b border-[var(--c-border)] text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider text-left">
                      <th className="p-4 pl-6">SKU Sản phẩm</th>
                      <th className="p-4">Ngành Hàng</th>
                      <th className="p-4 text-right">Giá VND</th>
                      <th className="p-4 text-center w-32">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-border)] text-[var(--c-text-2)] text-xs">
                    {paginatedPrices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-[var(--c-text-3)] font-medium">
                          Không tìm thấy SKU nào khớp với tìm kiếm!
                        </td>
                      </tr>
                    ) : (
                      paginatedPrices.map(([sku, price]) => (
                        <tr key={sku} className="hover:bg-[var(--c-surface-2)]/40 transition-colors">
                          <td className="p-4 pl-6 font-mono font-bold text-[var(--c-text-1)] text-xs tracking-tight">{sku}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 border border-[var(--c-border)] rounded-lg bg-[var(--c-bg-2)]/40 text-[10px] font-bold tracking-wide text-[var(--c-text-2)]">
                              {sku.split('.')[0]}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-[var(--c-text-1)] text-xs">
                            {editingSku === sku ? (
                              <input
                                type="number"
                                className="w-32 text-right px-3 py-1.5 border border-[var(--c-border)] rounded-lg bg-[var(--c-surface)] text-[var(--c-text-1)] focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 outline-none transition-all"
                                value={editingPriceVal}
                                onChange={e => setEditingPriceVal(e.target.value)}
                                autoFocus
                              />
                            ) : (
                              new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              {editingSku === sku ? (
                                <>
                                  <button onClick={() => handleUpdatePriceInline(sku)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg hover:shadow-md text-[10px] font-bold cursor-pointer transition-all">
                                    Lưu
                                  </button>
                                  <button onClick={() => setEditingSku(null)} className="px-2.5 py-1.5 text-[10px] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:underline cursor-pointer">
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
                                    className="p-2 text-[var(--c-text-3)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-2)] rounded-lg cursor-pointer transition-colors"
                                    title="Chỉnh sửa đơn giá"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePrice(sku)}
                                    className="p-2 text-[var(--c-text-3)] hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[var(--c-border)]">
                  <div className="text-xs text-[var(--c-text-2)] font-semibold">
                    Hiển thị <span className="font-bold text-[var(--c-text-1)]">{Math.min(filteredPrices.length, (safePricesPage - 1) * itemsPerPage + 1)}</span> - <span className="font-bold text-[var(--c-text-1)]">{Math.min(filteredPrices.length, safePricesPage * itemsPerPage)}</span> trong số <span className="font-bold text-[var(--c-text-1)]">{filteredPrices.length}</span> SKU
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPricesPage(1)}
                      disabled={safePricesPage === 1}
                      className="p-2 rounded-xl border border-[var(--c-border)] hover:bg-[var(--c-surface-2)] disabled:opacity-40 disabled:hover:bg-transparent text-[var(--c-text-2)] transition-colors select-none cursor-pointer"
                      title="Trang đầu"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      onClick={() => setPricesPage(p => Math.max(1, p - 1))}
                      disabled={safePricesPage === 1}
                      className="p-2 rounded-xl border border-[var(--c-border)] hover:bg-[var(--c-surface-2)] disabled:opacity-40 disabled:hover:bg-transparent text-[var(--c-text-2)] transition-colors select-none cursor-pointer"
                      title="Trang trước"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 mx-1">
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
                            className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-xl border transition-all select-none cursor-pointer ${
                              safePricesPage === pageNum
                                ? 'bg-[var(--c-accent)] text-white border-[var(--c-accent)] shadow-sm'
                                : 'border-[var(--c-border)] text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setPricesPage(p => Math.min(totalPricesPages, p + 1))}
                      disabled={safePricesPage === totalPricesPages}
                      className="p-2 rounded-xl border border-[var(--c-border)] hover:bg-[var(--c-surface-2)] disabled:opacity-40 disabled:hover:bg-transparent text-[var(--c-text-2)] transition-colors select-none cursor-pointer"
                      title="Trang sau"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => setPricesPage(totalPricesPages)}
                      disabled={safePricesPage === totalPricesPages}
                      className="p-2 rounded-xl border border-[var(--c-border)] hover:bg-[var(--c-surface-2)] disabled:opacity-40 disabled:hover:bg-transparent text-[var(--c-text-2)] transition-colors select-none cursor-pointer"
                      title="Trang cuối"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="text-right text-[10px] text-[var(--c-text-3)] font-mono font-semibold">
                Tổng cộng {filteredPrices.length} mã SKU sản phẩm.
              </div>
            </div>
          )}

          {/* TAB 2: STORE MAPS & SUPERVISORS ASSIGNMENTS */}
          {activeTab === 'sups' && (
            <div className="space-y-6">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/35 text-[12.5px] text-blue-800 dark:text-blue-300 p-4 rounded-2xl flex gap-3 items-start shadow-sm">
                <Info size={18} className="text-[var(--c-accent)] shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong className="font-semibold text-blue-900 dark:text-blue-200">Lợi ích:</strong> Bản đồ Supervisor và Vùng miền cho phép hệ thống tự động bóc tách doanh số làm việc của các PG gửi về để gom nhóm báo cáo chuẩn xác theo từng Giám sát thị trường. Nhấp "Lưu ánh xạ SUP cloud" để ghi nhớ.
                </p>
              </div>

              {/* Add Store Mapping Form */}
              <div className="bg-[var(--c-surface)] rounded-3xl p-6 border border-[var(--c-border)] shadow-sm space-y-4 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3.5 mb-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-[var(--c-accent)]">
                    <Plus size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-[var(--c-text-1)] uppercase tracking-wider">Phân Cửa Hàng Cho Giám Sát (SUP)</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end animate-fade-in">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider block">Mã CH mới</span>
                    <input
                      value={newStoreCode}
                      onChange={e => setNewStoreCode(e.target.value)}
                      placeholder="e.g. BIGC0051"
                      className="w-full text-xs px-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-bg)]/40 text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 focus:bg-[var(--c-surface)] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider block">Tên CH (Rút gọn)</span>
                    <input
                      value={newStoreName}
                      onChange={e => setNewStoreName(e.target.value)}
                      placeholder="e.g. GO Nha Trang"
                      className="w-full text-xs px-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-bg)]/40 text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 focus:bg-[var(--c-surface)] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider block">Supervisor</span>
                    <select
                      value={newStoreSup}
                      onChange={e => setNewStoreSup(e.target.value)}
                      className="w-full text-xs px-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-bg)]/40 text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 focus:bg-[var(--c-surface)] transition-all cursor-pointer font-bold"
                    >
                      {supsList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider block">Phân Khu Vực</span>
                    <select
                      value={newStoreRegion}
                      onChange={e => setNewStoreRegion(e.target.value)}
                      className="w-full text-xs px-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-bg)]/40 text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 focus:bg-[var(--c-surface)] transition-all cursor-pointer font-bold"
                    >
                      {regionsList.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={handleAddStoreMap}
                    className="btn btn-primary h-[42px] px-6 rounded-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shadow-md shadow-[var(--c-accent)]/10 font-bold text-xs"
                  >
                    <Plus size={16} />
                    <span>Thêm Store</span>
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:max-w-xs">
                  <Search size={14} className="absolute left-3.5 top-3.5 text-[var(--c-text-3)]" />
                  <input
                    value={storeSearch}
                    onChange={e => setStoreSearch(e.target.value)}
                    placeholder="Tìm mã, tên cửa hàng, SUP..."
                    className="w-full text-xs pl-10 pr-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-surface)] text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 transition-all duration-200"
                  />
                </div>

                <button
                  onClick={handleSaveStoreMapToFirebase}
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/25 shadow-md shadow-emerald-600/10 rounded-xl px-5 py-3 flex items-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Save size={14} /> 
                  <span>Lưu ánh xạ SUP Cloud</span>
                </button>
              </div>

              {/* Data Table */}
              <div className="border border-[var(--c-border)] rounded-3xl overflow-hidden bg-[var(--c-surface)] shadow-sm max-h-[440px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[var(--c-bg-2)]/60 border-b border-[var(--c-border)] text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider text-left">
                      <th className="p-4 pl-6">Mã Cửa Hàng</th>
                      <th className="p-4">Tên Cửa Hàng</th>
                      <th className="p-4">Supervisor (SUP)</th>
                      <th className="p-4">Vùng Miền</th>
                      <th className="p-4 text-center w-32">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-border)] text-[var(--c-text-2)] text-xs">
                    {filteredStores.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[var(--c-text-3)] font-medium">
                          Không tìm thấy cấu hình cửa hàng nào!
                        </td>
                      </tr>
                    ) : (
                      filteredStores.map(item => (
                        <tr key={item.storeCode} className="hover:bg-[var(--c-surface-2)]/40 transition-colors">
                          <td className="p-4 pl-6 font-mono font-bold text-[var(--c-text-1)] text-xs">{item.storeCode}</td>
                          <td className="p-4 text-[var(--c-text-1)] font-semibold">
                            {editingStoreCode === item.storeCode ? (
                              <input
                                value={editNameField}
                                onChange={e => setEditNameField(e.target.value)}
                                className="border border-[var(--c-border)] px-3 py-1.5 text-xs rounded-lg bg-[var(--c-surface)] text-[var(--c-text-1)] w-full outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 transition-all"
                              />
                            ) : (
                              item.storeName
                            )}
                          </td>
                          <td className="p-4 font-bold text-[var(--c-text-1)]">
                            {editingStoreCode === item.storeCode ? (
                              <select
                                value={editSupField}
                                onChange={e => setEditSupField(e.target.value)}
                                className="border border-[var(--c-border)] px-2.5 py-1.5 text-xs rounded-lg bg-[var(--c-surface)] text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] font-bold cursor-pointer"
                              >
                                {supsList.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : (
                              item.sup
                            )}
                          </td>
                          <td className="p-4">
                            {editingStoreCode === item.storeCode ? (
                              <select
                                value={editRegionField}
                                onChange={e => setEditRegionField(e.target.value)}
                                className="border border-[var(--c-border)] px-2.5 py-1.5 text-xs rounded-lg bg-[var(--c-surface)] text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] font-bold cursor-pointer"
                              >
                                {regionsList.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 border rounded-lg text-[10px] font-bold font-mono tracking-wide ${
                                item.region === 'NORTH' ? 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-400 dark:border-blue-500/30' :
                                item.region === 'HCM' ? 'bg-purple-500/10 text-purple-600 border-purple-500/25 dark:text-purple-400 dark:border-purple-500/30' :
                                item.region === 'HN' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400 dark:border-emerald-500/30' :
                                'bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400 dark:border-amber-500/30'
                              }`}>{item.region}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              {editingStoreCode === item.storeCode ? (
                                <>
                                  <button onClick={() => handleUpdateStoreInline(item.storeCode)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer shadow-sm">
                                    Lưu
                                  </button>
                                  <button onClick={() => setEditingStoreCode(null)} className="px-2.5 py-1.5 text-[10px] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:underline cursor-pointer">
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
                                    className="p-2 text-[var(--c-text-3)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-2)] rounded-lg cursor-pointer transition-colors"
                                    title="Chỉnh sửa thông tin"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStoreMap(item.storeCode)}
                                    className="p-2 text-[var(--c-text-3)] hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
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
              <div className="text-right text-[10px] text-[var(--c-text-3)] font-mono font-semibold">
                Tổng cộng {filteredStores.length} cửa hàng.
              </div>
            </div>
          )}

          {/* TAB 3: TARGET RETAIL STORES */}
          {activeTab === 'targets' && (
            <div className="space-y-6">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/35 text-[12.5px] text-blue-800 dark:text-blue-300 p-4 rounded-2xl flex gap-3 items-start shadow-sm">
                <Info size={18} className="text-[var(--c-accent)] shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong className="font-semibold text-blue-900 dark:text-blue-200">Chỉ tiêu Target tùy biến:</strong> Toàn bộ store trong chu kỳ tính toán sẽ được tự động đồng bộ. Bạn có thể thiết lập mức doanh số Target riêng cho bất kỳ Store nào để ghi đè số cũ trong file Excel, thích hợp để điều chỉnh khi chạy sự kiện giữa tháng.
                </p>
              </div>

              {/* Action and Search bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:max-w-xs">
                  <Search size={14} className="absolute left-3.5 top-3.5 text-[var(--c-text-3)]" />
                  <input
                    value={targetSearch}
                    onChange={e => setTargetSearch(e.target.value)}
                    placeholder="Tìm tên, mã store hoặc dự án..."
                    className="w-full text-xs pl-10 pr-4 py-3 border border-[var(--c-border)] rounded-xl bg-[var(--c-surface)] text-[var(--c-text-1)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 transition-all duration-200"
                  />
                </div>

                <button
                  onClick={handleSaveTargetsToFirebase}
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/25 shadow-md shadow-emerald-600/10 rounded-xl px-5 py-3 flex items-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Save size={14} /> 
                  <span>Áp dụng Target thực tế</span>
                </button>
              </div>

              {/* Table */}
              <div className="border border-[var(--c-border)] rounded-3xl overflow-hidden bg-[var(--c-surface)] shadow-sm max-h-[440px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[var(--c-bg-2)]/60 border-b border-[var(--c-border)] text-[10px] font-bold text-[var(--c-text-3)] uppercase tracking-wider text-left">
                      <th className="p-4 pl-6">Dự Án</th>
                      <th className="p-4">Mã CH</th>
                      <th className="p-4">Tên Cửa Hàng</th>
                      <th className="p-4 text-right">Target Gốc Excel</th>
                      <th className="p-4 text-right">Target Áp Dụng Thực Tế</th>
                      <th className="p-4 text-center w-32">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-border)] text-[var(--c-text-2)] text-xs">
                    {activeStores.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[var(--c-text-3)] font-medium">
                          Không tìm thấy thông tin điểm bán nào hoạt động trong chu kỳ này!
                        </td>
                      </tr>
                    ) : (
                      activeStores.map(store => {
                        const key = store.code || store.name;
                        const isOverridden = customTargetsList[key] !== undefined;
                        const currentTarget = isOverridden ? customTargetsList[key] : store.baseTarget;

                        return (
                          <tr key={key} className="hover:bg-[var(--c-surface-2)]/40 transition-colors">
                            <td className="p-4 pl-6">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border tracking-wide ${
                                store.project === 'CRV' 
                                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-400 dark:border-blue-500/30' 
                                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-400 dark:border-amber-500/30'
                              }`}>{store.project}</span>
                            </td>
                            <td className="p-4 font-mono font-bold text-[var(--c-text-1)] text-xs">{store.code || '---'}</td>
                            <td className="p-4 font-semibold text-[var(--c-text-1)]">{store.name}</td>
                            <td className="p-4 text-right font-mono text-[var(--c-text-3)] text-xs font-semibold">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(store.baseTarget)}</td>
                            <td className="p-4 text-right font-mono text-xs">
                              {editingTargetCode === key ? (
                                <input
                                  type="number"
                                  placeholder="VND..."
                                  className="w-40 text-right px-3 py-1.5 border border-[var(--c-border)] rounded-lg bg-[var(--c-surface)] text-[var(--c-text-1)] focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 outline-none transition-all"
                                  value={newTargetVal}
                                  onChange={e => setNewTargetVal(e.target.value)}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className="font-bold text-[var(--c-text-1)]">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentTarget)}</span>
                                  {isOverridden && (
                                    <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-bold flex items-center gap-1 shadow-sm">
                                      <Check size={10} className="text-emerald-500" /> Đã chỉnh sửa Cloud
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                {editingTargetCode === key ? (
                                  <>
                                    <button onClick={() => handleUpdateTarget(store.code, store.name)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer shadow-sm">
                                      Lưu
                                    </button>
                                    <button onClick={() => setEditingTargetCode(null)} className="px-2.5 py-1.5 text-[10px] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:underline cursor-pointer">
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
                                      className="px-3.5 py-1.5 border border-[var(--c-border)] hover:bg-[var(--c-surface-2)] text-[var(--c-accent)] rounded-lg text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      Sửa Target
                                    </button>
                                    {isOverridden && (
                                      <button
                                        onClick={() => handleClearCustomTarget(key)}
                                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer transition-colors"
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
              <div className="text-right text-[10px] text-[var(--c-text-3)] font-mono">
                Tổng cộng {activeStores.length} điểm bán có target.
              </div>
            </div>
          )}

          {/* TAB 4: IMPORT & EXPORT EXCEL CENTRAL CONTROL - BENTO GRID */}
          {activeTab === 'excel' && (
            <div className="space-y-6">
              
              {/* Bento Grid layout for importing and exporting */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left block: EXCEL IMPORT ZONE */}
                <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition-all duration-300 min-h-[380px]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[var(--c-text-1)] font-bold text-sm">
                      <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-[var(--c-accent)] shadow-sm">
                        <Upload size={18} />
                      </div>
                      <h3 className="text-sm font-bold text-[var(--c-text-1)] uppercase tracking-wider">Tải lên Cấu hình Excel</h3>
                    </div>
                    <p className="text-xs text-[var(--c-text-2)] leading-relaxed font-semibold">
                      Lựa chọn hoặc kéo thả tệp Excel sao lưu cấu hình có chứa các trang tính khớp với mẫu gộp của hệ thống:
                    </p>
                    
                    <ul className="text-xs text-[var(--c-text-3)] space-y-2 pl-4 list-disc font-semibold">
                      <li><b className="text-[var(--c-text-2)] font-bold">Bang_Gia_SKU</b>: Cập nhật giá bán sỉ/lẻ sản phẩm.</li>
                      <li><b className="text-[var(--c-text-2)] font-bold">Danh_Sach_SUP_Store</b>: Đồng bộ sơ đồ nhân sự Giám sát.</li>
                      <li><b className="text-[var(--c-text-2)] font-bold">Cau_Hinh_Targets</b>: Ghi đè chỉ tiêu doanh thu thực tế.</li>
                    </ul>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-3 transition-all duration-300 ${
                      dragActive 
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/5 scale-[1.01] shadow-inner' 
                        : 'border-[var(--c-border-strong)] bg-[var(--c-bg)]/20 hover:bg-[var(--c-surface-2)]/40 hover:border-[var(--c-accent)]/50'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      id="excel-import-uploader"
                      className="hidden"
                    />
                    <label htmlFor="excel-import-uploader" className="w-full flex flex-col items-center justify-center cursor-pointer py-4">
                      <div className="p-4 bg-white dark:bg-[var(--c-surface)] rounded-2xl shadow-md border border-[var(--c-border)] mb-3 transition-transform duration-300 hover:scale-105">
                        <FileSpreadsheet className="text-[var(--c-accent)]" size={26} />
                      </div>
                      <span className="text-xs font-bold text-[var(--c-text-1)]">Kéo thả tệp tin hoặc nhấn để chọn</span>
                      <span className="text-[10px] text-[var(--c-text-3)] mt-2 font-semibold">Hỗ trợ định dạng .xlsx, .xls tối đa 50MB</span>
                    </label>
                  </div>
                </div>

                {/* Right block: EXCEL EXPORT ZONE */}
                <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition-all duration-300 min-h-[380px]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[var(--c-text-1)] font-bold text-sm">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 shadow-sm">
                        <Download size={18} />
                      </div>
                      <h3 className="text-sm font-bold text-[var(--c-text-1)] uppercase tracking-wider">Tải về Bản Thao Tác Hệ Thống</h3>
                    </div>
                    <p className="text-xs text-[var(--c-text-2)] leading-relaxed font-semibold">
                      Trích xuất cấu hình Bảng giá bán, Bản đồ Sup, và Target hiện tại trong bộ nhớ thành một tệp Excel nhiều trang chuẩn hóa. Tệp tin này dùng làm mẫu chính xác để sửa đổi ngoại tuyến và nhập ngược lại phía đối diện.
                    </p>
                    
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[9px] font-bold">
                      <span className="bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 px-2.5 py-1 rounded-lg">Bang_Gia_SKU</span>
                      <span className="bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 px-2.5 py-1 rounded-lg">Danh_Sach_SUP_Store</span>
                      <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 px-2.5 py-1 rounded-lg">Cau_Hinh_Targets</span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <button
                      onClick={handleExportSystemConfigs}
                      className="btn btn-primary w-full flex justify-center py-3.5 bg-[var(--c-accent)] hover:bg-[var(--c-accent-2)] hover:shadow-lg text-white rounded-xl shadow-md font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                    >
                      <Download size={14} className="mr-1.5" /> Xuất & Tải Excel mẫu chuẩn (.xlsx)
                    </button>
                    <span className="block text-center text-[9px] text-[var(--c-text-3)] font-mono font-semibold">Dữ liệu kết xuất động theo thời gian thực từ Supabase Cloud</span>
                  </div>
                </div>

              </div>

              {/* Parsed summary results panel if loaded successfully */}
              {importResults && (
                <div className="bg-[var(--c-surface)] border border-emerald-500/30 rounded-3xl p-6 space-y-4 animate-fade-in shadow-md hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between border-b border-[var(--c-border)] pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 animate-pulse" size={18} />
                      <h4 className="text-sm font-bold text-[var(--c-text-1)] uppercase tracking-wider">Xem Phác Thảo Bản Phân Tích Excel</h4>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 px-3 py-1 rounded-full uppercase border border-emerald-200/50 dark:border-emerald-900/30 shadow-sm">Đã sẵn sàng đồng bộ</span>
                  </div>

                  <p className="text-xs text-[var(--c-text-2)] font-semibold leading-relaxed">
                     Hệ thống đã nhận diện dữ liệu sửa đổi trong tệp tin. Vui lòng xác định số lượng bản ghi dưới đây trước khi đồng bộ hóa vĩnh viễn:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[var(--c-bg-2)]/30 border border-[var(--c-border)] p-4.5 rounded-2xl text-center shadow-sm">
                      <span className="text-xs text-[var(--c-text-3)] font-bold">SKU Đơn Giá</span>
                      <span className="block text-3xl font-black text-[var(--c-text-1)] mt-1 font-mono">{importResults.skuCount}</span>
                    </div>
                    <div className="bg-[var(--c-bg-2)]/30 border border-[var(--c-border)] p-4.5 rounded-2xl text-center shadow-sm">
                      <span className="text-xs text-[var(--c-text-3)] font-bold">Cửa hàng - SUP</span>
                      <span className="block text-3xl font-black text-[var(--c-text-1)] mt-1 font-mono">{importResults.storeCount}</span>
                    </div>
                    <div className="bg-[var(--c-bg-2)]/30 border border-[var(--c-border)] p-4.5 rounded-2xl text-center shadow-sm">
                      <span className="text-xs text-[var(--c-text-3)] font-bold">Ghi đè Chỉ tiêu Target</span>
                      <span className="block text-3xl font-black text-[var(--c-text-1)] mt-1 font-mono">{importResults.targetCount}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--c-surface-2)]/50 p-4.5 rounded-2xl text-xs space-y-2 border border-[var(--c-border)] text-[var(--c-text-2)] font-medium">
                    {importResults.details.map((item, idx) => (
                      <p key={idx} className="flex gap-2 items-center">
                        <span className="status-dot w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>

                  <div className="flex gap-3 justify-end pt-2 border-t border-[var(--c-border)]">
                    <button
                      onClick={() => setImportResults(null)}
                      className="px-5 py-2.5 border border-[var(--c-border-strong)] rounded-xl text-xs font-bold text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)] cursor-pointer transition-colors"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      onClick={handleApplyImportedData}
                      className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/10 rounded-xl px-5 py-2.5 flex items-center gap-2 cursor-pointer font-bold transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <Save size={14} /> 
                      <span>Ghi Đè Lên Supabase & Áp Dụng</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Informative tutorial notes - Cohesive styling */}
              <div className="bg-amber-50/50 border border-amber-200/50 text-amber-900 dark:bg-amber-950/10 dark:border-amber-900/35 dark:text-amber-300 rounded-3xl p-6 text-xs space-y-4 shadow-sm">
                <h4 className="font-bold flex items-center gap-2 text-amber-950 dark:text-amber-400 text-[13px] uppercase tracking-wide">
                  <AlertCircle size={18} className="text-amber-600" /> 
                  HƯỚNG HẪN QUẢN TRỊ DỮ LIỆU CỐ ĐỊNH PHIÊN LÀM VIỆC
                </h4>
                <p className="leading-relaxed font-semibold">
                  Mọi tùy chỉnh hoặc tệp Excel nhập vào bảng điều khiển được đồng bộ trực tuyến vào <strong className="text-amber-950 dark:text-amber-200">cơ sở dữ liệu Supabase Cloud</strong> liên kết với tài khoản làm việc của bạn.
                </p>
                <div className="border-t border-amber-200/50 dark:border-amber-900/20 pt-3.5 space-y-2 font-medium">
                  <p className="font-bold text-amber-950 dark:text-amber-300 text-xs">
                    Lợi ích cốt lõi của việc này:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong className="text-amber-950 dark:text-amber-300">Cố định dữ liệu:</strong> Cấu hình (đơn giá sản phẩm, giám sát vùng, target) không bị biến mất khi dọn dẹp bộ nhớ đệm (Clear cache) hay khi đóng trình duyệt.</li>
                    <li><strong className="text-amber-950 dark:text-amber-300">Độc lập tải dữ liệu:</strong> Khi bạn tải lên tệp tin Excel số PG mới hàng tuần từ cổng quản trị chính, các quy tắc đơn giá và Ánh xạ SUP trên Cloud vẫn tự động áp dụng chính xác cho file mới mà không cần thiết lập lại từ đầu!</li>
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
