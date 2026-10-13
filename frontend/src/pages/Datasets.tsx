import { useState, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  UploadCloud, FileSpreadsheet,
  Sparkles, Layers, HardDrive, ArrowRight, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, AlertTriangle,
  Download, Sliders, BarChart2, Cpu, Trash2, Eye, Search, X
} from 'lucide-react';

interface DatasetItem {
  id: number;
  name: string;
  file_type: string;
  is_cleaned?: boolean;
  quality_score?: number;
  created_at?: string;
  schema_info?: {
    row_count?: number;
    column_count?: number;
    columns?: Array<{ name: string; type: string }>;
  };
  audit_info?: any;
}

const Datasets = () => {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string; actionDatasetId?: number } | null>(null);
  const [purgingDatasetId, setPurgingDatasetId] = useState<number | null>(null);

  // Instant File Preview & Spreadsheet Explorer Modal States
  const [previewModalDataset, setPreviewModalDataset] = useState<DatasetItem | null>(null);
  const [filePreviewData, setFilePreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSearchTerm, setPreviewSearchTerm] = useState('');

  // Quality & Cleaning Suite States
  const [auditModalDataset, setAuditModalDataset] = useState<DatasetItem | null>(null);
  const [auditData, setAuditData] = useState<any>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanChangelog, setCleanChangelog] = useState<string[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Cleaning options
  const [handleMissing, setHandleMissing] = useState<string>("infer");
  const [handleOutliers, setHandleOutliers] = useState<string>("cap");
  const [handleDuplicates, setHandleDuplicates] = useState<boolean>(true);
  const [fixDataTypes, setFixDataTypes] = useState<boolean>(true);
  const [standardizeText, setStandardizeText] = useState<boolean>(true);
  const [removeIrrelevant, setRemoveIrrelevant] = useState<boolean>(true);

  // Active EDA Tab in Modal
  const [activeEdaTab, setActiveEdaTab] = useState<'anomalies' | 'eda' | 'options' | 'changelog'>('anomalies');

  useEffect(() => {
    fetchDatasets();
  }, []);

  const openAuditModal = async (dataset: DatasetItem) => {
    setAuditModalDataset(dataset);
    setAuditData(null);
    setCleanChangelog(null);
    setAuditError(null);
    setActiveEdaTab('anomalies');
    setIsAuditing(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/v1/datasets/${dataset.id}/audit`);
      setAuditData(res.data.audit);
    } catch (err: any) {
      console.error('Failed to audit dataset', err);
      setAuditError(err.response?.data?.detail || 'Could not audit dataset.');
    } finally {
      setIsAuditing(false);
    }
  };

  const openFilePreview = async (dataset: DatasetItem) => {
    setPreviewModalDataset(dataset);
    setFilePreviewData(null);
    setPreviewError(null);
    setPreviewSearchTerm('');
    setIsLoadingPreview(true);

    try {
      const res = await axios.get(`http://localhost:8000/api/v1/datasets/${dataset.id}/preview?limit=100`);
      setFilePreviewData(res.data);
    } catch (err: any) {
      console.error('Failed to preview dataset', err);
      setPreviewError(err.response?.data?.detail || 'Failed to open and preview dataset file.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const runCleanse = async (proceedToAnalysis: boolean = false) => {
    if (!auditModalDataset) return;
    setIsCleaning(true);
    try {
      const payload = {
        handle_duplicates: handleDuplicates,
        handle_missing: handleMissing,
        handle_outliers: handleOutliers,
        fix_data_types: fixDataTypes,
        normalize_dates: true,
        standardize_text: standardizeText,
        remove_irrelevant: removeIrrelevant,
        standardize_names: true
      };

      const res = await axios.post(`http://localhost:8000/api/v1/datasets/${auditModalDataset.id}/clean`, payload);
      setCleanChangelog(res.data.changelog);
      setAuditData(res.data.audit);
      setActiveEdaTab('changelog');
      await fetchDatasets();

      if (proceedToAnalysis) {
        navigate('/', { state: { selectedDatasetId: auditModalDataset.id } });
      }
    } catch (err: any) {
      console.error('Failed to clean dataset', err);
      alert(err.response?.data?.detail || 'Failed to clean dataset');
    } finally {
      setIsCleaning(false);
    }
  };

  const fetchDatasets = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/datasets/');
      setDatasets(res.data);
    } catch (err) {
      console.error('Failed to fetch datasets', err);
    }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const res = await axios.post('http://localhost:8000/api/v1/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const newDataset = res.data.dataset;
      const isClean = res.data.is_clean;
      const qualityScore = res.data.quality_score;

      await fetchDatasets();

      if (isClean) {
        setStatusMessage({ 
          type: 'success', 
          text: `"${file.name}" is verified Clean & Ready (Quality Score: ${qualityScore}/100)! You can proceed directly to analysis.`,
          actionDatasetId: newDataset.id
        });
      } else {
        setStatusMessage({ 
          type: 'warning', 
          text: `"${file.name}" uploaded as Raw/Unprocessed data (Quality Score: ${qualityScore}/100). Opening EDA & Data Cleaning Studio...`,
          actionDatasetId: newDataset.id
        });
        // Automatically open EDA & Data Cleaning Studio for unprocessed data
        openAuditModal(newDataset);
      }

      return res.data;
    } catch (err: any) {
      console.error('Failed to upload file', err);
      setStatusMessage({ 
        type: 'error', 
        text: err.response?.data?.detail || 'Failed to process dataset. Please check file formatting.' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const exportDatasetFile = (datasetId: number, format: 'csv' | 'excel') => {
    window.open(`http://localhost:8000/api/v1/datasets/${datasetId}/export?format=${format}`, '_blank');
  };

  const handleDeleteDataset = async (ds: DatasetItem) => {
    if (!window.confirm(`Are you sure you want to permanently purge "${ds.name}"? This will remove all table records and file mappings.`)) {
      return;
    }
    setPurgingDatasetId(ds.id);
    try {
      await axios.delete(`http://localhost:8000/api/v1/datasets/${ds.id}`);
      setDatasets(prev => prev.filter(d => d.id !== ds.id));
      setStatusMessage({
        type: 'success',
        text: `Dataset "${ds.name}" was successfully purged from registry and disk.`
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to purge dataset', err);
      alert(err.response?.data?.detail || 'Failed to purge dataset.');
    } finally {
      setPurgingDatasetId(null);
    }
  };

  const totalRows = datasets.reduce((acc, d) => acc + (d.schema_info?.row_count || 0), 0);
  const cleanDatasetsCount = datasets.filter(d => d.is_cleaned || (d.quality_score && d.quality_score >= 90)).length;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Universal Data Ingestion & Quality Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Dataset <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">Ingestion & Cleaning</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Upload any file format (CSV, Excel, JSON, TSV, Parquet, XML, or Text). Clean data proceeds straight to analysis; raw primary data triggers automated Exploratory Data Analysis & cleansing.
          </p>
        </div>

        <button
          onClick={fetchDatasets}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl glass-panel hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : statusMessage.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {statusMessage.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
          {statusMessage.actionDatasetId && (
            <button
              onClick={() => navigate('/', { state: { selectedDatasetId: statusMessage.actionDatasetId } })}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-all shrink-0"
            >
              <span>Proceed to Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Metric Highlights Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{datasets.length}</div>
            <div className="text-xs text-slate-400 font-medium">Total Datasets</div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{cleanDatasetsCount} / {datasets.length}</div>
            <div className="text-xs text-slate-400 font-medium">Clean & Analysis-Ready</div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{totalRows.toLocaleString()}</div>
            <div className="text-xs text-slate-400 font-medium">Total Ingested Records</div>
          </div>
        </div>
      </div>

      {/* Universal Upload Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Universal Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`lg:col-span-2 relative overflow-hidden rounded-3xl p-8 border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer group ${
            dragActive
              ? 'bg-indigo-600/15 border-indigo-400 shadow-[0_0_35px_rgba(99,102,241,0.3)]'
              : 'glass-panel border-dashed border-white/15 hover:border-indigo-400/50 hover:bg-white/[0.04]'
          }`}
        >
          <input
            type="file"
            accept="*/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all">
              {isUploading ? (
                <div className="w-7 h-7 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <UploadCloud className="w-8 h-8 text-indigo-300" />
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold text-white mb-1 tracking-tight">
            {isUploading ? 'Ingesting, Detecting Anomalies & Profiling Dataset...' : 'Drop ANY dataset here, or click to browse'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mb-4 leading-relaxed">
            Universal file support: <span className="text-slate-200 font-semibold">CSV, Excel, JSON, TSV, Parquet, XML, Text & Semi-structured data</span>. Uncleaned primary data triggers deep Exploratory Data Analysis (EDA) and automated cleansing.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md">
            {['.CSV', '.XLSX', '.JSON', '.TSV', '.PARQUET', '.XML', '.TXT / LOG'].map((ext) => (
              <span key={ext} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300">
                {ext}
              </span>
            ))}
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono text-indigo-300">
              Any Format
            </span>
          </div>
        </div>

        {/* Workflow Info Card */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Smart Ingestion Pipeline</h3>
                <span className="text-[11px] text-slate-400">Autonomous Hygiene Decision</span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Clean Dataset</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Proceeds immediately to natural language SQL queries, charts, and executive insights.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Unprocessed / Raw Dataset</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Triggers EDA analysis: scans missing values, duplicates, bad types & outliers, then converts to cleaned data.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Adheres to strict ISO data cleaning principles</span>
          </div>
        </div>

      </div>

      {/* Dataset Inventory Table */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
        <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Available Datasets</h2>
            <p className="text-xs text-slate-400">Monitor data quality status, audit hygiene, and proceed to agent analysis</p>
          </div>
          <div className="text-xs text-indigo-400 font-medium flex items-center gap-1">
            <span>{datasets.length} Total Datasets</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-white/[0.03]">
                <th className="px-6 py-3.5 font-semibold">Dataset Name</th>
                <th className="px-6 py-3.5 font-semibold">Format</th>
                <th className="px-6 py-3.5 font-semibold">Quality Status</th>
                <th className="px-6 py-3.5 font-semibold">Hygiene Score</th>
                <th className="px-6 py-3.5 font-semibold">Rows / Cols</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {datasets.map((ds) => {
                const score = ds.quality_score ?? 100;
                const isClean = ds.is_cleaned || score >= 90;

                return (
                  <tr key={ds.id} className="hover:bg-white/[0.04] transition-colors group">
                    <td className="px-6 py-4">
                      <div 
                        onClick={() => openFilePreview(ds)}
                        className="flex items-center gap-3 cursor-pointer group/file w-fit"
                        title={`Click to open and inspect ${ds.name}`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 group-hover/file:bg-indigo-500/25 border border-indigo-500/20 group-hover/file:border-indigo-500/50 flex items-center justify-center text-indigo-400 group-hover/file:scale-105 group-hover/file:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white tracking-tight group-hover/file:text-indigo-300 group-hover/file:underline flex items-center gap-1.5 transition-colors">
                            <span>{ds.name}</span>
                            <Eye className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover/file:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                            <span>ID: #{ds.id}</span>
                            <span className="text-[10px] text-indigo-400/80 font-sans group-hover/file:text-indigo-300">Click to open</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {ds.file_type || 'CSV'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {isClean ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Clean & Ready</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Raw / Uncleaned</span>
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${score >= 90 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {score}/100
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${score >= 90 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono text-slate-300 text-xs">
                      {ds.schema_info?.row_count?.toLocaleString() || 0} rows • {ds.schema_info?.column_count || 0} cols
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Quality & Clean button */}
                        <button
                          onClick={() => openAuditModal(ds)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                            isClean
                              ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
                              : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-200 hover:text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          }`}
                          title="EDA, Anomaly Audit & Cleansing Studio"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{isClean ? 'Inspect Quality' : 'EDA & Clean'}</span>
                        </button>

                        {/* Export clean copy */}
                        <button
                          onClick={() => exportDatasetFile(ds.id, 'csv')}
                          className="p-1.5 rounded-xl glass-panel hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                          title="Export Dataset as CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Analyze button */}
                        <button
                          onClick={() => navigate('/', { state: { selectedDatasetId: ds.id } })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition-all group cursor-pointer"
                        >
                          <span>Analyze</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </button>

                        {/* Purge unwanted dataset button */}
                        <button
                          onClick={() => handleDeleteDataset(ds)}
                          disabled={purgingDatasetId === ds.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-100 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 shadow-[0_0_12px_rgba(244,63,94,0.15)] hover:shadow-[0_0_18px_rgba(244,63,94,0.3)]"
                          title={`Purge & permanently remove ${ds.name}`}
                        >
                          <Trash2 className={`w-3.5 h-3.5 text-rose-400 ${purgingDatasetId === ds.id ? 'animate-spin' : ''}`} />
                          <span>{purgingDatasetId === ds.id ? 'Purging...' : 'Purge'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {datasets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-slate-300">No datasets uploaded yet</p>
                      <p className="text-xs text-slate-500 mt-1">Upload any tabular or text file format above to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exploratory Data Analysis (EDA) & Data Cleaning Studio Modal */}
      {auditModalDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl border border-white/15 p-6 max-w-3xl w-full max-h-[92vh] overflow-y-auto space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Exploratory Data Analysis & Cleaning Studio</span>
                  </h3>
                  <p className="text-xs text-slate-400">{auditModalDataset.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setAuditModalDataset(null)}
                className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {isAuditing ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-9 h-9 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-200 font-medium">Conducting deep EDA anomaly audit...</p>
                <p className="text-xs text-slate-400">Inspecting missing values, duplicate records, data types, and outliers</p>
              </div>
            ) : auditError ? (
              <div className="py-6 text-center space-y-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {auditError}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => auditModalDataset && openAuditModal(auditModalDataset)}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-semibold text-cyan-200 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Audit</span>
                  </button>
                  <button
                    onClick={() => setAuditModalDataset(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : auditData ? (
              <div className="space-y-5">
                
                {/* Health Score Banner */}
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  auditData.quality_score >= 90
                    ? 'bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border-emerald-500/30'
                    : auditData.quality_score >= 60
                    ? 'bg-gradient-to-r from-amber-950/40 to-yellow-950/40 border-amber-500/30'
                    : 'bg-gradient-to-r from-rose-950/40 to-red-950/40 border-rose-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-white">{auditData.quality_score}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">/ 100</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Data Hygiene Score</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          auditData.is_clean ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {auditData.is_clean ? 'Clean & Ready' : 'Raw / Needs Cleansing'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
                        {auditData.summary}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-300 shrink-0 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-4">
                    <div className="font-mono">{auditData.total_rows?.toLocaleString()} rows • {auditData.total_columns} columns</div>
                    <div className="text-slate-400 mt-0.5">
                      {auditData.anomalies?.duplicate_records?.duplicate_rows || 0} duplicate row(s)
                    </div>
                  </div>
                </div>

                {/* Studio Tab Navigation */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <button
                    onClick={() => setActiveEdaTab('anomalies')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeEdaTab === 'anomalies'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>6 Common Anomalies</span>
                  </button>

                  <button
                    onClick={() => setActiveEdaTab('eda')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeEdaTab === 'eda'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>EDA Statistics</span>
                  </button>

                  <button
                    onClick={() => setActiveEdaTab('options')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeEdaTab === 'options'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Cleaning Techniques</span>
                  </button>

                  {cleanChangelog && (
                    <button
                      onClick={() => setActiveEdaTab('changelog')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeEdaTab === 'changelog'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Applied Changelog ({cleanChangelog.length})</span>
                    </button>
                  )}
                </div>

                {/* Tab 1: 6 Common Anomalies */}
                {activeEdaTab === 'anomalies' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      
                      {/* 01 Missing Values */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-indigo-400">01</span> Missing Values
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            (auditData.anomalies?.missing_values?.total_missing_cells || 0) > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {auditData.anomalies?.missing_values?.total_missing_cells || 0} nulls ({auditData.anomalies?.missing_values?.missing_percentage || 0}%)
                          </span>
                        </div>
                        {Object.keys(auditData.anomalies?.missing_values?.columns_with_missing || {}).length > 0 ? (
                          <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-300">
                            {Object.entries(auditData.anomalies.missing_values.columns_with_missing).map(([col, info]: any) => (
                              <div key={col} className="flex justify-between border-b border-white/5 pb-0.5">
                                <span className="text-slate-200">{col}</span>
                                <span className="text-amber-400">{info.count} ({info.percentage}%)</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-[11px]">No missing cells detected.</p>
                        )}
                      </div>

                      {/* 02 Duplicate Records */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-indigo-400">02</span> Duplicate Records
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            (auditData.anomalies?.duplicate_records?.duplicate_rows || 0) > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {auditData.anomalies?.duplicate_records?.duplicate_rows || 0} duplicate row(s)
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          {(auditData.anomalies?.duplicate_records?.duplicate_rows || 0) > 0
                            ? `Found ${auditData.anomalies.duplicate_records.duplicate_rows} duplicate record(s). De-duplication will eliminate redundancies.`
                            : 'Zero duplicate rows detected.'}
                        </p>
                      </div>

                      {/* 03 Incorrect Data Types */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-indigo-400">03</span> Incorrect Data Types
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            (auditData.anomalies?.incorrect_data_types?.length || 0) > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {auditData.anomalies?.incorrect_data_types?.length || 0} mismatched
                          </span>
                        </div>
                        {(auditData.anomalies?.incorrect_data_types?.length || 0) > 0 ? (
                          <div className="space-y-1 text-[11px]">
                            {auditData.anomalies.incorrect_data_types.map((m: any, i: number) => (
                              <div key={i} className="text-slate-300">
                                <span className="font-mono text-cyan-300">{m.column}</span>: {m.detected_actual_type}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-[11px]">All column types align with underlying data.</p>
                        )}
                      </div>

                      {/* 04 Outliers */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-indigo-400">04</span> Outliers (IQR Method)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            (auditData.anomalies?.outliers?.length || 0) > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {auditData.anomalies?.outliers?.length || 0} columns with outliers
                          </span>
                        </div>
                        {(auditData.anomalies?.outliers?.length || 0) > 0 ? (
                          <div className="space-y-1 text-[11px] font-mono">
                            {auditData.anomalies.outliers.map((o: any, i: number) => (
                              <div key={i} className="text-slate-300 flex justify-between">
                                <span className="text-cyan-300">{o.column}</span>
                                <span className="text-amber-400">{o.outlier_count} values outside [{o.lower_bound}, {o.upper_bound}]</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-[11px]">No extreme statistical outliers detected.</p>
                        )}
                      </div>

                      {/* 05 Inconsistent Formats */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-indigo-400">05</span> Inconsistent Formats
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300">
                            {auditData.anomalies?.inconsistent_formats?.whitespace_issues_count || 0} whitespace issues
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          {(auditData.anomalies?.inconsistent_formats?.whitespace_issues_count || 0) > 0
                            ? `Detected trailing/leading whitespace or casing irregularities.`
                            : 'Formatting and casing are uniform.'}
                        </p>
                      </div>

                      {/* 06 Irrelevant Data */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-indigo-400">06</span> Irrelevant / Empty Data
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300">
                            {(auditData.anomalies?.irrelevant_data?.constant_columns?.length || 0) + (auditData.anomalies?.irrelevant_data?.empty_columns?.length || 0)} columns
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          {(auditData.anomalies?.irrelevant_data?.constant_columns?.length || 0) > 0
                            ? `Constant single-value columns detected: ${auditData.anomalies.irrelevant_data.constant_columns.join(', ')}`
                            : 'No redundant constant columns.'}
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                {/* Tab 2: EDA Statistics */}
                {activeEdaTab === 'eda' && (
                  <div className="space-y-4">
                    {auditData.eda_profile?.numeric_metrics && Object.keys(auditData.eda_profile.numeric_metrics).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Numeric Distributions</h4>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="w-full text-left text-xs font-mono">
                            <thead className="bg-white/5 text-slate-400 border-b border-white/10">
                              <tr>
                                <th className="p-2.5">Column</th>
                                <th className="p-2.5">Min</th>
                                <th className="p-2.5">Median</th>
                                <th className="p-2.5">Mean</th>
                                <th className="p-2.5">Max</th>
                                <th className="p-2.5">Std Dev</th>
                                <th className="p-2.5">Outliers</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {Object.entries(auditData.eda_profile.numeric_metrics).map(([col, m]: any) => (
                                <tr key={col} className="hover:bg-white/[0.02]">
                                  <td className="p-2.5 font-sans font-medium text-white">{col}</td>
                                  <td className="p-2.5 text-slate-300">{m.min}</td>
                                  <td className="p-2.5 text-cyan-300">{m.median}</td>
                                  <td className="p-2.5 text-slate-300">{m.mean}</td>
                                  <td className="p-2.5 text-slate-300">{m.max}</td>
                                  <td className="p-2.5 text-slate-400">{m.std}</td>
                                  <td className="p-2.5 text-amber-400">{m.outlier_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {auditData.eda_profile?.categorical_metrics && Object.keys(auditData.eda_profile.categorical_metrics).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Categorical Features</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.entries(auditData.eda_profile.categorical_metrics).map(([col, m]: any) => (
                            <div key={col} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-bold text-white">{col}</span>
                                <span className="text-[10px] font-mono text-cyan-400">{m.unique_values} unique</span>
                              </div>
                              <div className="space-y-1 font-mono text-[11px] text-slate-300">
                                {m.top_values?.slice(0, 3).map((tv: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-slate-400">
                                    <span className="truncate max-w-[140px] text-slate-300">{tv.label}</span>
                                    <span>{tv.count} rows</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Cleaning Options */}
                {activeEdaTab === 'options' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                      Configure automated cleansing techniques based on the ISO Data Cleaning Process:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      
                      {/* Missing values strategy */}
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                        <label className="font-bold text-white block">Missing Values Strategy</label>
                        <select
                          value={handleMissing}
                          onChange={(e) => setHandleMissing(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-slate-200 text-xs"
                        >
                          <option value="infer">Infer (Median for Numeric, Mode for Text)</option>
                          <option value="delete">Delete rows with missing values</option>
                          <option value="ignore">Ignore (keep nulls)</option>
                        </select>
                        <span className="text-[11px] text-slate-400 block">Imputes statistics without distorting variance.</span>
                      </div>

                      {/* Outliers strategy */}
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                        <label className="font-bold text-white block">Outliers Strategy</label>
                        <select
                          value={handleOutliers}
                          onChange={(e) => setHandleOutliers(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-slate-200 text-xs"
                        >
                          <option value="cap">Cap / Winsorize to IQR thresholds</option>
                          <option value="flag">Flag (add is_outlier column)</option>
                          <option value="delete">Delete extreme outlier rows</option>
                          <option value="ignore">Ignore outliers</option>
                        </select>
                        <span className="text-[11px] text-slate-400 block">Preserves dataset volume while eliminating skews.</span>
                      </div>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={handleDuplicates}
                          onChange={(e) => setHandleDuplicates(e.target.checked)}
                          className="rounded text-indigo-500"
                        />
                        <span className="text-slate-300 font-medium">De-duplicate identical rows</span>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fixDataTypes}
                          onChange={(e) => setFixDataTypes(e.target.checked)}
                          className="rounded text-indigo-500"
                        />
                        <span className="text-slate-300 font-medium">Fix data types (Strip $, %, parse dates)</span>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={standardizeText}
                          onChange={(e) => setStandardizeText(e.target.checked)}
                          className="rounded text-indigo-500"
                        />
                        <span className="text-slate-300 font-medium">Trim whitespace & standardize casing</span>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={removeIrrelevant}
                          onChange={(e) => setRemoveIrrelevant(e.target.checked)}
                          className="rounded text-indigo-500"
                        />
                        <span className="text-slate-300 font-medium">Drop empty & zero-variance constant cols</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Tab 4: Changelog */}
                {activeEdaTab === 'changelog' && cleanChangelog && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-3">
                    <div className="font-bold text-emerald-300 flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Dataset Cleaned & Normalized Successfully!</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-emerald-100 font-mono text-[11px]">
                      {cleanChangelog.map((log, idx) => (
                        <li key={idx}>{log}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportDatasetFile(auditModalDataset.id, 'csv')}
                      className="px-3.5 py-2 rounded-xl glass-panel hover:bg-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Cleaned CSV</span>
                    </button>
                    <button
                      onClick={() => exportDatasetFile(auditModalDataset.id, 'excel')}
                      className="px-3.5 py-2 rounded-xl glass-panel hover:bg-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runCleanse(false)}
                      disabled={isCleaning}
                      className="px-4 py-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-semibold text-indigo-300 hover:text-white flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isCleaning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{isCleaning ? 'Cleaning...' : 'Apply Cleansing'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (auditData.is_clean) {
                          navigate('/', { state: { selectedDatasetId: auditModalDataset.id } });
                        } else {
                          runCleanse(true);
                        }
                      }}
                      disabled={isCleaning}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:opacity-95 text-xs font-bold text-white shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <span>{auditData.is_clean ? 'Proceed to Analysis' : 'Clean & Proceed to Analysis'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* Interactive Dataset File Viewer & Spreadsheet Modal */}
      {previewModalDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl border border-white/15 p-5 sm:p-7 max-w-6xl w-full max-h-[94vh] flex flex-col space-y-4 shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-cyan-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {previewModalDataset.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                      {previewModalDataset.file_type || 'CSV'}
                    </span>
                    {filePreviewData && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        filePreviewData.quality_score >= 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        Score: {filePreviewData.quality_score}/100
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                    <span>ID: #{previewModalDataset.id}</span>
                    {filePreviewData && (
                      <>
                        <span>•</span>
                        <span>{filePreviewData.total_rows?.toLocaleString()} rows</span>
                        <span>•</span>
                        <span>{filePreviewData.total_columns} columns</span>
                        {filePreviewData.file_size_bytes > 0 && (
                          <>
                            <span>•</span>
                            <span>{(filePreviewData.file_size_bytes / 1024).toFixed(1)} KB</span>
                          </>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons in Modal Header */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => exportDatasetFile(previewModalDataset.id, 'csv')}
                  className="px-3 py-1.5 rounded-xl glass-panel hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Open or download raw file"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open Raw File</span>
                </button>

                <button
                  onClick={() => navigate('/', { state: { selectedDatasetId: previewModalDataset.id } })}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 text-xs font-semibold text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Analyze Dataset</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setPreviewModalDataset(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {isLoadingPreview ? (
              <div className="flex-1 py-24 flex flex-col items-center justify-center space-y-3">
                <div className="w-9 h-9 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-white">Opening & reading dataset records...</p>
                <p className="text-xs text-slate-400">Parsing tabular structure and extracting column schema</p>
              </div>
            ) : previewError ? (
              <div className="flex-1 py-12 flex flex-col items-center justify-center space-y-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs max-w-md text-center">
                  {previewError}
                </div>
                <button
                  onClick={() => openFilePreview(previewModalDataset)}
                  className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Opening</span>
                </button>
              </div>
            ) : filePreviewData ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={previewSearchTerm}
                      onChange={(e) => setPreviewSearchTerm(e.target.value)}
                      placeholder="Filter records (search across any column)..."
                      className="w-full bg-slate-900/90 border border-white/15 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition-all"
                    />
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 font-mono text-[11px]">
                      Showing {(() => {
                        const term = previewSearchTerm.trim().toLowerCase();
                        if (!term) return filePreviewData.rows?.length || 0;
                        return filePreviewData.rows.filter((r: any) => Object.values(r).some((v: any) => String(v).toLowerCase().includes(term))).length;
                      })()} of {filePreviewData.rows?.length || 0} preview rows
                    </span>
                    <span className="text-[11px] text-indigo-300">
                      ({filePreviewData.total_rows?.toLocaleString()} total in dataset)
                    </span>
                  </div>
                </div>

                {/* Spreadsheet Table View */}
                <div className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 custom-scrollbar shadow-inner max-h-[58vh]">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-10 border-b border-white/15 shadow-sm">
                      <tr>
                        <th className="px-3 py-2.5 text-slate-500 font-bold border-r border-white/10 w-12 text-center bg-slate-900/90 select-none">
                          #
                        </th>
                        {filePreviewData.columns?.map((col: any) => (
                          <th key={col.name} className="px-4 py-2.5 text-slate-200 font-semibold border-r border-white/5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-bold">{col.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase font-sans">
                                {col.type.replace('dtype[', '').replace(']', '')}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        const term = previewSearchTerm.trim().toLowerCase();
                        const rows = term
                          ? filePreviewData.rows.filter((r: any) => Object.values(r).some((v: any) => String(v).toLowerCase().includes(term)))
                          : filePreviewData.rows;

                        if (rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={(filePreviewData.columns?.length || 0) + 1} className="px-6 py-12 text-center text-slate-400">
                                No records match "{previewSearchTerm}"
                              </td>
                            </tr>
                          );
                        }

                        return rows.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/[0.04] transition-colors group">
                            <td className="px-3 py-2 text-slate-500 text-center border-r border-white/10 select-none group-hover:text-slate-300">
                              {idx + 1}
                            </td>
                            {filePreviewData.columns?.map((col: any) => {
                              const val = row[col.name];
                              const isNull = val === null || val === undefined || val === '';
                              return (
                                <td key={col.name} className="px-4 py-2 text-slate-300 border-r border-white/5 whitespace-nowrap group-hover:text-white">
                                  {isNull ? (
                                    <span className="text-amber-400/80 italic text-[11px]">null</span>
                                  ) : typeof val === 'number' ? (
                                    <span className="text-cyan-300 font-semibold">{val.toLocaleString()}</span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      )}

    </div>
  );
};

export default Datasets;
