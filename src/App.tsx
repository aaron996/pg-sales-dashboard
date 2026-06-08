import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { LoginScreen, UserProfileMenu, UserManagementPanel, UserProfile, PendingApprovalScreen } from './components/AuthAndUserMgmt';
import { DEFAULT_BASELINE_DATA } from './data';
import { 
  STORE_MAPPING, STORE_SHIFT_CONFIGS, getStoreTarget 
} from './configData';
import { processExcelData, calculateStatus } from './excelParser';
import { 
  fmtVND, fmtVNDfull, fmtTy, Kpi, Chip, AnimatedNumber, Sparkline, RegionRow, 
  TrendChart, TelegramComposer, ExportReport, ExportExcelDialog, DashboardImportPortal,
  useTweaks, TweaksPanel, TweakSection, TweakRadio
} from './components';
import ConfigurePanel, { loadSystemConfigurations } from './components/ConfigurePanel';

// Initialize global INTERDIST_DATA safe for IDX
if (typeof window !== 'undefined') {
  if (!(window as any).INTERDIST_DATA) {
    (window as any).INTERDIST_DATA = DEFAULT_BASELINE_DATA;
    (window as any)._isUsingBaseline = true;
  } else {
    // If we already have some loaded data, respect it
    if (!(window as any)._isUsingBaseline) {
      (window as any)._isUsingBaseline = false;
    }
  }
}
const getFlatRawRows = (D) => {
  if (!D) return [];
  if (D.rawRows && D.rawRows.length > 0) {
    return D.rawRows.map(r => {
      const d = r['Ngày báo cáo'];
      const dateObj = d instanceof Date ? d : new Date(d);
      return {
        ...r,
        dateObj,
        time: dateObj.getTime()
      };
    });
  }
  
  const synthRows: any[] = [];
  const processGroup = (group: any, label: string) => {
    if (!group || !group.stores) return;
    const dailyData = group.daily || {};
    group.stores.forEach((s: any) => {
      const storeCode = s.code || '';
      const storeName = s.store || s.name || '';
      const region = s.region || (label === 'STMB' ? 'NORTH' : '');
      const mapInfo = STORE_MAPPING[storeCode];
      const sup = mapInfo?.sup || (label === 'CRV' ? `Region ${region}` : 'CHIEN');
      
      const daysWithSales = Object.keys(dailyData).filter(dayStr => {
        const regData = dailyData[dayStr]?.[region];
        return regData && regData.TOTAL > 0;
      });
      
      let mtdActual = Number(s.actual || s.actual_mtd || s.actual_full || 0);
      let targetVal = Number(s.target || s.target_full || 0);
      if (mtdActual > 0) {
        if (daysWithSales.length > 0) {
          const amountPerDay = Math.round(mtdActual / daysWithSales.length);
          daysWithSales.forEach((dayStr, idx) => {
            const [d, m] = dayStr.split('/');
            const dateObj = new Date(2026, 4, Number(d)); // May (0-indexed 4)
            synthRows.push({
              'Ngày báo cáo': dateObj,
              dateObj,
              time: dateObj.getTime(),
              'Date_DD_MM': dayStr,
              'Supervisor': sup,
              'Mã cửa hàng': storeCode,
              'Tên cửa hàng': storeName,
              'Project': label.toLowerCase(),
              'Mã vùng': region,
              'AMT': idx === daysWithSales.length - 1 ? (mtdActual - (amountPerDay * (daysWithSales.length - 1))) : amountPerDay,
              'Target': targetVal
            });
          });
        } else {
          const dateObj = new Date(2026, 4, 1);
          synthRows.push({
            'Ngày báo cáo': dateObj,
            dateObj,
            time: dateObj.getTime(),
            'Date_DD_MM': '01/05',
            'Supervisor': sup,
            'Mã cửa hàng': storeCode,
            'Tên cửa hàng': storeName,
            'Project': label.toLowerCase(),
            'Mã vùng': region,
            'AMT': mtdActual,
            'Target': targetVal
          });
        }
      } else {
        const dateObj = new Date(2026, 4, 1);
        synthRows.push({
          'Ngày báo cáo': dateObj,
          dateObj,
          time: dateObj.getTime(),
          'Date_DD_MM': '01/05',
          'Supervisor': sup,
          'Mã cửa hàng': storeCode,
          'Tên cửa hàng': storeName,
          'Project': label.toLowerCase(),
          'Mã vùng': region,
          'AMT': 0,
          'Target': targetVal
        });
      }
    });
  };
  
  processGroup(D.crv, 'CRV');
  processGroup(D.stmb, 'STMB');
  return synthRows;
};

/* === Main Dashboard — original layout fed from real xlsx data === */


// Derive structured pre-computed model from raw data
const buildModel = (period, customRange?: { start: string, end: string }) => {
  const rawD = (window as any).INTERDIST_DATA;
  if (!rawD) {
    return {
      STORES: [],
      REGIONS: [],
      CATEGORIES: [],
      ACTIONS: [],
      raw: {
        crv: {
          meta: { start_day: '---', end_day: '---', updated_to: 'CHƯA CÓ DỮ LIỆU' },
          regions: {},
          stores: [],
          cats: [],
          daily: {}
        },
        stmb: {
          meta: { start_day: '---', end_day: '---', updated_to: 'CHƯA CÓ DỮ LIỆU' },
          regions: {},
          stores: [],
          cats: [],
          daily: {}
        }
      }
    };
  }

  // Deduplicate helper
  const deduplicateStores = (arr: any[]) => {
    const seen = new Set();
    return (arr || []).filter(s => {
      const code = (s.code || '').toLowerCase().trim();
      const name = (s.store || s.name || '').toLowerCase().trim();
      const key = code ? code : name;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const mapStoreTargets = (storeList: any[]) => {
    return (storeList || []).map(s => {
      const code = s.code;
      const name = s.store || s.name || '';
      const baseTarget = s.target_full || s.target || 0;
      const overriddenTarget = getStoreTarget(name, code, baseTarget);
      
      if (overriddenTarget !== baseTarget) {
        const ratio = baseTarget > 0 ? (overriddenTarget / baseTarget) : 1;
        return {
          ...s,
          target: overriddenTarget,
          target_full: overriddenTarget,
          target_mtd: s.target_mtd ? Math.round(s.target_mtd * ratio) : Math.round(overriddenTarget * 0.45),
          target_wtd: s.target_wtd ? Math.round(s.target_wtd * ratio) : Math.round(overriddenTarget / 4.4),
        };
      }
      return s;
    });
  };

  const D = {
    ...rawD,
    crv: rawD.crv ? {
      ...rawD.crv,
      stores: mapStoreTargets(deduplicateStores(rawD.crv.stores))
    } : undefined,
    stmb: rawD.stmb ? {
      ...rawD.stmb,
      stores: mapStoreTargets(deduplicateStores(rawD.stmb.stores))
    } : undefined
  };

  const flatRows = getFlatRawRows(D);

  const getPeriodData = (item, prd, proj) => {
    if (prd === 'custom' && customRange) {
      const startT = new Date(customRange.start + 'T00:00:00').getTime();
      const endT = new Date(customRange.end + 'T23:59:59').getTime();
      
      const storeRows = flatRows.filter(r => 
        r['Mã cửa hàng'] === item.code && 
        r.Project === proj && 
        r.time >= startT && 
        r.time <= endT
      );
      const actual = storeRows.reduce((sum, r) => sum + (r.AMT || 0), 0);
      
      const startDt = new Date(customRange.start + 'T00:00:00');
      const endDt = new Date(customRange.end + 'T23:59:59');
      const numDaysSelected = Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)));
      const totalDaysInMonth = new Date(startDt.getFullYear(), startDt.getMonth() + 1, 0).getDate();
      
      const fullTgt = item.target_full || item.target || 0;
      const target = fullTgt * (numDaysSelected / totalDaysInMonth);
      
      return { actual, target };
    }

    if (prd === 'wtd') {
      return {
        actual: item.actual_wtd || 0,
        target: item.target_wtd || 0,
      };
    } else if (prd === 'mtd') {
      return {
        actual: item.actual_mtd || 0,
        target: item.target_mtd || 0,
      };
    } else {
      return {
        actual: item.actual_full || item.actual_mtd || 0,
        target: item.target_full || item.target || 0,
      };
    }
  };

  // --- Region map ---
  // CRV has 6 real regions. STMB stores are all Lan Chi (Northern VN), treat as STMB-only.
  const CRV_REGIONS = Object.keys(D.crv?.regions || {}); // HN, EAST, HCM, NORTH, CENTRAL, MEKONG

  // --- Stores combined ---
  const stmbStores = (D.stmb?.stores || []).map((s, idx) => {
    const pd = getPeriodData(s, period, 'stmb');
    return {
      id: s.code, uid: s.code || `stmb-${idx}`, name: s.store, channel: 'STMB', store: s.store,
      region: 'NORTH', // Lan Chi system is Northern VN
      rev: pd.actual, target: pd.target,
      pct: pd.target > 0 ? (pd.actual / pd.target * 105) : 0,
      last7: synthLast7(pd.actual / (period === 'wtd' ? 3 : 13)), // pseudo daily revenue (Tr)
    };
  });
  const crvStores = (D.crv?.stores || []).map((s, idx) => {
    const pd = getPeriodData(s, period, 'crv');
    return {
      id: s.code, uid: s.code || `crv-${idx}`, name: s.store, channel: 'CRV', store: s.store,
      region: s.region || 'NORTH',
      rev: pd.actual, target: pd.target,
      pct: pd.target > 0 ? (pd.actual / pd.target * 105) : 0,
      last7: synthLast7(pd.actual / (period === 'wtd' ? 3 : 13)),
    };
  });
  const STORES = [...crvStores, ...stmbStores];

  // --- Regions (CRV's 6 + STMB synthetic) ---
  const REGIONS = CRV_REGIONS.map(r => {
    if (period === 'custom' && customRange) {
      const regionStores = STORES.filter(s => s.region === r && s.channel === 'CRV');
      const actualSum = regionStores.reduce((sum, s) => sum + s.rev, 0);
      const targetSum = regionStores.reduce((sum, s) => sum + s.target, 0);
      const count = regionStores.length;
      return { 
        name: r, 
        rev: actualSum / 1e6, 
        target: targetSum / 1e6, 
        baCount: count, 
        pct: targetSum > 0 ? (actualSum / targetSum * 105) : 0 
      };
    } else {
      const reg = D.crv.regions[r];
      const pd = getPeriodData(reg, period, 'crv');
      return { name: r, rev: pd.actual / 1e6, target: pd.target / 1e6, baCount: reg.count, pct: pd.target > 0 ? (pd.actual / pd.target * 105) : 0 };
    }
  });

  // --- Categories: merge cats across stmb + crv ---
  const catMap: Record<string, any> = {};
  if (period === 'custom' && customRange) {
    const startT = new Date(customRange.start + 'T00:00:00').getTime();
    const endT = new Date(customRange.end + 'T23:59:59').getTime();
    
    // Aggregate category actual from flatRows inside range
    const rangeRows = flatRows.filter(r => r.time >= startT && r.time <= endT);
    rangeRows.forEach(r => {
      if (!r.Category) return;
      const key = r.Category.replace(/\s+/g, '');
      if (!catMap[key]) catMap[key] = { name: r.Category.trim(), rev: 0, target: 0 };
      catMap[key].rev += r.AMT || 0;
    });
    
    const startDt = new Date(customRange.start + 'T00:00:00');
    const endDt = new Date(customRange.end + 'T23:59:59');
    const numDaysSelected = Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDaysInMonth = new Date(startDt.getFullYear(), startDt.getMonth() + 1, 0).getDate();
    const targetScale = numDaysSelected / totalDaysInMonth;
    
    const addCatTarget = (c) => {
      const key = c.cat.replace(/\s+/g, '');
      if (!catMap[key]) catMap[key] = { name: c.cat.trim(), rev: 0, target: 0 };
      catMap[key].target += (c.target_full || c.target || 0) * targetScale;
    };
    (D.crv?.cats || []).forEach(addCatTarget);
    (D.stmb?.cats || []).forEach(addCatTarget);
  } else {
    const addCat = (c) => {
      const key = c.cat.replace(/\s+/g, '');
      const pd = getPeriodData(c, period, (D.crv?.cats || []).includes(c) ? 'crv' : 'stmb');
      if (!catMap[key]) catMap[key] = { name: c.cat.trim(), rev: 0, target: 0 };
      catMap[key].rev += pd.actual;
      catMap[key].target += pd.target;
    };
    (D.crv?.cats || []).forEach(addCat);
    (D.stmb?.cats || []).forEach(addCat);
  }

  const CATEGORIES = Object.values(catMap).map((c: any) => ({
    name: catLabel(c.name.replace(/\s+/g, '')),
    rev: c.rev / 1e6,
    target: c.target / 1e6,
  })).filter((c: any) => c.rev > 0 || c.target > 0);

  // --- Actions: derive from worst stores ---
  const worstStores = [...STORES].sort((a, b) => a.pct - b.pct);
  const ACTIONS = worstStores.slice(0, 6).map(s => ({
    sev: s.pct < 20 ? 'high' : s.pct < 30 ? 'med' : 'low',
    who: `${s.name} (${s.id})`,
    what: `%Ach ${s.pct.toFixed(1)}% · Actual ${fmtVND(s.rev)} / Target ${fmtVND(s.target)}`,
    sla: 'Trong tuần',
    sup: STORE_MAPPING[s.id]?.sup || (s.channel === 'CRV' ? `Region ${s.region}` : 'CHIEN'),
  }));

  return { STORES, REGIONS, CATEGORIES, ACTIONS, raw: D };
};

