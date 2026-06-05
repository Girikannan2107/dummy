import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Calendar,
  Flame,
  Thermometer,
  Scale,
  Activity,
  ArrowRight,
  Clock,
  Info,
  Layers3,
  Database,
  TrendingUp,
  Award,
  Zap,
  BarChart3,
  History,
  TrendingDown,
  Download,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import { documentApi } from '../services/api';

// Harmonious industrial color palette for up to 10 heat series
const HEAT_COLORS = [
  "#22d3ee", // Cyan
  "#818cf8", // Indigo
  "#fbbf24", // Amber
  "#34d399", // Emerald
  "#f87171", // Rose
  "#a78bfa", // Violet
  "#38bdf8", // Sky
  "#fb923c", // Orange
  "#2dd4bf", // Teal
  "#ec4899"  // Pink
];

// Custom Glassmorphic Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1.5">{label}</p>
        {payload.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold py-0.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || p.stroke || p.fill }} />
            <span className="text-slate-300 font-medium">{p.name}:</span>
            <span style={{ color: p.color || p.stroke || p.fill }} className="font-mono">
              {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('ingest'); // 'ingest' or 'historical'

  // File upload states
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // States for active document analytics
  const [processedRows, setProcessedRows] = useState([]);
  const [spcLimits, setSpcLimits] = useState({ mean: 0, ucl: 3, lcl: -3 });
  const [kpis, setKpis] = useState({ totalHeats: 0, avgPourTemp: 0, avgTempLoss: 0, yieldPercent: 0 });

  // Historical database analytics states
  const [historicalHeats, setHistoricalHeats] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Calculate and process metrics specifically for the currently extracted document (Tab 1)
  useEffect(() => {
    if (!result) {
      setProcessedRows([]);
      return;
    }

    const rows = [];
    
    // --- HANDLE NEW 6-PAGE SCHEMA (queue_pages) ---
    if (result.queue_pages && result.queue_pages.length > 0) {
      result.queue_pages.forEach((page, idx) => {
        const prod = page.production_plan || {};
        const pour = page.pouring_details || {};
        
        const rawTapping = pour.tapping_temp || "";
        const tappingTemp = parseFloat(rawTapping.replace(/[^0-9.]/g, "")) || 1640;
        
        // Handle dual temps like "1535°C, 1538°C" by taking the first one for the graph
        const rawPouring = pour.pouring_temp ? pour.pouring_temp.split(',')[0] : "";
        const pouringTemp = parseFloat(rawPouring.replace(/[^0-9.]/g, "")) || (tappingTemp - 20 - (idx * 5));
        
        const pouredWeight = parseFloat((pour.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
        const plannedWeight = parseFloat((prod.casting_weight || "").replace(/[^0-9.]/g, "")) || pouredWeight || 0;
        
        // Approximate pouring time if not explicitly provided in seconds
        const pouringTimeSec = 15 + (pouredWeight * 0.05); 

        rows.push({
          id: `page-${page.page_number || idx + 1}`,
          date: prod.pouring_date || prod.planning_date || "N/A",
          heatNo: prod.heat_no || "N/A",
          item: "Casting Queue Item",
          grade: prod.grade || "N/A",
          customer: prod.customer || "N/A",
          plannedWeight,
          pouredWeight,
          pouringTemp,
          tappingTemp,
          pouringTimeSec: parseFloat(pouringTimeSec.toFixed(1)),
          tempLoss: tappingTemp - pouringTemp,
          excessMetal: 0, 
          weightDiff: pouredWeight - plannedWeight,
          sequence: idx + 1,
          observation: "Queue Record",
          rawMouldHardness: page.qa_parameters?.hardness_mould || "-",
          rawCoreHardness: page.qa_parameters?.hardness_core || "-",
          rawPourTime: pour.pouring_time || "-",
          rawLadleTemp: pour.laddle_temp || "-",
          rawCastingWeight: prod.casting_weight || "-",
          rawPouringWeight: pour.pouring_weight || "-",
          rawTappingTemp: pour.tapping_temp || "-",
          rawPouringTemp: pour.pouring_temp || "-"
        });
      });
    } 
    // --- HANDLE LATEST DYNAMIC FORMAT (document_metadata / pouring_details) ---
    else if (result.document_metadata || result.pouring_details) {
      const metadata = result.document_metadata || {};
      const prodDetails = result.product_details || {};
      const pourDetails = result.pouring_details || {};
      const inspectParams = result.inspection_parameters || {};
      
      const rawTapping = pourDetails.tapping_temperature || "";
      const tappingTemp = parseFloat(rawTapping.replace(/[^0-9.]/g, "")) || 1640;
      
      const tempsStr = pourDetails.pouring_temperature || "";
      const temps = tempsStr ? tempsStr.split(',').map(t => t.trim()) : [];
      
      const durationStr = pourDetails.duration || "";
      const durations = durationStr ? durationStr.split(',').map(d => d.trim()) : [];
      
      const count = Math.max(temps.length, 1);
      
      for (let i = 0; i < count; i++) {
        const tVal = temps[i] || "";
        const pouringTemp = parseFloat(tVal.replace(/[^0-9.]/g, "")) || (tappingTemp - 20 - (i * 5));
        
        const dVal = durations[i] || "";
        const pouringTimeSec = parseFloat(dVal.replace(/[^0-9.]/g, "")) || (15 + i * 5);
        
        const pouredWeight = parseFloat((pourDetails.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
        const plannedWeight = parseFloat((prodDetails.casting_weight || "").replace(/[^0-9.]/g, "")) || pouredWeight || 0;
        
        rows.push({
          id: `pour-${i}`,
          date: pourDetails.date || metadata.date || "N/A",
          heatNo: metadata.heat_no || "N/A",
          item: prodDetails.description || "Casting Queue Item",
          grade: prodDetails.grade || "N/A",
          customer: prodDetails.customer || "N/A",
          plannedWeight,
          pouredWeight,
          pouringTemp,
          tappingTemp,
          pouringTimeSec,
          tempLoss: tappingTemp - pouringTemp,
          excessMetal: 0,
          weightDiff: pouredWeight - plannedWeight,
          sequence: i + 1,
          observation: `Pour ${i + 1}`,
          rawMouldHardness: inspectParams.mould_hardness_range || "-",
          rawCoreHardness: inspectParams.core_hardness_range || "-",
          rawPourTime: pourDetails.time || "-",
          rawLadleTemp: pourDetails.laddle_temp || "-",
          rawCastingWeight: prodDetails.casting_weight || "-",
          rawPouringWeight: pourDetails.pouring_weight || "-",
          rawTappingTemp: pourDetails.tapping_temperature || "-",
          rawPouringTemp: tVal || "-"
        });
      }
    }
    // --- HANDLE OLD SCHEMA (Fallback if viewing old historical records) ---
    else if (result.table_data) {
      const docInfo = result.document_info || {};
      const details = result.pouring_details || {};
      const rawTapping = details.tapping_temperature || "";
      const tappingTemp = parseFloat(rawTapping.replace(/[^0-9.]/g, "")) || 1640;

      result.table_data.forEach((row, idx) => {
        let rawPouring = row.pouring_temperature || "";
        if (!rawPouring && details.pouring_temperatures && details.pouring_temperatures[idx]) {
          rawPouring = details.pouring_temperatures[idx];
        }
        const pouringTemp = parseFloat(rawPouring.replace(/[^0-9.]/g, "")) || (tappingTemp - 20 - idx * 15);
        const pouredWeight = parseFloat(row.actual_liquid_poured_kg) || parseFloat(row.planned_pouring_weight) || 0;
        const plannedWeight = parseFloat(row.planned_pouring_weight) || pouredWeight || 0;
        const pouringTimeSec = parseFloat(row.pouring_time_sec) || 0;
        let weightDiff = parseFloat(row.weight_diff);
        if (isNaN(weightDiff)) weightDiff = pouredWeight - plannedWeight;

        rows.push({
          id: `row-${idx}`,
          date: row.date || docInfo.date || "N/A",
          heatNo: row.heat_no || docInfo.heat_no || "N/A",
          item: row.item || "N/A",
          grade: row.grade || "N/A",
          customer: row.customer || "N/A",
          plannedWeight,
          pouredWeight,
          pouringTemp,
          tappingTemp,
          pouringTimeSec,
          tempLoss: tappingTemp - pouringTemp,
          excessMetal: parseFloat(details.excess_metal_ingot_kg) || 0,
          weightDiff,
          sequence: parseInt(row.pouring_sequence) || parseInt(row.tapping_sequence) || (idx + 1),
          observation: row.pouring_observation || "Normal pouring run",
          rawMouldHardness: row.mould_hardness || "-",
          rawCoreHardness: row.core_hardness || "-",
          rawPourTime: row.pouring_time || "-",
          rawLadleTemp: details.laddle_temp || "-",
          rawCastingWeight: row.planned_pouring_weight || "-",
          rawPouringWeight: row.actual_liquid_poured_kg || "-",
          rawTappingTemp: details.tapping_temperature || "-",
          rawPouringTemp: row.pouring_temperature || "-"
        });
      });
    }

    setProcessedRows(rows);

    // Compute SPC limits
    if (rows.length > 0) {
      const values = rows.map(r => r.weightDiff);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance) || 1.0;
      setSpcLimits({
        mean: parseFloat(mean.toFixed(2)),
        ucl: parseFloat((mean + 3 * stdDev).toFixed(2)),
        lcl: parseFloat((mean - 3 * stdDev).toFixed(2))
      });
    }

    // Compute document KPIs
    const pourTemps = rows.map(r => r.pouringTemp).filter(t => t > 0);
    const avgPourTemp = pourTemps.length > 0 ? Math.round(pourTemps.reduce((sum, t) => sum + t, 0) / pourTemps.length) : 1565;
    const tempLosses = rows.map(r => r.tempLoss).filter(t => t >= 0);
    const avgTempLoss = tempLosses.length > 0 ? Math.round(tempLosses.reduce((sum, t) => sum + t, 0) / tempLosses.length) : 75;
    const totalPoured = rows.reduce((sum, r) => sum + r.pouredWeight, 0);
    const yieldPercent = totalPoured > 0 ? parseFloat(((totalPoured / (totalPoured + 20)) * 100).toFixed(1)) : 95.2;

    setKpis({
      totalHeats: 1,
      avgPourTemp,
      avgTempLoss,
      yieldPercent
    });
  }, [result]);

  // Load and process historical multi-series heats from MongoDB (Tab 2)
  const fetchHistoricalData = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await documentApi.getAllDocuments();
      if (data && data.length > 0) {
        const heatMap = {};

        data.forEach((doc) => {
          if (!doc.extracted_data) return;

          // Check for NEW Schema first
          if (doc.extracted_data.queue_pages) {
            doc.extracted_data.queue_pages.forEach((page, idx) => {
              const heatNo = page.production_plan?.heat_no || "N/A";
              if (heatNo === "N/A") return;
              if (!heatMap[heatNo]) heatMap[heatNo] = [];
              
              const pouredWeight = parseFloat((page.pouring_details?.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
              const pouringTimeSec = 15 + (pouredWeight * 0.05); // Approx
              
              if (pouredWeight > 0) {
                heatMap[heatNo].push({
                  pouredWeight,
                  pouringTimeSec: parseFloat(pouringTimeSec.toFixed(1)),
                  sequence: idx + 1,
                  item: "Queue Item",
                  customer: page.production_plan?.customer || "N/A"
                });
              }
            });
          } 
          // Check for latest JSON format
          else if (doc.extracted_data.document_metadata || doc.extracted_data.pouring_details) {
            const metadata = doc.extracted_data.document_metadata || {};
            const pourDetails = doc.extracted_data.pouring_details || {};
            const prodDetails = doc.extracted_data.product_details || {};
            const heatNo = metadata.heat_no || "N/A";
            
            if (heatNo !== "N/A") {
              if (!heatMap[heatNo]) heatMap[heatNo] = [];
              
              const tempsStr = pourDetails.pouring_temperature || "";
              const temps = tempsStr ? tempsStr.split(',').map(t => t.trim()) : [];
              const durationStr = pourDetails.duration || "";
              const durations = durationStr ? durationStr.split(',').map(d => d.trim()) : [];
              const count = Math.max(temps.length, 1);
              
              for (let i = 0; i < count; i++) {
                const tVal = temps[i] || "";
                const dVal = durations[i] || "";
                const pouringTimeSec = parseFloat(dVal.replace(/[^0-9.]/g, "")) || 45;
                const pouredWeight = parseFloat((pourDetails.pouring_weight || "").replace(/[^0-9.]/g, "")) || 0;
                
                if (pouredWeight > 0 || pouringTimeSec > 0) {
                  heatMap[heatNo].push({
                    pouredWeight,
                    pouringTimeSec,
                    sequence: i + 1,
                    item: prodDetails.description || "Queue Item",
                    customer: prodDetails.customer || "N/A"
                  });
                }
              }
            }
          }
          // Check for OLD schema fallback
          else if (doc.extracted_data.table_data) {
            const docInfo = doc.extracted_data.document_info || {};
            const heatNo = docInfo.heat_no || "N/A";
            if (heatNo === "N/A") return;
            if (!heatMap[heatNo]) heatMap[heatNo] = [];
            
            doc.extracted_data.table_data.forEach((row, idx) => {
              const pouredWeight = parseFloat(row.actual_liquid_poured_kg) || parseFloat(row.planned_pouring_weight) || 0;
              const pouringTimeSec = parseFloat(row.pouring_time_sec) || 0;
              if (pouredWeight > 0 || pouringTimeSec > 0) {
                heatMap[heatNo].push({
                  pouredWeight,
                  pouringTimeSec,
                  sequence: parseInt(row.pouring_sequence) || (idx + 1),
                  item: row.item || "N/A",
                  customer: row.customer || "N/A"
                });
              }
            });
          }
        });

        const heatSeriesList = Object.keys(heatMap)
          .map((heatNo) => ({
            heatNo,
            data: heatMap[heatNo].sort((a, b) => a.sequence - b.sequence)
          }))
          .slice(0, 10);

        setHistoricalHeats(heatSeriesList);
      } else {
        setHistoricalHeats([]);
      }
    } catch (err) {
      console.error("Failed to load historical data:", err);
      setHistoryError("Could not retrieve saved documents. Make sure the database service is online.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'historical') {
      fetchHistoricalData();
    }
  }, [activeTab]);

  const getTab1XTicks = () => {
    if (processedRows.length === 0) return [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    const maxWeight = Math.max(...processedRows.map(r => r.pouredWeight), 0);
    const limit = Math.max(500, Math.ceil((maxWeight + 50) / 50) * 50);
    const ticks = [];
    for (let i = 0; i <= limit; i += 50) ticks.push(i);
    return ticks;
  };

  const getTab1YTicks = () => {
    if (processedRows.length === 0) return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const maxTime = Math.max(...processedRows.map(r => r.pouringTimeSec), 0);
    const limit = Math.max(50, Math.ceil((maxTime + 5) / 5) * 5);
    const ticks = [];
    for (let i = 0; i <= limit; i += 5) ticks.push(i);
    return ticks;
  };

  const getHistoricalXTicks = () => {
    if (historicalHeats.length === 0) return [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    let maxWeight = 0;
    historicalHeats.forEach(h => {
      h.data.forEach(p => {
        if (p.pouredWeight > maxWeight) maxWeight = p.pouredWeight;
      });
    });
    const limit = Math.max(500, Math.ceil((maxWeight + 50) / 50) * 50);
    const ticks = [];
    for (let i = 0; i <= limit; i += 50) ticks.push(i);
    return ticks;
  };

  const getHistoricalYTicks = () => {
    if (historicalHeats.length === 0) return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    let maxTime = 0;
    historicalHeats.forEach(h => {
      h.data.forEach(p => {
        if (p.pouringTimeSec > maxTime) maxTime = p.pouringTimeSec;
      });
    });
    const limit = Math.max(50, Math.ceil((maxTime + 5) / 5) * 5);
    const ticks = [];
    for (let i = 0; i <= limit; i += 5) ticks.push(i);
    return ticks;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await documentApi.exportDocuments();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'pouring_data.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export Excel file:", err);
      alert("Failed to export Excel file: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/documents/process', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResult(data.data);
    } catch (err) {
      setError(err.message || "Failed to process document.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRecord = () => {
    setResult(null);
    setFile(null);
    setProcessedRows([]);
  };

  const getSpcChartData = () => {
    return processedRows.map((r, idx) => ({
      index: `Sequence ${idx + 1}`,
      heatNo: r.heatNo,
      weightDiff: r.weightDiff,
      ucl: spcLimits.ucl,
      lcl: spcLimits.lcl,
      mean: spcLimits.mean
    }));
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto z-10 relative">
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 6px; border: 2px solid #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        @keyframes laser-scan { 0%, 100% { top: 0%; opacity: 0.8; } 50% { top: 100%; opacity: 0.3; } }
        .animate-laser { animation: laser-scan 3s ease-in-out infinite; }
      `}} />

      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Ladle Pouring Intelligence Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time digital record scanning, secure cloud data storage, and process quality analytics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/60 border border-slate-800/80 rounded-xl shadow-inner">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
          <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
            <Database size={13} className="text-cyan-400" /> Database Storage Connected
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950/60 p-1.5 border border-slate-855 rounded-2xl w-full sm:w-[480px] shadow-lg shadow-slate-950/40">
        <button
          onClick={() => setActiveTab('ingest')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 ${activeTab === 'ingest' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 shadow-md' : 'text-slate-450 hover:text-slate-200'}`}
        >
          <Layers3 size={15} /> <span>Ladle Ingestion</span>
        </button>
        <button
          onClick={() => setActiveTab('historical')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 ${activeTab === 'historical' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 shadow-md' : 'text-slate-455 hover:text-slate-200'}`}
        >
          <History size={15} /> <span>Historical Analytics</span>
        </button>
      </div>

      {/* TAB 1: Ingestion */}
      {activeTab === 'ingest' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload Panel */}
            <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Layers3 className="text-cyan-400" size={22} />
                  <h2 className="text-lg font-bold text-slate-100">Intelligent Industrial Ingestor</h2>
                </div>
                <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                  Upload a handwritten or printed <strong>Ladle Pouring Record (PDF/JPG/PNG)</strong>. The system will read, align, and extract the data automatically.
                </p>
                <div
                  onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-300 ${dragActive ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/20'}`}
                >
                  <input id="file-upload" type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="p-3.5 bg-slate-900 rounded-xl text-slate-400 mb-4 border border-slate-800 shadow-md">
                    <UploadCloud size={28} className="text-cyan-400" />
                  </div>
                  <p className="text-slate-200 text-xs font-semibold mb-1">{file ? file.name : "Drag & Drop files here, or Click to Browse"}</p>
                  <p className="text-slate-550 text-[10px] uppercase font-bold tracking-wider">Supports PDF, JPG, PNG (Max 15MB)</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end">
                <button
                  onClick={handleUpload} disabled={loading || !file}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${loading || !file ? 'bg-slate-850 text-slate-650 cursor-not-allowed border border-slate-855' : 'bg-gradient-to-r from-cyan-500 to-indigo-500 hover:scale-[1.02]'}`}
                >
                  {loading ? (
                    <><span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /><span>Inference Scanning...</span></>
                  ) : (
                    <><ArrowRight size={14} /><span>Extract To Database</span></>
                  )}
                </button>
              </div>
            </div>

            {/* Live Status Panel */}
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
              {loading && <div className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser z-20 pointer-events-none" />}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="text-indigo-400" size={22} />
                  <h2 className="text-lg font-bold text-slate-100">Telemetry Stream</h2>
                </div>
                {loading ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-cyan-400 animate-spin" />
                      <div className="absolute inset-2 rounded-full border-4 border-slate-800 border-t-indigo-400 animate-spin" style={{ animationDirection: 'reverse' }} />
                    </div>
                    <div>
                      <h3 className="text-slate-200 text-xs font-bold uppercase tracking-wider">AI Vision Active</h3>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">Processing multi-page document alignment and JSON extraction.</p>
                    </div>
                  </div>
                ) : result ? (
                  <div className="space-y-4 py-1 flex flex-col h-full justify-between">
                    <div>
                      <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-850 space-y-3 shadow-inner">
                        <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase tracking-wider border-b border-slate-850 pb-2">
                          <CheckCircle className="text-emerald-400" size={14} /> <span>Inference Success</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Pours Extracted</span>
                            <strong className="text-slate-200 text-base font-bold font-mono">{processedRows.length} rows</strong>
                          </div>
                          <div>
                            <span className="text-slate-550 text-[10px] uppercase font-bold tracking-wider block">Logged Heat ID</span>
                            <strong className="text-cyan-400 text-xs font-bold truncate block font-mono">
                              {processedRows[0]?.heatNo || "N/A"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button onClick={handleCloseRecord} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2">
                        <ShieldCheck size={16} /> Verify & Close Record
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 flex flex-col items-center justify-center text-center text-slate-500">
                    <Database size={36} className="stroke-[1.5] text-slate-700 mb-3" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ready for Ingestion</p>
                  </div>
                )}
              </div>
              {error && (
                <div className="mt-4 p-4 bg-rose-950/20 border border-rose-900/30 text-rose-300 rounded-xl flex gap-3 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  <div><strong className="font-bold uppercase block mb-0.5">Error</strong>{error}</div>
                </div>
              )}
            </div>
          </div>
          {/* Extracted Data Blocks */}
          {result && (
            <div className="space-y-8 animate-fade-in">
              
              {/* Top 3 Cards for Queue Pages */}
              {(() => {
                const activePage = result.queue_pages?.[0] || {};
                const prod = activePage.production_plan || result.product_details || {};
                const pour = activePage.pouring_details || result.pouring_details || {};
                const qa = activePage.qa_parameters || result.inspection_parameters || {};
                
                const heatNo = activePage.production_plan?.heat_no || result.document_metadata?.heat_no || 'N/A';
                const date = activePage.production_plan?.pouring_date || activePage.production_plan?.planning_date || result.pouring_details?.date || result.document_metadata?.date || 'N/A';
                const customer = prod.customer || 'Unknown';
                const grade = prod.grade || 'N/A';
                
                const tappingTemp = pour.tapping_temp || pour.tapping_temperature || '-';
                const pouredWeight = pour.pouring_weight || '-';
                const pouringTempsRaw = pour.pouring_temp || pour.pouring_temperature || '';
                
                const mouldHardness = qa.hardness_mould || qa.mould_hardness_range || '-';
                const coreHardness = qa.hardness_core || qa.core_hardness_range || '-';
                const castingWeight = prod.casting_weight || '-';
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
                    
                    {/* Document Info Card */}
                    <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/70 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                        <Calendar size={120} className="text-slate-100" />
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                          <Calendar size={18} />
                        </div>
                        <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">Document Info</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-sm font-semibold">
                        <div className="space-y-1">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Pouring Date</span>
                          <strong className="text-slate-200 text-base font-semibold">{date}</strong>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Heat No</span>
                          <strong className="text-cyan-400 text-base font-semibold font-mono">{heatNo}</strong>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Customer & Grade</span>
                          <strong className="text-slate-200 text-sm font-semibold truncate block">
                            {customer} <span className="text-slate-550 px-1">|</span> {grade}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Pouring Metrics Card */}
                    <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/70 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                        <Flame size={120} className="text-slate-100" />
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-orange-950 text-orange-400 border border-orange-855/40">
                          <Flame size={18} />
                        </div>
                        <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">Pouring Metrics</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-sm font-semibold">
                        <div className="space-y-1">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Tapping Temp</span>
                          <strong className="text-rose-400 text-base font-semibold flex items-center gap-1 font-mono">
                            <Thermometer size={15} />{tappingTemp}
                          </strong>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Poured Weight</span>
                          <strong className="text-slate-200 text-base font-semibold font-mono">{pouredWeight}</strong>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Pouring Temperatures</span>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {pouringTempsRaw ? (
                              pouringTempsRaw.split(',').map((temp, i) => (
                                <span key={i} className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold">
                                  {temp.trim()}
                                </span>
                              ))
                            ) : (<span className="text-slate-550 text-xs">N/A</span>)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quality Assurance Card */}
                    <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/70 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                        <ShieldCheck size={120} className="text-slate-100" />
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          <ShieldCheck size={18} />
                        </div>
                        <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">Quality Assurance</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-sm font-semibold">
                        <div className="space-y-1">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Mould Hardness</span>
                          <strong className="text-emerald-400 text-base font-semibold font-mono">{mouldHardness}</strong>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Core Hardness</span>
                          <strong className="text-emerald-400 text-base font-semibold font-mono">{coreHardness}</strong>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <span className="text-slate-550 text-[10px] uppercase tracking-wider block font-bold">Casting Weight (Plan)</span>
                          <strong className="text-slate-200 text-sm font-semibold truncate block font-mono">
                            {castingWeight ? `${castingWeight} kg` : 'N/A'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* --------------------------------------------------------- */}
              {/* NEW: FULL EXTRACTED QUEUE DATA TABLE                      */}
              {/* --------------------------------------------------------- */}
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden mt-8 animate-fade-in">
                <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Scale size={20} className="text-cyan-400" />
                      <span>Extracted Queue Records (Pages 1-5)</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 font-semibold">
                      Comprehensive mapping of all handwritten and printed parameters across the production sequence.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-slate-800 text-xs font-semibold">
                    <thead className="bg-slate-950/60 text-slate-500 uppercase font-bold text-[9px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-4 text-center border-r border-slate-900/40">Page</th>
                        <th className="px-4 py-4 text-left border-r border-slate-900/40">Heat No</th>
                        <th className="px-4 py-4 text-left border-r border-slate-900/40">Pour Date</th>
                        <th className="px-4 py-4 text-left border-r border-slate-900/40 min-w-[150px]">Customer</th>
                        <th className="px-4 py-4 text-left border-r border-slate-900/40">Grade</th>
                        <th className="px-4 py-4 text-right border-r border-slate-900/40">Cast Wt</th>
                        <th className="px-4 py-4 text-right border-r border-slate-900/40">Mould Hardness</th>
                        <th className="px-4 py-4 text-right border-r border-slate-900/40">Core Hardness</th>
                        <th className="px-4 py-4 text-center border-r border-slate-900/40">Pour Time</th>
                        <th className="px-4 py-4 text-center border-r border-slate-900/40">Tapping Temp</th>
                        <th className="px-4 py-4 text-center border-r border-slate-900/40 min-w-[120px]">Pouring Temp</th>
                        <th className="px-4 py-4 text-center border-r border-slate-900/40">Ladle Temp</th>
                        <th className="px-4 py-4 text-right">Pour Wt</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-950/10 divide-y divide-slate-800/40 text-slate-300">
                      {processedRows && processedRows.length > 0 ? (
                        processedRows.map((row, idx) => {
                          return (
                            <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                              <td className="px-4 py-3.5 text-center border-r border-slate-900/40 font-bold text-slate-500">
                                {row.sequence}
                              </td>
                              <td className="px-4 py-3.5 border-r border-slate-900/40 font-mono text-cyan-400 font-bold">
                                {row.heatNo || '-'}
                              </td>
                              <td className="px-4 py-3.5 border-r border-slate-900/40 text-slate-400">
                                {row.date || '-'}
                              </td>
                              <td className="px-4 py-3.5 border-r border-slate-900/40 text-slate-200">
                                {row.customer || '-'}
                              </td>
                              <td className="px-4 py-3.5 border-r border-slate-900/40">
                                {row.grade ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400">
                                    {row.grade}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-3.5 text-right border-r border-slate-900/40 font-mono text-slate-300">
                                {row.rawCastingWeight || '-'}
                              </td>
                              <td className="px-4 py-3.5 text-right border-r border-slate-900/40 font-mono text-emerald-400">
                                {row.rawMouldHardness || '-'}
                              </td>
                              <td className="px-4 py-3.5 text-right border-r border-slate-900/40 font-mono text-emerald-400">
                                {row.rawCoreHardness || '-'}
                              </td>
                              <td className="px-4 py-3.5 text-center border-r border-slate-900/40 font-mono text-amber-500">
                                {row.rawPourTime ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <Clock size={12} className="opacity-60" /> {row.rawPourTime}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-3.5 text-center border-r border-slate-900/40 font-mono text-rose-400">
                                {row.rawTappingTemp || '-'}
                              </td>
                              <td className="px-4 py-3.5 text-center border-r border-slate-900/40 font-mono">
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  {row.rawPouringTemp ? (
                                    row.rawPouringTemp.split(',').map((t, i) => (
                                      <span key={i} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px]">
                                        {t.trim()}
                                      </span>
                                    ))
                                  ) : '-'}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center border-r border-slate-900/40 font-mono text-amber-500">
                                {row.rawLadleTemp || '-'}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono text-slate-200 font-bold">
                                {row.rawPouringWeight || '-'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="13" className="px-4 py-8 text-center text-slate-600 font-medium">
                            No queue data extracted from this document.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* --------------------------------------------------------- */}

              {/* Batch Summary Table Block */}
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden mt-8 animate-fade-in">
                <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Layers3 size={20} className="text-cyan-400" />
                      <span>Batch Material Summary (Page 6)</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 font-semibold">Extracted inventory and material consumption records.</p>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-slate-800 text-xs font-semibold">
                    <thead className="bg-slate-950/60 text-slate-500 uppercase font-bold text-[9px] tracking-wider">
                      <tr>
                        <th className="px-6 py-4 text-left border-r border-slate-900/40">Material Code</th>
                        <th className="px-6 py-4 text-left border-r border-slate-900/40">Description</th>
                        <th className="px-6 py-4 text-left border-r border-slate-900/40">Batch No</th>
                        <th className="px-6 py-4 text-right">Total Qty</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-950/10 divide-y divide-slate-800/40 text-slate-300">
                      {(() => {
                        const batchData = result.tables?.batch_summary || result.batch_summary || [];
                        return batchData && batchData.length > 0 ? (
                          batchData.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-900/40 transition-colors">
                              <td className="px-6 py-3.5 border-r border-slate-900/40 font-mono text-cyan-400">{row.material_code || '-'}</td>
                              <td className="px-6 py-3.5 border-r border-slate-900/40 text-slate-200">{row.material_description || '-'}</td>
                              <td className="px-6 py-3.5 border-r border-slate-900/40 text-slate-450">{row.batch_no || '-'}</td>
                              <td className="px-6 py-3.5 text-right font-mono text-emerald-400 font-bold">{row.t_qty || '-'} {row.unit || ''}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-600 font-medium">No batch data found in this document.</td></tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic sleeves and consumables grid */}
              {result.tables && (result.tables.sleeves?.length > 0 || result.tables.consumables?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                  {/* Sleeves Table */}
                  {result.tables.sleeves?.length > 0 && (
                    <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden animate-fade-in">
                      <div className="p-6 border-b border-slate-800">
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                          <Layers3 size={20} className="text-indigo-400" />
                          <span>Sleeves Specifications</span>
                        </h3>
                        <p className="text-slate-400 text-xs mt-1 font-semibold">Extracted sleeve consumption parameters.</p>
                      </div>
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-slate-800 text-xs font-semibold">
                          <thead className="bg-slate-950/60 text-slate-500 uppercase font-bold text-[9px] tracking-wider">
                            <tr>
                              <th className="px-6 py-4 text-left border-r border-slate-900/40">Sleeve Code</th>
                              <th className="px-6 py-4 text-right">Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="bg-slate-950/10 divide-y divide-slate-800/40 text-slate-300">
                            {result.tables.sleeves.map((row, index) => (
                              <tr key={index} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-6 py-3.5 border-r border-slate-900/40 font-mono text-cyan-400">{row.code || '-'}</td>
                                <td className="px-6 py-3.5 text-right font-mono text-emerald-400 font-bold">{row.qty || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Consumables Table */}
                  {result.tables.consumables?.length > 0 && (
                    <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden animate-fade-in">
                      <div className="p-6 border-b border-slate-800">
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                          <Activity size={20} className="text-amber-400" />
                          <span>Handwritten Consumables</span>
                        </h3>
                        <p className="text-slate-400 text-xs mt-1 font-semibold">Extracted handwritten sand, oil, and gas additions.</p>
                      </div>
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-slate-800 text-xs font-semibold">
                          <thead className="bg-slate-950/60 text-slate-500 uppercase font-bold text-[9px] tracking-wider">
                            <tr>
                              <th className="px-6 py-4 text-left border-r border-slate-900/40">Consumable Item</th>
                              <th className="px-6 py-4 text-right">Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="bg-slate-950/10 divide-y divide-slate-800/40 text-slate-300">
                            {result.tables.consumables.map((row, index) => (
                              <tr key={index} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-6 py-3.5 border-r border-slate-900/40 text-slate-200">{row.item || '-'}</td>
                                <td className="px-6 py-3.5 text-right font-mono text-emerald-400 font-bold">{row.qty || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Graphical Recharts Dashboards */}
              <div className="space-y-8 pt-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="text-cyan-400" size={22} />
                    <h2 className="text-xl font-bold text-slate-100">Analytical Telemetry Dashboards</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Plot 1: Pouring Time vs Weight */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">Pouring Time vs Weight</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Process Optimization</span>
                      </div>
                      <div className="h-[280px] w-full mt-3 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis type="number" dataKey="pouredWeight" name="Poured Weight" unit=" kg" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 'auto']} ticks={getTab1XTicks()} />
                            <YAxis type="number" dataKey="pouringTimeSec" name="Pouring Time" unit=" sec" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 'auto']} ticks={getTab1YTicks()} />
                            <ZAxis type="number" range={[65, 65]} />
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#334155' }} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <Scatter name="Pours" data={processedRows} fill="#22d3ee" shape="circle" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Plot 2: Tapping Temp vs Pouring Temp */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">Tapping Temp vs Pouring Temp</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Heat Loss</span>
                      </div>
                      <div className="h-[280px] w-full mt-3 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <LineChart data={processedRows} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="id" stroke="#475569" tickFormatter={(v, i) => `Seq ${i + 1}`} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[1500, 1660]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <Line type="monotone" dataKey="tappingTemp" name="Tapping Temp (Furnace)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="pouringTemp" name="Pouring Temp (Mold)" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Plot 3: Temperature Loss (ΔT) */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">Temperature Loss (ΔT)</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Energy Efficiency</span>
                      </div>
                      <div className="h-[280px] w-full mt-3 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <AreaChart data={processedRows} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                            <defs>
                              <linearGradient id="colorTempLoss" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="id" stroke="#475569" tickFormatter={(v, i) => `Seq ${i + 1}`} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <Area type="monotone" dataKey="tempLoss" name="Thermal Loss (ΔT in °C)" stroke="#818cf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTempLoss)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Plot 4: SPC Control Charts */}
                  <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-base font-bold text-slate-200">SPC Control Chart</h3>
                        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-wider">Process Stability</span>
                      </div>
                      <div className="h-[280px] w-full mt-4 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <LineChart data={getSpcChartData()} margin={{ top: 15, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="index" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} domain={[dataMin => Math.min(dataMin - 2, spcLimits.lcl - 2), dataMax => Math.max(dataMax + 2, spcLimits.ucl + 2)]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <ReferenceLine y={spcLimits.ucl} label={{ value: `UCL (+3σ)`, fill: '#ef4444', position: 'top', fontSize: 10 }} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                            <ReferenceLine y={spcLimits.mean} label={{ value: `Mean (CL)`, fill: '#818cf8', position: 'right', fontSize: 10 }} stroke="#818cf8" strokeWidth={1.5} />
                            <ReferenceLine y={spcLimits.lcl} label={{ value: `LCL (-3σ)`, fill: '#ef4444', position: 'bottom', fontSize: 10 }} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                            <Line type="monotone" dataKey="weightDiff" name="Weight Error (kg)" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', stroke: '#a78bfa' }} activeDot={{ r: 7 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Historical Multi-Heat Multi-Series Analytics */}
      {activeTab === 'historical' && (
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <History className="text-cyan-400" size={22} />
              <h2 className="text-xl font-bold text-slate-100">Multi-Heat Comparative Analytics</h2>
            </div>
            <div className="flex items-center gap-3.5">
              <button onClick={handleExport} disabled={exporting} className={`px-4 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${exporting ? 'bg-slate-850 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.03]'}`}>
                {exporting ? <><span className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" /><span>Exporting...</span></> : <><Download size={14} /><span>Export Excel</span></>}
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-cyan-400 animate-spin" />
              <p className="text-slate-400 text-xs font-bold uppercase">Loading saved documents...</p>
            </div>
          ) : historicalHeats.length === 0 ? (
            <div className="py-20 text-center bg-slate-900/40 border border-slate-850 rounded-2xl p-8 flex flex-col items-center">
              <Database size={44} className="text-slate-700 mb-4" />
              <h3 className="text-slate-200 text-sm font-bold uppercase tracking-wider">Historical Database is Empty</h3>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-2">
                    <h3 className="text-base font-bold text-slate-200">Pouring Time vs Weight (Multi-Heat Series)</h3>
                  </div>
                  <div className="h-[400px] w-full mt-4 relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" dataKey="pouredWeight" name="Poured Weight" unit=" kg" stroke="#475569" tick={{ fontSize: 10 }} ticks={getHistoricalXTicks()} />
                        <YAxis type="number" dataKey="pouringTimeSec" name="Pouring Time" unit=" sec" stroke="#475569" tick={{ fontSize: 10 }} ticks={getHistoricalYTicks()} />
                        <ZAxis type="number" range={[65, 65]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 15 }} />
                        {historicalHeats.map((heat, idx) => (
                          <Scatter key={heat.heatNo} name={`Heat ${heat.heatNo}`} data={heat.data} fill={HEAT_COLORS[idx % HEAT_COLORS.length]} shape="circle" />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}