const synthLast7 = (avgDaily) => {
  const base = Math.max(avgDaily / 1e6, 1);
  return Array.from({ length: 7 }, (_, i) => Math.round(base * (0.7 + Math.random() * 0.6) * 10) / 10);
};

const catLabel = (k) => {
  const m = {
    HAIRCARE: 'Hair Care', SHAVECARE: 'Shave Care', SKINCARE: 'Skin Care', LAUNDRY: 'Laundry',
  };
  return m[k] || k;
};

const App = () => {
  console.log("App.tsx mounting...");
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Listen to Supabase Auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      if (user) {
        setCurrentUser(user);
        // Look up the user's details and role in Supabase profiles table
        try {
          const { data: profileData, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('uid', user.id)
            .maybeSingle();

          if (fetchError) throw fetchError;

          if (profileData) {
            let userRole = profileData.role || 'user';
            
            if (user.email === 'luongthevinh996@gmail.com' && userRole !== 'dev') {
              userRole = 'dev';
              try {
                await supabase
                  .from('profiles')
                  .update({ role: 'dev', updatedAt: new Date().toISOString() })
                  .eq('uid', user.id);
              } catch (err) {
                console.error('Failed to auto-update dev role', err);
              }
            }

            setUserProfile({
              uid: profileData.uid,
              email: profileData.email,
              displayName: profileData.displayName || user.user_metadata?.full_name || user.user_metadata?.name || null,
              photoURL: profileData.photoURL || user.user_metadata?.avatar_url || null,
              role: userRole as 'dev' | 'admin' | 'user' | 'pending',
            });
          } else {
            // Document doesn't exist, create it in profiles table so we register the user
            const isDefaultDev = user.email === 'luongthevinh996@gmail.com';
            const isDefaultAdmin = user.email === 'admin@interdist.com.vn';
            const userDispName = user.user_metadata?.full_name || user.user_metadata?.name || null;
            const userPhotoURL = user.user_metadata?.avatar_url || null;
            const profile: UserProfile = {
              uid: user.id,
              email: user.email || '',
              displayName: userDispName,
              photoURL: userPhotoURL,
              role: isDefaultDev ? 'dev' : (isDefaultAdmin ? 'admin' : 'pending'),
            };
            try {
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  uid: profile.uid,
                  email: profile.email,
                  displayName: profile.displayName,
                  photoURL: profile.photoURL,
                  role: profile.role,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              if (insertError) throw insertError;

              // If role is pending, automatically trigger email approval request to admin
              if (profile.role === 'pending') {
                fetch('/api/send-email', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    email: profile.email,
                    displayName: profile.displayName
                  })
                }).catch(errMail => {
                  console.error('Failed to trigger automatic approval email', errMail);
                });
              }
            } catch (errCre) {
              console.error("Error creating user profile inside onAuthStateChanged:", errCre);
            }
            setUserProfile(profile);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          // Fallback to local profile
          const userDispName = user.user_metadata?.full_name || user.user_metadata?.name || null;
          const userPhotoURL = user.user_metadata?.avatar_url || null;
          setUserProfile({
            uid: user.id,
            email: user.email || '',
            displayName: userDispName,
            photoURL: userPhotoURL,
            role: (user.email === 'luongthevinh996@gmail.com' ? 'dev' : 'pending') as 'dev' | 'admin' | 'user' | 'pending',
          });
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setView('dashboard');
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  // Filters & global routing / popup states defined at top of React component scope
  const [view, setView] = useState('dashboard');
  const [teleOpen, setTeleOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState<any>(null);
  const [excelOpen, setExcelOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [logTick, setLogTick] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [hasRealData, setHasRealData] = useState(() => {
    return typeof window !== 'undefined' && !(window as any)._isUsingBaseline;
  });

  const [selectedChannels, setSelectedChannels] = useState(['crv', 'stmb']);
  const [selectedRegions, setSelectedRegions] = useState(['HN', 'EAST', 'HCM', 'NORTH', 'CENTRAL', 'MEKONG']);
  const [periodTab, setPeriodTab] = useState('mtd'); // 'weekly', 'fullMonth', 'mtd', 'shifts'

  // Custom date range states
  const [custStart, setCustStart] = useState('');
  const [custEnd, setCustEnd] = useState('');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  React.useEffect(() => {
    if (!dateRangeOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDateRangeOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dateRangeOpen]);

  const dateRangeBounds = useMemo(() => {
    const D = (window as any).INTERDIST_DATA;
    const rows = getFlatRawRows(D);
    if (!rows || rows.length === 0) {
      return { min: '2026-05-01', max: '2026-05-31' };
    }
    const times = rows.map(r => r.time).filter(Boolean);
    if (times.length === 0) {
      return { min: '2026-05-01', max: '2026-05-31' };
    }
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const formatDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    return {
      min: formatDateStr(new Date(minTime)),
      max: formatDateStr(new Date(maxTime))
    };
  }, [logTick, hasRealData]);

  useEffect(() => {
    if (dateRangeBounds) {
      setCustStart(dateRangeBounds.min);
      setCustEnd(dateRangeBounds.max);
    }
  }, [dateRangeBounds]);

  // Sticky header and dropdown open states
  const [isSticky, setIsSticky] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scrollToStoreId, setScrollToStoreId] = useState(null);

  const mainRef = useRef(null);

  // Scroll listener on main element to toggle sticky header
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const handleScroll = () => {
      const threshold = window.innerWidth <= 768 ? 80 : 120;
      if (mainEl.scrollTop > threshold) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };
    mainEl.addEventListener('scroll', handleScroll);
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

  // Document click listener to close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.filter-dropdown') && !e.target.closest('.daterange-dropdown') && !e.target.closest('.daterange-picker-container')) {
        setChannelOpen(false);
        setRegionOpen(false);
        setPeriodOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Effect to handle scrolling and highlighting a specific store
  useEffect(() => {
    if (view === 'ba' && scrollToStoreId) {
      const timer = setTimeout(() => {
        const el = document.querySelector(`[data-store-id="${scrollToStoreId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-row');
          setTimeout(() => el.classList.remove('highlight-row'), 2000);
        }
        setScrollToStoreId(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [view, scrollToStoreId]);

  const channelLabel = useMemo(() => {
    if (selectedChannels.length === 2) return 'Cả hai';
    if (selectedChannels.length === 1) return selectedChannels[0].toUpperCase();
    return 'Chọn kênh';
  }, [selectedChannels]);

  const regionLabel = useMemo(() => {
    if (selectedRegions.length === 6) return 'Tất cả';
    if (selectedRegions.length === 0) return 'Chọn vùng';
    if (selectedRegions.length <= 2) return selectedRegions.join(', ');
    return `${selectedRegions.length} vùng`;
  }, [selectedRegions]);

  const periodLabel = useMemo(() => {
    const map = {
      weekly: 'Week to date',
      fullMonth: 'Month to date',
      mtd: 'Month to date',
      shifts: 'Ca làm (Shifts)',
      custom: 'Tùy chọn (Custom)',
    };
    if (periodTab === 'custom' && custStart && custEnd) {
      const formatDM = (sStr) => {
        if (!sStr) return '';
        const parts = sStr.split('-');
        if (parts.length < 3) return sStr;
        return `${parts[2]}/${parts[1]}`;
      };
      return `${formatDM(custStart)} - ${formatDM(custEnd)}`;
    }
    return map[periodTab] || 'Kỳ báo cáo';
  }, [periodTab, custStart, custEnd]);

  // Map periodTab to standard buildModel period
  const period = useMemo(() => {
    if (periodTab === 'weekly') return 'wtd';
    if (periodTab === 'fullMonth') return 'full';
    if (periodTab === 'custom') return 'custom';
    return 'mtd'; // 'mtd' and 'shifts' both map to 'mtd'
  }, [periodTab]);

  const M = useMemo(() => {
    if (period === 'custom') {
      return buildModel('custom', { start: custStart, end: custEnd });
    }
    return buildModel(period);
  }, [period, custStart, custEnd, logTick]);

  const [t, setTweak] = useTweaks({
    theme: 'light',
    density: 'comfortable',
  });

useEffect(() => {
  const initConfigs = async () => {
    if ((window as any).addDashboardLog) {
      (window as any).addDashboardLog("🔌 Initializing persisted system configurations from Firestore...");
    }
    try {
      await loadSystemConfigurations();
    } catch (e) {
      console.error("Failed to load configs:", e);
      if ((window as any).addDashboardLog) {
        (window as any).addDashboardLog("❌ Error: " + e);
      }
    }
    setLogTick(prev => prev + 1);
  };
  initConfigs();
}, []);

useEffect(() => {
  (window as any).__triggerDebugRender = () => {
    setLogTick(prev => prev + 1);
  };
  if ((window as any).addDashboardLog) {
    (window as any).addDashboardLog("ℹ️ App mounted. React Version: " + React.version);
  }
  return () => {
    (window as any).__triggerDebugRender = null;
  };
}, []);

useEffect(() => {
  if ((window as any).addDashboardLog) {
    (window as any).addDashboardLog("ℹ️ excelOpen changed to: " + excelOpen);
  }
}, [excelOpen]);

useEffect(() => {
  if ((window as any).addDashboardLog) {
    (window as any).addDashboardLog("ℹ️ View changed to: " + view);
  }
}, [view]);
  const [selectedBA, setSelectedBA] = useState(null);
  const [baSearch, setBaSearch] = useState('');

  // Filter logic
  const filteredBA = useMemo(() => {
    return M.STORES.filter(b => {
      if (!selectedChannels.map(c => c.toUpperCase()).includes(b.channel)) return false;
      if (!selectedRegions.includes(b.region)) return false;
      if (baSearch) {
        const q = baSearch.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [M, selectedChannels, selectedRegions, baSearch]);

  const filteredTrend = useMemo(() => {
    const D = (window as any).INTERDIST_DATA;
    if (!D) return [];
    // 1. Get all dates
    const allDates = [...new Set([
      ...Object.keys(D.crv?.daily || {}),
      ...Object.keys(D.stmb?.daily || {})
    ])].sort((a, b) => {
      const [da, ma] = a.split('/').map(Number);
      const [db, mb] = b.split('/').map(Number);
      return ma === mb ? da - db : ma - mb;
    });

    // 2. Filter dates by period (WTD: dynamic, MTD: dynamic)
    let activeDates = allDates;
    const meta = D?.crv?.meta || D?.stmb?.meta;
    let currentDay = 13;
    let currentMonth = 5;
    let wtdStartDay = 11;

    if (meta && meta.updated_to) {
      const parts = meta.updated_to.split('-');
      if (parts.length === 3) {
        currentDay = Number(parts[2]);
        currentMonth = Number(parts[1]);
      }
      if (meta.wtd_start) {
        const wParts = meta.wtd_start.split('-');
        if (wParts.length === 3 && Number(wParts[1]) === currentMonth) {
          wtdStartDay = Number(wParts[2]);
        }
      }
    }
    
    if (period === 'mtd') {
      activeDates = allDates.filter(d => {
        const [day, month] = d.split('/').map(Number);
        return month === currentMonth && day <= currentDay;
      });
    } else if (period === 'wtd') {
      activeDates = allDates.filter(d => {
        const [day, month] = d.split('/').map(Number);
        return month === currentMonth && day >= wtdStartDay && day <= currentDay;
      });
    } else if (period === 'custom' && custStart && custEnd) {
      const startT = new Date(custStart + 'T00:00:00').getTime();
      const endT = new Date(custEnd + 'T23:59:59').getTime();
      activeDates = allDates.filter(d => {
        const [day, month] = d.split('/').map(Number);
        const dateObj = new Date(2026, month - 1, day);
        const t = dateObj.getTime();
        return t >= startT && t <= endT;
      });
    }

    // 3. Daily target of selected stores
    const totalSelectedTarget = filteredBA.reduce((s, b) => s + b.target, 0);
    let targetDaily;
    if (period === 'custom' && custStart && custEnd) {
      const customStartT = new Date(custStart + 'T00:00:00').getTime();
      const customEndT = new Date(custEnd + 'T23:59:59').getTime();
      const numDaysSelected = Math.max(1, Math.round((customEndT - customStartT) / (1000 * 60 * 60 * 24)));
      const fullTargetSum = filteredBA.reduce((s, b) => s + (b.target / numDaysSelected), 0);
      targetDaily = Math.round(fullTargetSum / 1e6);
    } else {
      targetDaily = Math.round(totalSelectedTarget / 31 / 1e6);
    }

    // 4. Sum actuals for each active date
    return activeDates.map(d => {
      let crvSum = 0;
      let stmbSum = 0;

      if (selectedChannels.includes('crv') && D.crv.daily[d]) {
        for (const [reg, regData] of Object.entries(D.crv.daily[d])) {
          if (selectedRegions.includes(reg)) {
            crvSum += (regData as any).TOTAL || 0;
          }
        }
      }

      if (selectedChannels.includes('stmb') && D.stmb.daily[d]) {
        for (const [reg, regData] of Object.entries(D.stmb.daily[d])) {
          if (selectedRegions.includes(reg)) {
            stmbSum += (regData as any).TOTAL || 0;
          }
        }
      }

      return {
        d,
        crv: Math.round(crvSum / 1e6),
        stmb: Math.round(stmbSum / 1e6),
        target: targetDaily,
      };
    });
  }, [selectedChannels, selectedRegions, period, custStart, custEnd, filteredBA, logTick]);

  // --- Calculate File-Accurate Revenues & Targets (direct from raw file tables/regions/totals) ---
  const flatRows = useMemo(() => getFlatRawRows(M.raw), [M.raw]);

  const fileStats = useMemo(() => {
    let actual = 0;
    let target = 0;
    let crvActual = 0;
    let crvTarget = 0;
    let stmbActual = 0;
    let stmbTarget = 0;

    const D = M.raw;
    if (!D) return { actual, target, crvActual, crvTarget, stmbActual, stmbTarget };

    const getPeriodField = (obj: any) => {
      if (!obj) return { actual: 0, target: 0 };
      if (periodTab === 'weekly') {
        return {
          actual: obj.actual_wtd || 0,
          target: obj.target_wtd || 0
        };
      } else if (periodTab === 'fullMonth') {
        return {
          actual: obj.actual_full || obj.actual_mtd || obj.actual || 0,
          target: obj.target_full || obj.target || 0
        };
      } else if (periodTab === 'custom') {
        return null;
      } else {
        // 'mtd' is the default
        return {
          actual: obj.actual_mtd || 0,
          target: obj.target_mtd || 0
        };
      }
    };

    if (periodTab === 'custom') {
      // Direct sum from flatRows inside the custom date range to ensure absolute matching!
      if (custStart && custEnd) {
        const startT = new Date(custStart + 'T00:00:00').getTime();
        const endT = new Date(custEnd + 'T23:59:59').getTime();
        
        flatRows.forEach(r => {
          if (r.time >= startT && r.time <= endT) {
            const reg = r['Mã vùng'] || 'NORTH'; // Fallback for STMB
            if (selectedRegions.includes(reg)) {
              if (r.Project === 'crv') {
                crvActual += r.AMT || 0;
              } else if (r.Project === 'stmb') {
                stmbActual += r.AMT || 0;
              }
            }
          }
        });

        // Compute scaled targets for custom range
        const startDt = new Date(custStart + 'T00:00:00');
        const endDt = new Date(custEnd + 'T23:59:59');
        const numDays = Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)));
        const daysInMonth = new Date(startDt.getFullYear(), startDt.getMonth() + 1, 0).getDate();
        const targetScale = numDays / daysInMonth;

        if (D.crv) {
          Object.keys(D.crv.regions || {}).forEach(rName => {
            if (selectedRegions.includes(rName)) {
              crvTarget += (D.crv.regions[rName].target_full || D.crv.regions[rName].target || 0) * targetScale;
            }
          });
        }
        if (D.stmb) {
          Object.keys(D.stmb.regions || {}).forEach(rName => {
            if (selectedRegions.includes(rName)) {
              stmbTarget += (D.stmb.regions[rName].target_full || D.stmb.regions[rName].target || 0) * targetScale;
            }
          });
          
          if (!D.stmb.regions || Object.keys(D.stmb.regions).length === 0) {
            if (selectedRegions.includes('NORTH')) {
              stmbTarget += (D.stmb.total?.target_full || D.stmb.total?.target || 0) * targetScale;
            }
          }
        }

        actual = (selectedChannels.includes('crv') ? crvActual : 0) + (selectedChannels.includes('stmb') ? stmbActual : 0);
        target = (selectedChannels.includes('crv') ? crvTarget : 0) + (selectedChannels.includes('stmb') ? stmbTarget : 0);
      }
    } else {
      // Calculate CRV direct from region metrics to match the file exactly
      if (D.crv) {
        Object.keys(D.crv.regions || {}).forEach(rName => {
          if (selectedRegions.includes(rName)) {
            const val = getPeriodField(D.crv.regions[rName]);
            if (val) {
              crvActual += val.actual;
              crvTarget += val.target;
            }
          }
        });
      }

      // Calculate STMB direct from stmb total to match the file exactly
      if (D.stmb) {
        if (D.stmb.regions && Object.keys(D.stmb.regions).length > 0) {
          Object.keys(D.stmb.regions).forEach(rName => {
            if (selectedRegions.includes(rName)) {
              const val = getPeriodField(D.stmb.regions[rName]);
              if (val) {
                stmbActual += val.actual;
                stmbTarget += val.target;
              }
            }
          });
        } else if (selectedRegions.includes('NORTH')) {
          const val = getPeriodField(D.stmb.total);
          if (val) {
            stmbActual += val.actual;
            stmbTarget += val.target;
          }
        }
      }

      actual = (selectedChannels.includes('crv') ? crvActual : 0) + (selectedChannels.includes('stmb') ? stmbActual : 0);
      target = (selectedChannels.includes('crv') ? crvTarget : 0) + (selectedChannels.includes('stmb') ? stmbTarget : 0);
    }

    return {
      actual,
      target,
      crvActual,
      crvTarget,
      stmbActual,
      stmbTarget
    };
  }, [selectedChannels, selectedRegions, periodTab, custStart, custEnd, M.raw, flatRows]);

  // Totals
  const totalRev = fileStats.actual;
  const totalTarget = fileStats.target;
  const targetPct = totalTarget ? (totalRev / totalTarget * 100) : 0;
  const baActive = filteredBA.length;
  const baRisk = filteredBA.filter(b => b.pct < 30).length;
  const baStar = filteredBA.filter(b => b.pct >= 40).length;
  const crvRev = fileStats.crvActual;
  const stmbRev = fileStats.stmbActual;

  const sparkAll = filteredTrend.map(d => d.crv + d.stmb);
  const sparkCrv = filteredTrend.map(d => d.crv);
  const sparkStmb = filteredTrend.map(d => d.stmb);

  // PDF print using (window as any).html2pdf
  const handlePrintPDF = (channel) => {
    setExportOpen(channel || 'crv');
    setTimeout(() => {
      const modal = document.querySelector('.report-modal') as any;
      const body = document.querySelector('.report-body') as any;
      if (modal && body) {
        // Save original inline styles
        const origModalStyle = modal.style.cssText;
        const origBodyStyle = body.style.cssText;
        
        // Force full height to prevent cutoff
        modal.style.maxHeight = 'none';
        modal.style.height = 'auto';
        modal.style.overflow = 'visible';
        modal.style.display = 'block';
        
        body.style.maxHeight = 'none';
        body.style.height = 'auto';
        body.style.overflow = 'visible';

        const opt = {
          margin:       [10, 10, 10, 10],
          filename:     `PG_Interdist_Report_${channel || 'crv'}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 1024 },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        (window as any).html2pdf().set(opt).from(modal).save().then(() => {
          // Restore styles
          modal.style.cssText = origModalStyle;
          body.style.cssText = origBodyStyle;
        });
      }
    }, 500);
  };

  if (!authReady) {
    return (
      <div className="login-container">
        <div className="admin-panel-loading">
          <svg className="animate-spin text-primary" style={{ animation: 'spin 1.5s linear infinite' }} width="32" height="32" fill="none" viewBox="0 0 24 24">
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <circle cx="12" cy="12" r="10" stroke="var(--c-border-strong)" strokeWidth="3" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="mt-4 font-medium" style={{ color: 'var(--c-text-3)' }}>Đang tải cấu hình bảo mật...</span>
        </div>
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return (
      <LoginScreen onAuthSuccess={(user, profile) => {
        setCurrentUser(user);
        setUserProfile(profile);
      }} />
    );
  }

  if (userProfile.role === 'pending') {
    return (
      <PendingApprovalScreen 
        user={currentUser} 
        profile={userProfile} 
        onLogout={() => {
          setCurrentUser(null);
          setUserProfile(null);
        }} 
      />
    );
  }

  return (
    <div className={`app theme-${t.theme} density-${t.density} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          {!sidebarCollapsed && <img className="brand-logo" src="https://i.ibb.co/DDQVDRbH/image.png" alt="Interdist Logo" />}
          <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu"}>
            {sidebarCollapsed ? (
              <svg className="sidebar-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            ) : (
              <svg className="sidebar-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            )}
          </button>
        </div>

        <UserProfileMenu profile={userProfile} onLogout={handleLogout} onOpenUserMgmt={() => setView('admin_users')} />

        <nav className="nav">
          <div className="nav-section">OVERVIEW</div>
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); if (periodTab === 'shifts') setPeriodTab('mtd'); }}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            <span className="nav-label">
              <span className="nav-label-desktop">Overall</span>
              <span className="nav-label-mobile">Tổng quan</span>
            </span>
          </button>
          <button className={`nav-item ${view === 'detail_reports' ? 'active' : ''}`} onClick={() => setView('detail_reports')}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            <span className="nav-label">
              <span className="nav-label-desktop">Detail reports</span>
              <span className="nav-label-mobile">Chi tiết</span>
            </span>
          </button>


          <div className="nav-section">CHANNEL</div>
          <button 
            className={`nav-item ${view === 'ba' && selectedChannels.length === 1 && selectedChannels[0] === 'crv' ? 'active' : ''}`} 
            onClick={() => { setSelectedChannels(['crv']); setView('ba'); if (periodTab === 'shifts') setPeriodTab('mtd'); }}
          >
            <svg className="nav-icon crv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span className="nav-label">
              <span className="nav-label-desktop">CRV BA Long Term</span>
              <span className="nav-label-mobile">Dự án CRV</span>
            </span>
            <span className="nav-pill mono">{M.STORES.filter(b => b.channel === 'CRV').length}</span>
          </button>
          <button 
            className={`nav-item ${view === 'ba' && selectedChannels.length === 1 && selectedChannels[0] === 'stmb' ? 'active' : ''}`} 
            onClick={() => { setSelectedChannels(['stmb']); setView('ba'); if (periodTab === 'shifts') setPeriodTab('mtd'); }}
          >
            <svg className="nav-icon stmb" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span className="nav-label">
              <span className="nav-label-desktop">STMB</span>
              <span className="nav-label-mobile">Dự án STMB</span>
            </span>
            <span className="nav-pill mono">{M.STORES.filter(b => b.channel === 'STMB').length}</span>
          </button>

          <div className="nav-section">TOOLS</div>
          <button className={`nav-item ${exportOpen !== null ? 'active' : ''}`} onClick={() => setExportOpen('crv')}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span className="nav-label">Export Report</span>
          </button>
          <button className={`nav-item ${excelOpen ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if ((window as any).addDashboardLog) (window as any).addDashboardLog("🔌 Clicked sidebar Export Excel - setting excelOpen = true"); setExcelOpen(true); }}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
            <span className="nav-label">Export Excel</span>
          </button>
          {(userProfile?.role === 'dev' || userProfile?.role === 'admin') && (
            <button className={`nav-item ${view === 'import_portal' ? 'active' : ''}`} onClick={() => setView('import_portal')}>
              <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 8 8 12 12 16"></polyline><line x1="16" y1="12" x2="8" y2="12"></line></svg>
              <span className="nav-label">Cổng Dữ Liệu</span>
            </button>
          )}
          <button className={`nav-item ${view === 'configure' ? 'active' : ''}`} onClick={() => setView('configure')}>
            <svg className="nav-icon text-indigo-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="nav-label">Configure</span>
          </button>

          <div className="nav-section">ABOUT</div>
          <button className={`nav-item ${view === 'info' ? 'active' : ''}`} onClick={() => setView('info')}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <span className="nav-label">
              <span className="nav-label-desktop">Thông tin dashboard</span>
              <span className="nav-label-mobile">Thông tin</span>
            </span>
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="status-line">
            <span className="status-dot" />
            <span className="mono">SYNC · {M.raw.crv?.meta?.updated_to || M.raw.stmb?.meta?.updated_to || "---"}</span>
          </div>
          <div className="status-source mono">SAP → Snowflake → Dashboard</div>
        </div>
      </aside>

      <div className="main-container">
        <div className={`sticky-header-container ${isSticky ? 'is-sticky' : ''}`}>
          <div className="sticky-row">
            <div className="sticky-left">
              <img className="sticky-logo" src="https://i.ibb.co/DDQVDRbH/image.png" alt="Logo" />
              <span className="sticky-title">Báo cáo P&G</span>
            </div>
            
            <div className="sticky-middle">
              {/* Channel Dropdown */}
              <div className="filter-dropdown">
                <button className={`dropdown-trigger ${channelOpen ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); setChannelOpen(!channelOpen); setRegionOpen(false); setPeriodOpen(false); }}>
                  <span className="dropdown-label-title">Kênh:</span>
                  <span className="dropdown-label-value">{channelLabel}</span>
                  <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {channelOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-item" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChannels(c => c.includes('crv') ? c.filter(x => x !== 'crv') : [...c, 'crv']);
                    }}>
                      <input type="checkbox" checked={selectedChannels.includes('crv')} readOnly />
                      <span className="dot" style={{ background: 'var(--c-crv)', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', marginRight: '6px' }} />
                      <span>CRV</span>
                    </div>
                    <div className="dropdown-item" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChannels(c => c.includes('stmb') ? c.filter(x => x !== 'stmb') : [...c, 'stmb']);
                    }}>
                      <input type="checkbox" checked={selectedChannels.includes('stmb')} readOnly />
                      <span className="dot" style={{ background: 'var(--c-stmb)', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', marginRight: '6px' }} />
                      <span>STMB</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Region Dropdown */}
              <div className="filter-dropdown">
                <button className={`dropdown-trigger ${regionOpen ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); setRegionOpen(!regionOpen); setChannelOpen(false); setPeriodOpen(false); }}>
                  <span className="dropdown-label-title">Vùng:</span>
                  <span className="dropdown-label-value">{regionLabel}</span>
                  <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {regionOpen && (
                  <div className="dropdown-menu scrollable">
                    {['HN', 'EAST', 'HCM', 'NORTH', 'CENTRAL', 'MEKONG'].map(r => (
                      <div key={r} className="dropdown-item" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRegions(rr => rr.includes(r) ? rr.filter(x => x !== r) : [...rr, r]);
                      }}>
                        <input type="checkbox" checked={selectedRegions.includes(r)} readOnly />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Period Dropdown */}
              <div className="filter-dropdown">
                <button className={`dropdown-trigger ${periodOpen ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); setPeriodOpen(!periodOpen); setChannelOpen(false); setRegionOpen(false); }}>
                  <span className="dropdown-label-title">Kỳ:</span>
                  <span className="dropdown-label-value">{periodLabel}</span>
                  <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {periodOpen && (
                  <div className="dropdown-menu">
                    {[
                      { val: 'weekly', label: 'Tuần (Weekly)' },
                      { val: 'fullMonth', label: 'Tháng (Full)' },
                      { val: 'mtd', label: 'Luỹ kế (MTD)' },
                      { val: 'custom', label: 'Tùy chọn (Custom)' },
                      view === 'detail_reports' ? { val: 'shifts', label: 'Ca làm (Shifts)' } : null
                    ].filter(Boolean).map(item => (
                      <div key={item.val} className={`dropdown-item option ${periodTab === item.val ? 'active' : ''}`} onClick={(e) => {
                        e.stopPropagation();
                        if (item.val === 'custom') {
                          setTempStart(custStart || dateRangeBounds.min);
                          setTempEnd(custEnd || dateRangeBounds.max);
                          setDateRangeOpen(true);
                        } else {
                          setPeriodTab(item.val);
                        }
                        setPeriodOpen(false);
                      }}>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky-right">
              <button className="btn-theme-toggle" onClick={() => setTweak('theme', t.theme === 'light' ? 'dark' : 'light')} title="Chuyển chế độ Sáng/Tối">
                {t.theme === 'light' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <main className="main" ref={mainRef}>
          {view !== 'admin_users' && view !== 'configure' && (
            <header className="topbar anim-rise" style={{ animationDelay: '50ms' }}>
              <div className="topbar-left">
                <div className="topbar-eyebrow-row">
                  <img className="topbar-mobile-logo" src="https://i.ibb.co/DDQVDRbH/image.png" alt="Interdist Logo" />
                  <div className="topbar-eyebrow mono">PERIOD · {M.raw.crv?.meta?.start_day || M.raw.stmb?.meta?.start_day || "---"} → {M.raw.crv?.meta?.end_day || M.raw.stmb?.meta?.end_day || "---"} · UPDATED {M.raw.crv?.meta?.updated_to || M.raw.stmb?.meta?.updated_to || "---"}</div>
                </div>
                <h1 className="topbar-title">Báo cáo Bán hàng dự án P&G</h1>
              </div>
              <div className="topbar-right">
                <button className="btn-theme-toggle" onClick={() => setTweak('theme', t.theme === 'light' ? 'dark' : 'light')} title="Chuyển chế độ Sáng/Tối">
                  {t.theme === 'light' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                  )}
                </button>
              </div>
            </header>
          )}

          {view !== 'admin_users' && view !== 'configure' && (
            <div className="filterbar anim-rise" style={{ animationDelay: '120ms' }}>
              <div className="filter-group">
                <span className="filter-label mono">CHANNEL</span>
                <Chip active={selectedChannels.includes('crv')} onClick={() => setSelectedChannels(c => c.includes('crv') ? c.filter(x => x !== 'crv') : [...c, 'crv'])}>
                  <span className="dot" style={{ background: 'var(--c-crv)' }} />CRV
                </Chip>
                <Chip active={selectedChannels.includes('stmb')} onClick={() => setSelectedChannels(c => c.includes('stmb') ? c.filter(x => x !== 'stmb') : [...c, 'stmb'])}>
                  <span className="dot" style={{ background: 'var(--c-stmb)' }} />STMB
                </Chip>
              </div>

              <div className="filter-divider" />

              <div className="filter-group">
                <span className="filter-label mono">REGION</span>
                {['HN', 'EAST', 'HCM', 'NORTH', 'CENTRAL', 'MEKONG'].map(r => (
                  <Chip key={r} active={selectedRegions.includes(r)} onClick={() => setSelectedRegions(rr => rr.includes(r) ? rr.filter(x => x !== r) : [...rr, r])}>
                    {r}
                  </Chip>
                ))}
              </div>

              <div className="filter-divider" />

              <div className="period-tabs-container">
                <button className={`period-tab-btn ${periodTab === 'weekly' ? 'active' : ''}`} onClick={() => setPeriodTab('weekly')}>Week to date</button>
                <button className={`period-tab-btn ${periodTab === 'mtd' ? 'active' : ''}`} onClick={() => setPeriodTab('mtd')}>Month to date</button>
                
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button className={`period-tab-btn ${periodTab === 'custom' ? 'active' : ''}`} onClick={() => {
                    setTempStart(custStart || dateRangeBounds.min);
                    setTempEnd(custEnd || dateRangeBounds.max);
                    setDateRangeOpen(prev => !prev);
                  }}>
                    {periodTab === 'custom' && custStart && custEnd ? `Lọc ngày: ${custStart.split('-')[2]}/${custStart.split('-')[1]} - ${custEnd.split('-')[2]}/${custEnd.split('-')[1]}` : 'Tùy chọn (Custom)'}
                  </button>
                  {dateRangeOpen && (
                    <>
                      <div 
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 9998,
                          background: 'transparent',
                          backdropFilter: 'none'
                        }}
                        onClick={() => setDateRangeOpen(false)}
                      />
                      <div 
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: '8px',
                          width: '380px',
                          padding: '20px',
                          borderRadius: '16px',
                          background: 'var(--c-surface)',
                          border: '1px solid var(--c-border)',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                          zIndex: 99999
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <h3 style={{ marginTop: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--c-text-1)', marginBottom: '8px' }}>Chọn khoảng thời gian</h3>
                        <p style={{ color: 'var(--c-text-2)', fontSize: '12px', marginBottom: '16px' }}>
                          Chọn ngày bắt đầu và ngày kết thúc trong khoảng dữ liệu cho phép ({dateRangeBounds.min} → {dateRangeBounds.max}).
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--c-text-2)', marginBottom: '4px' }}>Từ ngày</label>
                            <input 
                              type="date"
                              value={tempStart}
                              min={dateRangeBounds.min}
                              max={dateRangeBounds.max}
                              onChange={e => setTempStart(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid var(--c-border)',
                                background: 'var(--c-bg)',
                                color: 'var(--c-text-1)',
                                fontSize: '13px'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--c-text-2)', marginBottom: '4px' }}>Đến ngày</label>
                            <input 
                              type="date"
                              value={tempEnd}
                              min={dateRangeBounds.min}
                              max={dateRangeBounds.max}
                              onChange={e => setTempEnd(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid var(--c-border)',
                                background: 'var(--c-bg)',
                                color: 'var(--c-text-1)',
                                fontSize: '13px'
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button 
                            onClick={() => setDateRangeOpen(false)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--c-border)',
                              background: 'transparent',
                              color: 'var(--c-text-1)',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            Hủy
                          </button>
                          <button 
                            onClick={() => {
                              if (tempStart && tempEnd) {
                                setCustStart(tempStart);
                                setCustEnd(tempEnd);
                                setPeriodTab('custom');
                                setDateRangeOpen(false);
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'var(--c-primary, #0066cc)',
                              color: '#fff',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {view === 'detail_reports' && (
                  <button className={`period-tab-btn ${periodTab === 'shifts' ? 'active' : ''}`} onClick={() => setPeriodTab('shifts')}>Ca làm (Shifts)</button>
                )}
              </div>
            </div>
          )}

        {view === 'dashboard' && (
          <>
            <div className="alert anim-rise" style={{ animationDelay: '180ms' }}>
              <div className="alert-icon">⚠</div>
              <div className="alert-body">
                <div className="alert-title">
                  <span className="mono"><AnimatedNumber value={baRisk} duration={700} /></span> store dưới 30% target — cần follow-up trong hôm nay
                </div>
                <div className="alert-sub">
                  Worst: {[...filteredBA].sort((a,b) => a.pct - b.pct).slice(0,3).map(s => s.name).join(' · ') || '—'}. Supervisor được tag tự động qua Telegram.
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const sorted = [...filteredBA].sort((a, b) => a.pct - b.pct);
                if (sorted.length > 0) {
                  const worst = sorted[0];
                  setBaSearch('');
                  if (periodTab === 'shifts') setPeriodTab('mtd');
                  setSelectedChannels([worst.channel.toLowerCase()]);
                  setView('ba');
                  setScrollToStoreId(worst.uid);
                } else {
                  setView('ba');
                }
              }}>Xem stores →</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setTeleOpen(true)}>Gửi alert</button>
            </div>

            <div className="kpi-grid">
              <Kpi animIdx={0}
                label="ACTUAL SO MTD"
                value={fmtTy(totalRev)}
                suffix="tỷ"
                delta={`${period.toUpperCase()} · ${filteredBA.length} stores`}
                deltaDir="neutral"
                spark={sparkAll}
                sparkColor="var(--c-accent)"
                footer={`/ ${fmtTy(totalTarget)} tỷ target`}
                accent="var(--c-text-1)"
                onClick={() => setSelectedChannels(['crv', 'stmb'])}
                active={selectedChannels.length === 2}
              />
              <Kpi animIdx={1}
                label="%ACH FULL MONTH"
                value={targetPct.toFixed(1)}
                suffix="%"
                delta={targetPct >= 40 ? 'on-track' : 'off-track'}
                deltaDir={targetPct >= 40 ? 'up' : 'down'}
                spark={filteredTrend.map(d => d.target > 0 ? (d.crv + d.stmb) / d.target * 100 : 0)}
                sparkColor={targetPct >= 40 ? 'var(--c-good)' : targetPct >= 30 ? 'var(--c-warn)' : 'var(--c-bad)'}
                footer={`Gap: ${fmtCompact(Math.max(0, totalTarget - totalRev))}`}
                accent={targetPct >= 40 ? 'var(--c-good)' : targetPct >= 30 ? 'var(--c-warn)' : 'var(--c-bad)'}
                onClick={() => setSelectedChannels(['crv', 'stmb'])}
              />
              <Kpi animIdx={2}
                label="CRV CHANNEL"
                value={fmtTy(crvRev)}
                suffix="tỷ"
                delta={`${filteredBA.filter(b => b.channel === 'CRV').length} stores`}
                deltaDir="neutral"
                spark={sparkCrv}
                sparkColor="var(--c-crv)"
                footer="GO! · BIGC stores"
                accent="var(--c-crv)"
                onClick={() => {
                  if (selectedChannels.length === 1 && selectedChannels[0] === 'crv') {
                    setSelectedChannels(['crv', 'stmb']);
                  } else {
                    setSelectedChannels(['crv']);
                  }
                }}
                active={selectedChannels.length === 1 && selectedChannels[0] === 'crv'}
              />
              <Kpi animIdx={3}
                label="STMB CHANNEL"
                value={fmtTy(stmbRev)}
                suffix="tỷ"
                delta={`${filteredBA.filter(b => b.channel === 'STMB').length} stores`}
                deltaDir="neutral"
                spark={sparkStmb}
                sparkColor="var(--c-stmb)"
                footer="Lan Chi system"
                accent="var(--c-stmb)"
                onClick={() => {
                  if (selectedChannels.length === 1 && selectedChannels[0] === 'stmb') {
                    setSelectedChannels(['crv', 'stmb']);
                  } else {
                    setSelectedChannels(['stmb']);
                  }
                }}
                active={selectedChannels.length === 1 && selectedChannels[0] === 'stmb'}
              />
              <Kpi animIdx={4}
                label="STORES ACTIVE"
                value={baActive}
                delta={`${baStar} ★ · ${baRisk} ⚠`}
                deltaDir="neutral"
                footer={`/ ${M.STORES.length} total`}
                accent="var(--c-text-1)"
                onClick={() => setSelectedChannels(['crv', 'stmb'])}
              />
              <Kpi animIdx={5}
                label="DAILY ORDERS"
                value={Math.round(filteredTrend.reduce((s,d) => s + d.crv + d.stmb, 0) / 5)}
                delta="ø / day"
                deltaDir="neutral"
                spark={sparkAll}
                sparkColor="var(--c-text-2)"
                footer="Triệu VNĐ/ngày"
                accent="var(--c-text-1)"
                onClick={() => setSelectedChannels(['crv', 'stmb'])}
              />
            </div>

            <div className="canvas-grid">
              <section className="panel panel-trend anim-rise" style={{ animationDelay: '500ms' }}>
                <div className="panel-head">
                  <div>
                    <div className="panel-eyebrow mono">REVENUE TREND</div>
                    <div className="panel-title">Doanh số ngày · Triệu VNĐ</div>
                  </div>
                  <div className="panel-legend">
                    {selectedChannels.includes('crv') && <span className="legend-item"><span className="dot" style={{ background: 'var(--c-crv)' }} />CRV</span>}
                    {selectedChannels.includes('stmb') && <span className="legend-item"><span className="dot" style={{ background: 'var(--c-stmb)' }} />STMB</span>}
                    <span className="legend-item"><span className="dash" />Daily target</span>
                  </div>
                </div>
                <TrendChart data={filteredTrend} channels={selectedChannels} height={280} />
              </section>
            </div>

            <div className="bottom-grid">
              <section className="panel anim-rise" style={{ animationDelay: '700ms' }}>
                <div className="panel-head">
                  <div>
                    <div className="panel-eyebrow mono">REGION BREAKDOWN · CRV</div>
                    <div className="panel-title">Doanh số · Target · Stores</div>
                  </div>
                </div>
                <div className="region-list">
                  {M.REGIONS.filter(r => selectedRegions.includes(r.name)).sort((a,b) => b.pct - a.pct).map((r, i) => (
                    <RegionRow key={r.name} r={r} idx={i} />
                  ))}
                </div>
              </section>

              <section className="panel anim-rise" style={{ animationDelay: '800ms' }}>
                <div className="panel-head">
                  <div>
                    <div className="panel-eyebrow mono">CATEGORY MIX</div>
                    <div className="panel-title">Hoàn thành target · {M.CATEGORIES.length} ngành hàng</div>
                  </div>
                </div>
                <div className="cat-list">
                  {M.CATEGORIES.map((c, i) => {
                    const pct = c.target > 0 ? (c.rev / c.target * 100) : 0;
                    return (
                      <div key={c.name} className="cat-row anim-slide-in" style={{ animationDelay: `${i * 70}ms` }}>
                        <div className="cat-name">{c.name}</div>
                        <div className="cat-bar">
                          <div className={`cat-fill cat-fill-anim ${pct >= 100 ? 'good' : pct >= 85 ? 'warn' : 'bad'}`} style={{ '--target-w': `${Math.min(pct, 100)}%`, animationDelay: `${i * 70 + 200}ms` }} />
                          <div className="cat-target-mark" style={{ left: '100%' }} />
                        </div>
                        <div className={`cat-pct mono ${pct >= 100 ? 'good' : pct >= 85 ? 'warn' : 'bad'}`}>
                          <AnimatedNumber value={pct} decimals={0} duration={1100} />%
                        </div>
                        <div className="cat-rev mono">{fmtCompact(c.rev * 1e6)}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <BAPanel data={filteredBA} onOpenBA={setSelectedBA} compact />
          </>
        )}

        {view === 'detail_reports' && (
          <DetailedTables activeTab={periodTab} selectedChannels={selectedChannels} selectedRegions={selectedRegions} />
        )}

        {view === 'ba' && (
          <BAPanel data={filteredBA} onOpenBA={setSelectedBA} search={baSearch} onSearch={setBaSearch} full />
        )}

        {view === 'info' && (
          <DashboardInfoPanel />
        )}

        {view === 'configure' && (
          <ConfigurePanel onConfigChanged={() => setLogTick(prev => prev + 1)} interdistData={M.raw} userProfile={userProfile} />
        )}

        {view === 'import_portal' && (userProfile?.role === 'dev' || userProfile?.role === 'admin') && (
          <DashboardImportPortal
            theme={t.theme}
            canClose={true}
            isFullScreen={false}
            userProfile={userProfile}
            onClose={() => setView('dashboard')}
            onDataParsed={(processedData, fileName, shouldClose = true) => {
              (window as any).INTERDIST_DATA = processedData;
              (window as any)._isUsingBaseline = false;
              setHasRealData(true);
              setLogTick(prev => prev + 1);
              setUploadedFileName(fileName);
              if (shouldClose) {
                setView('dashboard');
              }
            }}
          />
        )}

         {view === 'admin_users' && (
          <UserManagementPanel currentUserId={currentUser.uid} userRole={userProfile?.role} onBackToDashboard={() => setView('dashboard')} />
        )}
      </main>
    </div>

      <TelegramComposer open={teleOpen} onClose={() => setTeleOpen(false)} project={selectedChannels.length === 1 ? selectedChannels[0] : 'stmb'} pdata={M.raw[selectedChannels.length === 1 ? selectedChannels[0] : 'stmb']} />
      {/* ExportReport temporarily archived — see src/archives/placeholder-components.tsx */}
      {/* <ExportReport open={!!exportOpen} project={exportOpen} pdata={exportOpen ? M.raw[exportOpen] : null} onClose={() => setExportOpen(null)} onPrint={() => handlePrintPDF(exportOpen)} /> */}
      <ExportExcelDialog
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        activeChannels={selectedChannels}
        activeRegions={selectedRegions}
        activePeriod={period}
      />
      <BADrawer ba={selectedBA} onClose={() => setSelectedBA(null)} />
      <DashboardDebugConsole open={debugOpen} onClose={() => setDebugOpen(false)} onOpen={() => setDebugOpen(true)} excelOpen={excelOpen} setExcelOpen={setExcelOpen} />



      <TweaksPanel title="Tweaks">
        <TweakSection label="Visual">
          <TweakRadio label="Theme" value={t.theme} onChange={v => setTweak('theme', v)} options={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]} />
          <TweakRadio label="Density" value={t.density} onChange={v => setTweak('density', v)} options={[{ label: 'Roomy', value: 'comfortable' }, { label: 'Dense', value: 'dense' }]} />
        </TweakSection>
      </TweaksPanel>

      {(userProfile?.role === 'dev' || userProfile?.role === 'admin') && !hasRealData && (
        <DashboardImportPortal 
          theme={t.theme}
          canClose={false}
          isFullScreen={true}
          userProfile={userProfile}
          onClose={() => {}}
          onDataParsed={(processedData, fileName) => {
            (window as any).INTERDIST_DATA = processedData;
            (window as any)._isUsingBaseline = false;
            setHasRealData(true);
            setLogTick(prev => prev + 1);
            setUploadedFileName(fileName);
          }}
        />
      )}
    </div>
  );
};

const DashboardInfoPanel = () => {
  return (
    <section className="panel panel-info anim-rise" style={{ animationDelay: '50ms', maxWidth: '800px', margin: '20px auto' }}>
      <div className="panel-head info-header">
        <div className="info-title-group">
          <div className="panel-eyebrow mono">SYSTEM INFORMATION</div>
          <h2 className="panel-title">Thông tin hệ thống Dashboard</h2>
        </div>
      </div>
      <div className="info-body">
        <div className="info-card">
          <div className="info-logo-wrap">
            <img src="https://i.ibb.co/DDQVDRbH/image.png" alt="Interdist Logo" className="info-logo" />
          </div>
          <div className="info-details">
            <div className="info-row-detail">
              <span className="info-label-text">Tên hệ thống:</span>
              <span className="info-val-text font-bold" style={{ fontWeight: '700' }}>P&G Sales Operations Dashboard</span>
            </div>
            <div className="info-row-detail">
              <span className="info-label-text">Phiên bản:</span>
              <span className="info-val-text badge-version mono">v3.0.0</span>
            </div>
            <div className="info-row-detail">
              <span className="info-label-text">Cập nhật cuối:</span>
              <span className="info-val-text mono">08/06/2026</span>
            </div>
            <div className="info-row-detail">
              <span className="info-label-text">Bản quyền & Phát triển:</span>
              <span className="info-val-text font-bold" style={{ fontWeight: '700' }}>Lương Thế Vinh</span>
            </div>
            <div className="info-row-detail">
              <span className="info-label-text">Liên hệ hỗ trợ:</span>
              <span className="info-val-text">
                <a href="mailto:luongthevinh996@gmail.com" className="info-link mono">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  luongthevinh996@gmail.com
                </a>
              </span>
            </div>
          </div>
        </div>

        <div className="info-features">
          <h3 className="info-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>🕐</span> Latest Updates
            <span className="badge-version mono" style={{ fontSize: '11px', padding: '2px 8px', marginLeft: '4px' }}>v3.0.0 · 08/06/2026</span>
          </h3>
          <ul className="info-feature-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ display: 'flex', gap: '10px', fontSize: '13px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <span style={{ minWidth: '20px', color: '#22c55e', fontWeight: 700 }}>✦</span>
              <span><b style={{ color: 'var(--c-text-1)' }}>Export Excel theo filter đang chọn:</b> Tải Excel tự động phản chiếu đúng kênh, vùng, kỳ mà người dùng đang xem.</span>
            </li>
            <li style={{ display: 'flex', gap: '10px', fontSize: '13px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <span style={{ minWidth: '20px', color: '#6366f1', fontWeight: 700 }}>✦</span>
              <span><b style={{ color: 'var(--c-text-1)' }}>Import Portal toàn màn hình:</b> Cổng nhập dữ liệu hiển thị trực tiếp khi chưa có data, hỗ trợ multi-file merge và log audit.</span>
            </li>
            <li style={{ display: 'flex', gap: '10px', fontSize: '13px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.15)' }}>
              <span style={{ minWidth: '20px', color: '#0ea5e9', fontWeight: 700 }}>✦</span>
              <span><b style={{ color: 'var(--c-text-1)' }}>Auth & User Management:</b> Supabase login, phân quyền dev/admin/user/pending, quản lý tài khoản inline.</span>
            </li>
            <li style={{ display: 'flex', gap: '10px', fontSize: '13px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <span style={{ minWidth: '20px', color: '#f97316', fontWeight: 700 }}>✦</span>
              <span><b style={{ color: 'var(--c-text-1)' }}>Custom Date Range:</b> Bộ lọc tùy chọn khoảng ngày, tự động tính target theo tỷ lệ ngày chọn / tổng ngày tháng.</span>
            </li>
            <li style={{ display: 'flex', gap: '10px', fontSize: '13px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <span style={{ minWidth: '20px', color: '#a855f7', fontWeight: 700 }}>✦</span>
              <span><b style={{ color: 'var(--c-text-1)' }}>Telegram Bot Composer:</b> Soạn thảo & gửi alert trực tiếp từ dashboard, auto-format nội dung báo cáo.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};

const fmtCompact = (v) => {
  if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(0) + 'M';
  if (Math.abs(v) >= 1e3) return (v/1e3).toFixed(0) + 'K';
  return String(Math.round(v));
};

const BAPanel = ({ data, onOpenBA, search = '', onSearch = () => {}, compact = false, full = false }: any) => {
  const sorted = [...data].sort((a, b) => b.pct - a.pct);
  const rows = compact ? sorted.slice(0, 8) : sorted;

  return (
    <section className="panel anim-rise" style={{ animationDelay: full ? '0ms' : '900ms' }}>
      <div className="panel-head">
        <div>
          <div className="panel-eyebrow mono">STORE PERFORMANCE</div>
          <div className="panel-title">
            {compact ? 'Top & Bottom · ' : 'Master Data · '}
            <span className="mono small">{data.length} stores</span>
          </div>
        </div>
        {full && (
          <div className="panel-head-tools">
            <div className="search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Tìm store, code..." />
            </div>
          </div>
        )}
      </div>

      <div className="ba-table-wrapper">
        <div className="ba-table">
          <div className="ba-head">
            <div>Store · Code</div>
            <div>Channel</div>
            <div>Region</div>
            <div className="r">Actual SO</div>
            <div className="r">Target</div>
            <div>Progress · last 7d</div>
            <div className="c">Status</div>
          </div>
          {rows.map((b, i) => {
            const pct = b.pct;
            const status = pct >= 40 ? 'good' : pct >= 30 ? 'warn' : pct >= 20 ? 'mid' : 'bad';
            const statusText = pct >= 40 ? 'On Track' : pct >= 30 ? 'Lưu ý' : pct >= 20 ? 'Chưa đạt' : 'Báo động';
            return (
              <div key={b.id + i} data-store-id={b.uid} className={`ba-row ${status} anim-slide-in`} style={{ animationDelay: `${i * 35}ms` }} onClick={() => onOpenBA(b)}>
                <div>
                  <div className="ba-name">{b.name}</div>
                  <div className="ba-id mono">{b.id || '—'}</div>
                </div>
                <div>
                  <span className={`ch-tag ch-${b.channel.toLowerCase()}`}>{b.channel}</span>
                </div>
                <div><span className="region-tag">{b.region}</span></div>
                <div className="r mono ba-rev">{fmtCompact(b.rev)}</div>
                <div className="r mono ba-tgt">{fmtCompact(b.target)}</div>
                <div className="ba-progress-cell">
                  <div className="ba-progress">
                    <div className={`ba-progress-fill ${status} ba-progress-anim`} style={{ '--target-w': `${Math.min(pct, 100)}%`, animationDelay: `${i * 35 + 200}ms` }} />
                  </div>
                  <div className="ba-row-sparkline">
                    <Sparkline data={b.last7} color={`var(--c-${status === 'good' ? 'good' : status === 'warn' ? 'warn' : status === 'mid' ? 'text-2' : 'bad'})`} width={56} height={18} fill={false} />
                  </div>
                  <span className={`mono ba-pct ${status}`}><AnimatedNumber value={pct} decimals={1} duration={900} />%</span>
                </div>
                <div className="c"><span className={`status-pill ${status}`}>{statusText}</span></div>
              </div>
            );
          })}
          {rows.length === 0 && <div className="ba-empty">Không có store phù hợp bộ lọc.</div>}
        </div>
      </div>
    </section>
  );
};

const BADrawer = ({ ba, onClose }) => {
  React.useEffect(() => {
    if (!ba) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ba, onClose]);

  if (!ba) return null;
  const pct = ba.pct;
  const status = pct >= 40 ? 'good' : pct >= 30 ? 'warn' : 'bad';
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow mono">{ba.id} · {ba.channel} · {ba.region}</div>
            <div className="drawer-title">{ba.name}</div>
            <div className="drawer-sub">{ba.store}</div>
          </div>
          <button className="tele-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="drawer-kpis">
            <div className="drawer-kpi">
              <div className="drawer-kpi-label mono">ACTUAL SO</div>
              <div className="drawer-kpi-val mono">{fmtVNDfull(ba.rev)}</div>
            </div>
            <div className="drawer-kpi">
              <div className="drawer-kpi-label mono">TARGET</div>
              <div className="drawer-kpi-val mono">{fmtVNDfull(ba.target)}</div>
            </div>
            <div className="drawer-kpi">
              <div className="drawer-kpi-label mono">% TARGET</div>
              <div className={`drawer-kpi-val mono ${status}`}>{pct.toFixed(1)}%</div>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">DAILY REVENUE · 7 NGÀY GẦN NHẤT (TRIỆU)</div>
            <Sparkline data={ba.last7} color="var(--c-accent)" width={560} height={80} />
            <div className="drawer-spark-labels">
              {['D-6','D-5','D-4','D-3','D-2','D-1','Today'].map((d, i) => (
                <div key={d}><span className="mono small">{d}</span><div className="mono">{ba.last7[i]}M</div></div>
              ))}
            </div>
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
};

const DetailedTables = ({ activeTab, selectedChannels, selectedRegions }) => {

  const D = (window as any).INTERDIST_DATA || {};
  const tables_data = D.tables_data || {};
  const weekly_data = tables_data.weekly_data || [];
  const shifts_data = tables_data.shifts_data || [];
  const unique_weeks = tables_data.unique_weeks || [];
  const meta = D?.crv?.meta || D?.stmb?.meta || { updated_to: '2026-05-13', start_day: '2026-05-01', end_day: '2026-05-31' };
  const elapsedDays = meta.updated_to ? new Date(meta.updated_to).getDate() : 13;
  const totalDays = meta.end_day ? new Date(meta.end_day).getDate() : 31;
  const timegonePct = (elapsedDays / totalDays) * 100;

  // Filter weekly data dynamically
  const filteredWeekly = useMemo(() => {
    if (activeTab === 'shifts') return [];
    return weekly_data.filter(item => {
      const isChannelMatch = selectedChannels.includes(item.Project.toLowerCase());
      const isRegionMatch = selectedRegions.includes(item["Mã vùng"]);
      return isChannelMatch && isRegionMatch;
    });
  }, [weekly_data, selectedChannels, selectedRegions, activeTab]);

  // Helper for Category Name
  const catLabel = (cat) => {
    const m = {
      'HAIRCARE': 'Hair Care', 'SHAVECARE': 'Shave Care', 'SKINCARE': 'Skin Care', 'LAUNDRY': 'Laundry', 'BVS': 'BVS', 'SAFEGUARD': 'Safeguard'
    };
    const k = String(cat).toUpperCase().replace(/\s+/g, '');
    return m[k] || cat;
  };

  // Helper to format currency
  const formatMoney = (v) => {
    if (v === 0) return '—';
    return (v / 1e6).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Tr';
  };

  // Helper to format shifts
  const formatShifts = (v) => {
    return Math.round(v).toLocaleString('vi-VN');
  };

  // 1. Category SO by Week
  const categoryWeeklyTable = useMemo(() => {
    if (activeTab !== 'weekly') return [];
    const cats = [...new Set(filteredWeekly.map(x => x.Category))].sort();
    const rows = cats.map(cat => {
      const row: any = { category: catLabel(cat) };
      let total = 0;
      unique_weeks.forEach(w => {
        const val = filteredWeekly
          .filter(x => x.Category === cat && x.Week_Label === w)
          .reduce((sum, x) => sum + x.AMT, 0);
        row[w] = val;
        total += val;
      });
      row.TOTAL = total;
      return row;
    });

    const totalRow: any = { category: 'TOTAL' };
    let grandTotal = 0;
    unique_weeks.forEach(w => {
      const val = filteredWeekly.filter(x => x.Week_Label === w).reduce((sum, x) => sum + x.AMT, 0);
      totalRow[w] = val;
      grandTotal += val;
    });
    totalRow.TOTAL = grandTotal;
    rows.push(totalRow);

    return rows;
  }, [filteredWeekly, unique_weeks, activeTab]);

  // 2. Supervisor SO by Week
  const supervisorWeeklyTable = useMemo(() => {
    if (activeTab !== 'weekly') return [];
    const SUPERVISOR_MAPPING = [
      { name: 'CHIEN', channel: 'crv', region: 'HN' },
      { name: 'CHIEN', channel: 'crv', region: 'NORTH' },
      { name: 'CHIEN', channel: 'stmb', region: 'NORTH' },
      { name: 'CHIEN', channel: 'stmb', region: 'HN' },
      { name: 'TUNG', channel: 'crv', region: 'EAST' },
      { name: 'TUNG', channel: 'crv', region: 'CENTRAL' },
      { name: 'TUNG', channel: 'crv', region: 'HCM' },
      { name: 'HOA', channel: 'crv', region: 'HCM' },
      { name: 'HOA', channel: 'crv', region: 'CENTRAL' },
      { name: 'HOA', channel: 'crv', region: 'EAST' },
      { name: 'HOA', channel: 'crv', region: 'MEKONG' },
      { name: 'KIET', channel: 'crv', region: 'NORTH' },
      { name: 'KIET', channel: 'crv', region: 'HCM' }
    ];

    const visibleSups = Array.from(new Set(SUPERVISOR_MAPPING.filter(sup => {
      return selectedChannels.includes(sup.channel) && selectedRegions.includes(sup.region);
    }).map(s => s.name)));

    const rows = visibleSups.map(sup => {
      const row: any = { supervisor: sup };
      let total = 0;
      unique_weeks.forEach(w => {
        const val = filteredWeekly
          .filter(x => x.Supervisor === sup && x.Week_Label === w)
          .reduce((sum, x) => sum + x.AMT, 0);
        row[w] = val;
        total += val;
      });
      row.TOTAL = total;
      return row;
    });

    const totalRow: any = { supervisor: 'TOTAL' };
    let grandTotal = 0;
    unique_weeks.forEach(w => {
      const val = filteredWeekly
        .filter(x => visibleSups.includes(x.Supervisor))
        .filter(x => x.Week_Label === w)
        .reduce((sum, x) => sum + x.AMT, 0);
      totalRow[w] = val;
      grandTotal += val;
    });
    totalRow.TOTAL = grandTotal;
    rows.push(totalRow);

    return rows;
  }, [filteredWeekly, unique_weeks, selectedChannels, selectedRegions, activeTab]);

  // 3. Category Targets map
  const categoryTargets = useMemo(() => {
    if (activeTab !== 'fullMonth' && activeTab !== 'mtd' && activeTab !== 'custom') return {};
    const targets: Record<string, number> = {};
    if (selectedChannels.includes('stmb') && D.stmb && D.stmb.cats) {
      D.stmb.cats.forEach(c => {
        const key = c.cat.toUpperCase().trim();
        targets[key] = (targets[key] || 0) + (c.target_full || c.target || 0);
      });
    }
    if (selectedChannels.includes('crv') && D.crv && D.crv.cats) {
      D.crv.cats.forEach(c => {
        const key = c.cat.toUpperCase().trim();
        targets[key] = (targets[key] || 0) + (c.target_full || c.target || 0);
      });
    }
    return targets;
  }, [selectedChannels, D, activeTab]);

  // 4. Category Monthly Table
  const categoryMonthlyTable = useMemo(() => {
    if (activeTab !== 'fullMonth' && activeTab !== 'mtd' && activeTab !== 'custom') return [];
    const cats = [...new Set(filteredWeekly.map((x: any) => x.Category))].sort();
    const rows = cats.map(cat => {
      const target = (categoryTargets as Record<string, number>)[(cat as string).toUpperCase().trim()] || 0;
      const actual = filteredWeekly.filter((x: any) => x.Category === cat).reduce((sum, x: any) => sum + x.AMT, 0);
      const pct = target > 0 ? (actual / target) * 100 : 0;
      const gap = pct - timegonePct;
      return { category: catLabel(cat), target, actual, pct, gap };
    });

    const totalTarget = Object.keys(categoryTargets).reduce((sum, k) => {
      const normK = k.replace(/\s+/g, '');
      const hasCat = cats.some(c => (c as string).toUpperCase().replace(/\s+/g, '') === normK);
      if (hasCat) return sum + (categoryTargets as Record<string, number>)[k];
      return sum;
    }, 0);
    const totalActual = filteredWeekly.reduce((sum, x: any) => sum + x.AMT, 0);
    const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    const totalGap = totalPct - timegonePct;

    rows.push({ category: 'TOTAL', target: totalTarget, actual: totalActual, pct: totalPct, gap: totalGap });
    return rows;
  }, [filteredWeekly, categoryTargets, timegonePct, activeTab]);

  // 5. Category MTD Table
  const categoryMtdTable = useMemo(() => {
    if (activeTab !== 'mtd' && activeTab !== 'custom') return [];
    return categoryMonthlyTable.map(row => {
      const targetMtd = row.target * elapsedDays / totalDays;
      const pctMtd = targetMtd > 0 ? (row.actual / targetMtd) * 100 : 0;
      return { category: row.category, target: targetMtd, actual: row.actual, pct: pctMtd };
    });
  }, [categoryMonthlyTable, elapsedDays, totalDays, activeTab]);

  // 6. Region Targets map
  const regionTargets = useMemo(() => {
    if (activeTab !== 'fullMonth' && activeTab !== 'mtd' && activeTab !== 'custom') return {};
    const targets: Record<string, number> = {};
    selectedRegions.forEach(reg => {
      let t = 0;
      if (selectedChannels.includes('crv') && D.crv && D.crv.regions && D.crv.regions[reg]) {
        t += D.crv.regions[reg].target_full || D.crv.regions[reg].target || 0;
      }
      if (selectedChannels.includes('stmb') && reg === 'NORTH' && D.stmb && D.stmb.total) {
        t += D.stmb.total.target_full || D.stmb.total.target || 0;
      }
      targets[reg] = t;
    });
    return targets;
  }, [selectedChannels, selectedRegions, D, activeTab]);

  // 7. Region Monthly Table
  const regionMonthlyTable = useMemo(() => {
    if (activeTab !== 'fullMonth' && activeTab !== 'mtd' && activeTab !== 'custom') return [];
    const rows = selectedRegions.map(reg => {
      const target = (regionTargets as Record<string, number>)[reg] || 0;
      const actual = filteredWeekly.filter((x: any) => x["Mã vùng"] === reg).reduce((sum, x: any) => sum + x.AMT, 0);
      const pct = target > 0 ? (actual / target) * 100 : 0;
      const gap = pct - timegonePct;
      return { region: reg, target, actual, pct, gap };
    });

    const totalTarget = Object.values(regionTargets).reduce((sum, v: any) => sum + v, 0) as number;
    const totalActual = filteredWeekly.reduce((sum, x: any) => sum + x.AMT, 0);
    const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    const totalGap = totalPct - timegonePct;

    rows.push({ region: 'TOTAL', target: totalTarget, actual: totalActual, pct: totalPct, gap: totalGap });
    return rows;
  }, [filteredWeekly, selectedRegions, regionTargets, timegonePct, activeTab]);

  // 8. Region MTD Table
  const regionMtdTable = useMemo(() => {
    if (activeTab !== 'mtd' && activeTab !== 'custom') return [];
    return regionMonthlyTable.map(row => {
      const targetMtd = row.target * elapsedDays / totalDays;
      const pctMtd = targetMtd > 0 ? (row.actual / targetMtd) * 100 : 0;
      return { region: row.region, target: targetMtd, actual: row.actual, pct: pctMtd };
    });
  }, [regionMonthlyTable, elapsedDays, totalDays, activeTab]);

  // 9. Supervisor Targets map
  const supervisorTargets = useMemo(() => {
    if (activeTab !== 'shifts' && activeTab !== 'mtd' && activeTab !== 'custom') return {};
    const targets: Record<string, number> = {};
    const sups = ['CHIEN', 'TUNG', 'HOA', 'KIET'];
    
    sups.forEach(supName => {
      let tFull = 0;
      ['stmb', 'crv'].forEach(proj => {
        if (D[proj] && D[proj].stores) {
          D[proj].stores.forEach((store: any) => {
            const storeCode = store.code;
            const mapInfo = STORE_MAPPING[storeCode];
            const sSup = mapInfo ? mapInfo.sup : "UNKNOWN";
            if (sSup === supName) {
              const insideTgt = store.target_full || store.target || 0;
              tFull += insideTgt;
            }
          });
        }
      });
      targets[supName] = tFull;
    });
    return targets;
  }, [D, activeTab]);

  // 10. Supervisor MTD Table
  const supervisorMtdTable = useMemo(() => {
    if (activeTab !== 'mtd' && activeTab !== 'custom') return [];
    const sups = Object.keys(supervisorTargets);
    const rows = sups.map(sup => {
      const targetFull = (supervisorTargets as Record<string, number>)[sup] || 0;
      const targetMtd = targetFull * elapsedDays / totalDays;
      const actual = filteredWeekly.filter((x: any) => x.Supervisor === sup).reduce((sum, x: any) => sum + x.AMT, 0);
      const pct = targetMtd > 0 ? (actual / targetMtd) * 100 : 0;
      return { supervisor: sup, target: targetMtd, actual, pct };
    });

    const totalTarget = Object.values(supervisorTargets).reduce((sum, v: any) => sum + v, 0) as number * elapsedDays / totalDays;
    const totalActual = filteredWeekly.filter((x: any) => sups.includes(x.Supervisor)).reduce((sum, x: any) => sum + x.AMT, 0);
    const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

    rows.push({ supervisor: 'TOTAL', target: totalTarget, actual: totalActual, pct: totalPct });
    return rows;
  }, [filteredWeekly, supervisorTargets, elapsedDays, totalDays, activeTab]);

  // 11. Shifts Actual by Region/Supervisor
  const actualShiftsRegion = useMemo(() => {
    if (activeTab !== 'shifts') return {};
    const counts: Record<string, number> = {};
    (shifts_data || []).forEach((item: any) => {
      const isChannelMatch = selectedChannels.includes(item.Project.toLowerCase());
      const isRegionMatch = selectedRegions.includes(item["Mã vùng"]);
      if (isChannelMatch && isRegionMatch) {
        counts[item["Mã vùng"]] = (counts[item["Mã vùng"]] || 0) + item.actual_shifts;
      }
    });
    return counts;
  }, [shifts_data, selectedChannels, selectedRegions, activeTab]);

  const actualShiftsSup = useMemo(() => {
    if (activeTab !== 'shifts') return {};
    const counts: Record<string, number> = {};
    (shifts_data || []).forEach((item: any) => {
      const isChannelMatch = selectedChannels.includes(item.Project.toLowerCase());
      const isRegionMatch = selectedRegions.includes(item["Mã vùng"]);
      if (isChannelMatch && isRegionMatch) {
        counts[item.Supervisor] = (counts[item.Supervisor] || 0) + item.actual_shifts;
      }
    });
    return counts;
  }, [shifts_data, selectedChannels, selectedRegions, activeTab]);

  // 12. Dynamic region shift targets mapping from Excel configurations (File 1 & File 2)
  const regionShiftTargets = useMemo(() => {
    if (activeTab !== 'shifts') return {};
    const targets: Record<string, number> = {};
    const regions = ['HN', 'EAST', 'NORTH', 'CENTRAL', 'HCM', 'MEKONG'];

    regions.forEach(reg => {
      let regTgtShifts = 0;
      Object.entries(STORE_MAPPING).forEach(([code, info]) => {
        if (info.region === reg) {
          const conf = STORE_SHIFT_CONFIGS[info.storeName];
          const wDays = conf ? conf.workDaysPerWeek : 3;
          regTgtShifts += (wDays / 6) * 26 * elapsedDays / totalDays;
        }
      });
      targets[reg] = regTgtShifts;
    });
    return targets;
  }, [elapsedDays, totalDays, activeTab]);

  // 13. Shifts by Region Table
  const shiftsRegionTable = useMemo(() => {
    if (activeTab !== 'shifts') return [];
    const rows = selectedRegions.map(reg => {
      const target = regionShiftTargets[reg] || 0;
      const actual = (actualShiftsRegion as Record<string, number>)[reg] || 0;
      const pct = target > 0 ? (actual / target) * 100 : 0;
      return { region: reg, target, actual, pct };
    });

    const totalTarget = selectedRegions.reduce((sum, r) => sum + (regionShiftTargets[r] || 0), 0);
    const totalActual = Object.values(actualShiftsRegion).reduce((sum, v: any) => sum + v, 0) as number;
    const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

    rows.push({ region: 'TOTAL', target: totalTarget, actual: totalActual, pct: totalPct });
    return rows;
  }, [selectedRegions, regionShiftTargets, actualShiftsRegion, activeTab]);

  // 14. Dynamic supervisor shift targets mapping
  const supervisorShiftTargets = useMemo(() => {
    if (activeTab !== 'shifts') return {};
    const targets: Record<string, number> = {};
    const sups = ['CHIEN', 'TUNG', 'HOA', 'KIET'];

    sups.forEach(sup => {
      let supTgtShifts = 0;
      Object.entries(STORE_MAPPING).forEach(([code, info]) => {
        if (info.sup === sup) {
          const conf = STORE_SHIFT_CONFIGS[info.storeName];
          const wDays = conf ? conf.workDaysPerWeek : 3;
          supTgtShifts += (wDays / 6) * 26 * elapsedDays / totalDays;
        }
      });
      targets[sup] = supTgtShifts;
    });
    return targets;
  }, [elapsedDays, totalDays, activeTab]);

  // 15. Shifts by Supervisor Table
  const shiftsSupervisorTable = useMemo(() => {
    if (activeTab !== 'shifts') return [];
    const sups = Object.keys(supervisorTargets);
    const rows = sups.map(sup => {
      const target = supervisorShiftTargets[sup] || 0;
      const actual = (actualShiftsSup as Record<string, number>)[sup] || 0;
      const pct = target > 0 ? (actual / target) * 100 : 0;
      return { supervisor: sup, target, actual, pct };
    });

    const totalTarget = sups.reduce((sum, s) => sum + (supervisorShiftTargets[s] || 0), 0);
    const sumActualShifts = sups.reduce((sum, s) => sum + ((actualShiftsSup as Record<string, number>)[s] || 0), 0);
    const totalPct = totalTarget > 0 ? (sumActualShifts / totalTarget) * 100 : 0;

    rows.push({ supervisor: 'TOTAL', target: totalTarget, actual: sumActualShifts, pct: totalPct });
    return rows;
  }, [supervisorTargets, supervisorShiftTargets, actualShiftsSup, activeTab]);

  const renderPct = (pct) => {
    const status = pct >= 100 ? 'good' : pct >= 85 ? 'warn' : 'bad';
    return <span className={`pct-col ${status}`}>{pct.toFixed(1)}%</span>;
  };

  const renderGap = (gap) => {
    const status = gap >= 0 ? 'good' : 'bad';
    const sign = gap >= 0 ? '+' : '';
    return <span className={`pct-col ${status}`}>{sign}{gap.toFixed(1)}%</span>;
  };

  return (
    <section className="detailed-tables-panel anim-rise" style={{ animationDelay: '50ms' }}>
      <div className="tables-container">
        {activeTab === 'weekly' && (
          <>
            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Doanh số theo Ngành hàng theo tuần (Triệu VNĐ)</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Ngành hàng</th>
                    {unique_weeks.map(w => <th key={w} className="r">{w}</th>)}
                    <th className="r">Tổng cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryWeeklyTable.map((row, idx) => (
                    <tr key={row.category} className={row.category === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.category}</td>
                      {unique_weeks.map(w => <td key={w} className="r">{formatMoney(row[w])}</td>)}
                      <td className="r">{formatMoney(row.TOTAL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Doanh số theo Supervisor theo tuần (Triệu VNĐ)</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Supervisor</th>
                    {unique_weeks.map(w => <th key={w} className="r">{w}</th>)}
                    <th className="r">Tổng cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisorWeeklyTable.map((row, idx) => (
                    <tr key={row.supervisor} className={row.supervisor === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.supervisor}</td>
                      {unique_weeks.map(w => <td key={w} className="r">{formatMoney(row[w])}</td>)}
                      <td className="r">{formatMoney(row.TOTAL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'fullMonth' && (
          <>
            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Báo cáo Ngành hàng cả tháng</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Ngành hàng</th>
                    <th className="r">Target Full Month</th>
                    <th className="r">Actual MTD</th>
                    <th className="r">% Hoàn thành</th>
                    <th className="r">Gap vs Timegone</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryMonthlyTable.map((row, idx) => (
                    <tr key={row.category} className={row.category === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.category}</td>
                      <td className="r">{formatMoney(row.target)}</td>
                      <td className="r">{formatMoney(row.actual)}</td>
                      <td className="r">{renderPct(row.pct)}</td>
                      <td className="r">{renderGap(row.gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Báo cáo Vùng cả tháng</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Vùng</th>
                    <th className="r">Target Full Month</th>
                    <th className="r">Actual MTD</th>
                    <th className="r">% Hoàn thành</th>
                    <th className="r">Gap vs Timegone</th>
                  </tr>
                </thead>
                <tbody>
                  {regionMonthlyTable.map((row, idx) => (
                    <tr key={row.region} className={row.region === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.region}</td>
                      <td className="r">{formatMoney(row.target)}</td>
                      <td className="r">{formatMoney(row.actual)}</td>
                      <td className="r">{renderPct(row.pct)}</td>
                      <td className="r">{renderGap(row.gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(activeTab === 'mtd' || activeTab === 'custom') && (
          <>
            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Báo cáo Ngành hàng luỹ kế MTD</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Ngành hàng</th>
                    <th className="r">Target MTD</th>
                    <th className="r">Actual MTD</th>
                    <th className="r">% Hoàn thành MTD</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryMtdTable.map((row, idx) => (
                    <tr key={row.category} className={row.category === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.category}</td>
                      <td className="r">{formatMoney(row.target)}</td>
                      <td className="r">{formatMoney(row.actual)}</td>
                      <td className="r">{renderPct(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Báo cáo Vùng luỹ kế MTD</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Vùng</th>
                    <th className="r">Target MTD</th>
                    <th className="r">Actual MTD</th>
                    <th className="r">% Hoàn thành MTD</th>
                  </tr>
                </thead>
                <tbody>
                  {regionMtdTable.map((row, idx) => (
                    <tr key={row.region} className={row.region === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.region}</td>
                      <td className="r">{formatMoney(row.target)}</td>
                      <td className="r">{formatMoney(row.actual)}</td>
                      <td className="r">{renderPct(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Báo cáo Supervisor luỹ kế MTD</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Supervisor</th>
                    <th className="r">Target MTD</th>
                    <th className="r">Actual MTD</th>
                    <th className="r">% Hoàn thành MTD</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisorMtdTable.map((row, idx) => (
                    <tr key={row.supervisor} className={row.supervisor === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.supervisor}</td>
                      <td className="r">{formatMoney(row.target)}</td>
                      <td className="r">{formatMoney(row.actual)}</td>
                      <td className="r">{renderPct(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'shifts' && (
          <>
            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Số ca làm theo Vùng luỹ kế MTD</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Vùng</th>
                    <th className="r">Target Shifts MTD</th>
                    <th className="r">Actual Shifts MTD</th>
                    <th className="r">% Hoàn thành ca làm</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsRegionTable.map((row, idx) => (
                    <tr key={row.region} className={row.region === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.region}</td>
                      <td className="r">{formatShifts(row.target)}</td>
                      <td className="r">{formatShifts(row.actual)}</td>
                      <td className="r">{renderPct(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detailed-table-wrapper">
              <div className="table-subtitle">Số ca làm theo Supervisor luỹ kế MTD</div>
              <table className="detailed-table">
                <thead>
                  <tr>
                    <th>Supervisor</th>
                    <th className="r">Target Shifts MTD</th>
                    <th className="r">Actual Shifts MTD</th>
                    <th className="r">% Hoàn thành ca làm</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsSupervisorTable.map((row, idx) => (
                    <tr key={row.supervisor} className={row.supervisor === 'TOTAL' ? 'total-row' : ''}>
                      <td>{row.supervisor}</td>
                      <td className="r">{formatShifts(row.target)}</td>
                      <td className="r">{formatShifts(row.actual)}</td>
                      <td className="r">{renderPct(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const DashboardDebugConsole = ({ open, onClose, onOpen, excelOpen, setExcelOpen }) => {
  const [logs, setLogs] = React.useState((window as any).__DASHBOARD_LOGS || []);
  const [copied, setCopied] = React.useState(false);
  const terminalEndRef = React.useRef(null);

  // Poll for logs
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLogs([...((window as any).__DASHBOARD_LOGS || [])]);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (open && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, open]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleCopy = () => {
    const text = ((window as any).__DASHBOARD_LOGS || []).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAutoFix = () => {
    if ((window as any).addDashboardLog) {
      (window as any).addDashboardLog("⚙️ Chạy quy trình tự sửa lỗi (Auto-Fix)...");
    }
    try {
      if (!(window as any).ExportExcelDialog) {
        (window as any).addDashboardLog("⚠️ Cảnh báo: ExportExcelDialog bị thiếu toàn cục.");
      } else {
        (window as any).addDashboardLog("ℹ️ ExportExcelDialog đã được gán toàn cục dưới dạng: " + typeof (window as any).ExportExcelDialog);
      }
      (window as any).addDashboardLog("✅ Đã kiểm tra tính khả dụng của các thư viện.");
    } catch (e) {
      if ((window as any).addDashboardLog) {
        (window as any).addDashboardLog("❌ Lỗi quy trình Auto-Fix: " + e.message);
      }
    }
  };

  const handleManualTrigger = () => {
    if ((window as any).addDashboardLog) {
      (window as any).addDashboardLog("🔌 Kích hoạt mở hộp thoại excel thủ công qua debug console...");
    }
    setExcelOpen(true);
  };

  const excelType = typeof (window as any).ExportExcelDialog;
  const dataLoaded = !!(window as any).INTERDIST_DATA;
  const xlsxLoaded = typeof (window as any).XLSX !== 'undefined';

  return (
    <>
      {/* Floating Launch Button */}
      <button 
        onClick={onOpen}
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1)',
          color: '#3B82F6',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999998,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'rotate(45deg) scale(1.1)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'; }}
        title="Bảng điều khiển chẩn đoán lỗi"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      {/* Slide-out Terminal Panel */}
      {open && (
        <div 
          className="anim-rise"
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '86px',
            width: '440px',
            height: '620px',
            maxHeight: 'calc(100vh - 120px)',
            borderRadius: '20px',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Panel Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }}></span>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }}></span>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }}></span>
              <h4 style={{ margin: '0 0 0 8px', fontSize: '13.5px', fontWeight: '700', color: '#F1F5F9', letterSpacing: '0.5px' }}>DASHBOARD SYSTEM DIAGNOSTICS</h4>
            </div>
            <button 
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
              onMouseEnter={e => e.currentTarget.style.color = '#F1F5F9'}
              onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
            >✕</button>
          </div>

          {/* Quick Metrics Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '16px 20px', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' }}>Excel Exporter UMD</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: excelType === 'function' ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: excelType === 'function' ? '#10B981' : '#EF4444' }}></span>
                {excelType.toUpperCase()}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' }}>Raw Data Store</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: dataLoaded ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: dataLoaded ? '#10B981' : '#EF4444' }}></span>
                {dataLoaded ? "LOADED" : "MISSING"}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' }}>SheetJS ((window as any).XLSX)</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: xlsxLoaded ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: xlsxLoaded ? '#10B981' : '#EF4444' }}></span>
                {xlsxLoaded ? "READY" : "NOT LOADED"}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' }}>excelOpen state</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: excelOpen ? '#3B82F6' : '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: excelOpen ? '#3B82F6' : '#94A3B8' }}></span>
                {excelOpen ? "TRUE" : "FALSE"}
              </div>
            </div>
          </div>

          {/* Action Tools Console */}
          <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              onClick={handleManualTrigger}
              style={{ flex: 1.2, height: '32px', border: 'none', background: '#3B82F6', color: '#ffffff', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              ⚡ Mở Excel Dialog
            </button>
            <button 
              onClick={handleAutoFix}
              style={{ flex: 1, height: '32px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
              🛠️ Tự động Sửa
            </button>
            <button 
              onClick={handleCopy}
              style={{ flex: 1, height: '32px', border: 'none', background: copied ? '#10B981' : 'rgba(255,255,255,0.1)', color: '#ffffff', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
              {copied ? "✔️ Đã sao chép!" : "📋 Copy Nhật ký"}
            </button>
          </div>

          {/* Logs Terminal Stream */}
          <div 
            style={{
              flex: 1,
              padding: '16px 20px',
              overflowY: 'auto',
              background: '#090d16',
              fontFamily: 'monospace, "Fira Code", Courier',
              fontSize: '11.5px',
              lineHeight: '1.5',
              color: '#38BDF8',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: '#64748B', fontStyle: 'italic' }}>Chưa có sự kiện nào được ghi nhận.</div>
            ) : (
              logs.map((log, index) => {
                let color = '#38BDF8';
                if (log.includes('❌') || log.includes('error') || log.includes('LỖI')) color = '#F87171';
                else if (log.includes('⚠️') || log.includes('warning') || log.includes('Cảnh báo')) color = '#FBBF24';
                else if (log.includes('✅') || log.includes('thành công') || log.includes('success')) color = '#34D399';
                else if (log.includes('ℹ️') || log.includes('mounted')) color = '#A78BFA';
                return (
                  <div key={index} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {log}
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}
    </>
  );
};


export default App;
