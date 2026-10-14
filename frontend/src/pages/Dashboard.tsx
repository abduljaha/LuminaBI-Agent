import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowUp, Database, Sparkles, CheckCircle2, AlertCircle, 
  FileSpreadsheet, ChevronRight, BarChart2, Code2, Copy, Check,
  AlertTriangle, RefreshCw, Download, FileText, Bot, User, Clock,
  Terminal, Sliders, Zap, ArrowRight,
  ThumbsUp, ThumbsDown, Pencil, Play, Network, Share2,
  Mic, MicOff, Maximize2, Minimize2, BarChart3,
  Filter, Search, X, ChevronDown, CheckSquare, Square,
  Pin, TrendingUp
} from 'lucide-react';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
  LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, RadialBarChart, RadialBar, Treemap, Legend
} from 'recharts';

interface DatasetItem {
  id: number;
  name: string;
  file_type: string;
  is_cleaned?: boolean;
  quality_score?: number;
  schema_info?: {
    row_count?: number;
    column_count?: number;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  result?: any;
  follow_up_questions?: string[];
}

interface AgentStep {
  node: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  details?: any;
}

const Dashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickCleaning, setIsQuickCleaning] = useState(false);
  const [cleanToast, setCleanToast] = useState<string | null>(null);
  
  // Multi-turn chat message history
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Real-time Agent Streaming Steps
  const [activeSteps, setActiveSteps] = useState<AgentStep[]>([]);
  const [currentStepDesc, setCurrentStepDesc] = useState<string>("");
  
  // UI states
  const [activeResult, setActiveResult] = useState<any>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'markdown' | 'pdf' | null>(null);

  // Live SQL Editing States
  const [isEditingSql, setIsEditingSql] = useState<boolean>(false);
  const [editedSql, setEditedSql] = useState<string>("");
  const [isExecutingCustomSql, setIsExecutingCustomSql] = useState<boolean>(false);
  const [customSqlError, setCustomSqlError] = useState<string | null>(null);

  // Message Feedback & Toast
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // External Tools Integration: Power BI & MCP Modals
  const [showPowerBiModal, setShowPowerBiModal] = useState<boolean>(false);
  const [showMcpModal, setShowMcpModal] = useState<boolean>(false);
  const [copiedPowerBiUrl, setCopiedPowerBiUrl] = useState<boolean>(false);
  const [copiedMQuery, setCopiedMQuery] = useState<boolean>(false);
  const [copiedMcpConfig, setCopiedMcpConfig] = useState<boolean>(false);

  // Executive Board Pinning State
  const [isPinning, setIsPinning] = useState<boolean>(false);
  const [pinToast, setPinToast] = useState<string | null>(null);

  // Root-Cause Driver Decomposition Modal State
  const [showRootCauseModal, setShowRootCauseModal] = useState<boolean>(false);
  const [isLoadingRootCause, setIsLoadingRootCause] = useState<boolean>(false);
  const [rootCauseData, setRootCauseData] = useState<any>(null);
  const [rootCauseError, setRootCauseError] = useState<string | null>(null);

  // Predictive ML Forecasting Modal State
  const [showForecastModal, setShowForecastModal] = useState<boolean>(false);
  const [isLoadingForecast, setIsLoadingForecast] = useState<boolean>(false);
  const [forecastHorizon, setForecastHorizon] = useState<number>(30);
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // Feature: Interactive Multi-Chart Switcher & Pivot Controls supporting 20 BI visualization types
  const [chartTypeOverride, setChartTypeOverride] = useState<
    | 'bar'
    | 'horizontal_bar'
    | 'stacked_bar'
    | 'grouped_bar'
    | 'line'
    | 'step_line'
    | 'area'
    | 'stacked_area'
    | 'pie'
    | 'donut'
    | 'scatter'
    | 'bubble'
    | 'radar'
    | 'radial'
    | 'composed'
    | 'composed_area'
    | 'funnel'
    | 'treemap'
    | 'heatmap'
    | 'kpi_cards'
    | null
  >(null);
  const [xAxisOverride, setXAxisOverride] = useState<string>("");
  const [yAxisOverride, setYAxisOverride] = useState<string>("");
  const [chartWidthMode, setChartWidthMode] = useState<'wide' | 'split'>('wide');
  const [chartHeight, setChartHeight] = useState<number>(440);
  const [chartDataLimit, setChartDataLimit] = useState<number | 'all'>(20);

  // Feature: What-If Scenario Simulation Suite
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [simulationQuery, setSimulationQuery] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Voice Input Speech Recognition State
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Feature: Segment Intelligence Slice Inspector (Image 1 Requirement)
  const [hoveredSlice, setHoveredSlice] = useState<any>(null);

  // Feature: Power BI / Tableau Interactive Dashboard Slicers & Filters Suite
  const [selectedDimFilters, setSelectedDimFilters] = useState<Record<string, string[]>>({});
  const [metricRangeFilters, setMetricRangeFilters] = useState<Record<string, { min?: number; max?: number }>>({});
  const [filterSearchText, setFilterSearchText] = useState<string>("");
  const [openSlicerCol, setOpenSlicerCol] = useState<string | null>(null);
  const [slicerSearchTerm, setSlicerSearchTerm] = useState<string>("");
  const [suggestedFilter, setSuggestedFilter] = useState<{ col: string; val: string; count: number } | null>(null);
  const slicerPopoverRef = useRef<HTMLDivElement>(null);

  // Close slicer popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (slicerPopoverRef.current && !slicerPopoverRef.current.contains(e.target as Node)) {
        setOpenSlicerCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smart Query Filter Analyzer: Detects filters implied in user's question (e.g. State = 'Tamil Nadu')
  useEffect(() => {
    if (!activeResult?.query_result?.rows || !activeResult.query_result.columns) {
      setSuggestedFilter(null);
      return;
    }
    const rows = activeResult.query_result.rows;
    const cols = activeResult.query_result.columns;
    const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || query;
    const qLower = (lastUserMsg || '').toLowerCase();

    let foundSuggestion: { col: string; val: string; count: number } | null = null;
    for (const col of cols) {
      const valCounts: Record<string, number> = {};
      for (const r of rows) {
        const v = String(r[col] ?? '').trim();
        if (v && v !== 'null' && v !== 'undefined') {
          valCounts[v] = (valCounts[v] || 0) + 1;
        }
      }
      for (const [val, count] of Object.entries(valCounts)) {
        if (val.length >= 3 && qLower.includes(val.toLowerCase())) {
          // If not already filtered
          if (!selectedDimFilters[col]?.includes(val)) {
            foundSuggestion = { col, val, count };
            break;
          }
        }
      }
      if (foundSuggestion) break;
    }
    setSuggestedFilter(foundSuggestion);
  }, [activeResult, messages]);

  // Compute Filtered Dataset Rows (Real-Time Synchronized Slicing across Visuals & Data Extract)
  const filteredDatasetRows = useMemo(() => {
    if (!activeResult?.query_result?.rows) return [];
    let rows = activeResult.query_result.rows;

    // 1. Categorical Dimension Slicers
    for (const [col, selectedVals] of Object.entries(selectedDimFilters)) {
      if (selectedVals && selectedVals.length > 0) {
        rows = rows.filter((r: any) => selectedVals.includes(String(r[col])));
      }
    }

    // 2. Numeric Range Slicers
    for (const [col, range] of Object.entries(metricRangeFilters)) {
      if (range.min !== undefined && range.min !== null) {
        rows = rows.filter((r: any) => Number(r[col]) >= (range.min as number));
      }
      if (range.max !== undefined && range.max !== null) {
        rows = rows.filter((r: any) => Number(r[col]) <= (range.max as number));
      }
    }

    // 3. Global Text Search
    if (filterSearchText.trim()) {
      const q = filterSearchText.toLowerCase();
      rows = rows.filter((r: any) => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }

    return rows;
  }, [activeResult?.query_result?.rows, selectedDimFilters, metricRangeFilters, filterSearchText]);

  // Total active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    for (const vals of Object.values(selectedDimFilters)) {
      count += vals.length;
    }
    for (const range of Object.values(metricRangeFilters)) {
      if (range.min !== undefined || range.max !== undefined) count += 1;
    }
    if (filterSearchText.trim()) count += 1;
    return count;
  }, [selectedDimFilters, metricRangeFilters, filterSearchText]);

  const toggleDimFilter = (col: string, val: string) => {
    setSelectedDimFilters(prev => {
      const current = prev[col] || [];
      const updated = current.includes(val) 
        ? current.filter(v => v !== val)
        : [...current, val];
      return { ...prev, [col]: updated };
    });
  };

  const clearColFilters = (col: string) => {
    setSelectedDimFilters(prev => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
  };

  const selectAllColFilters = (col: string, allVals: string[]) => {
    setSelectedDimFilters(prev => ({
      ...prev,
      [col]: allVals
    }));
  };

  const clearAllFilters = () => {
    setSelectedDimFilters({});
    setMetricRangeFilters({});
    setFilterSearchText("");
    setOpenSlicerCol(null);
  };

  const applySuggestedFilter = () => {
    if (suggestedFilter) {
      setSelectedDimFilters(prev => ({
        ...prev,
        [suggestedFilter.col]: [...(prev[suggestedFilter.col] || []), suggestedFilter.val]
      }));
      setSuggestedFilter(null);
    }
  };
  
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const toggleVoiceRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Google Chrome or Microsoft Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((res: any) => res[0])
          .map((res: any) => res.transcript)
          .join('');
        setQuery(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition warning/error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition', e);
      setIsListening(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeSteps, activeResult]);

  const fetchDatasets = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/datasets/');
      setDatasets(res.data);
      if (res.data.length > 0) {
        const stateDatasetId = (location.state as any)?.selectedDatasetId;
        if (stateDatasetId && res.data.some((d: any) => d.id === stateDatasetId)) {
          setSelectedDataset(stateDatasetId.toString());
        } else {
          setSelectedDataset(res.data[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load datasets', err);
    }
  };

  const handleAsk = async (queryOverride?: string) => {
    const rawQuery = queryOverride !== undefined ? queryOverride : query;
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery || !selectedDataset || isLoading) return;

    const userMsgId = Date.now().toString();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmedQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setQuery("");
    setIsLoading(true);
    setActiveResult(null);
    setShowSql(false);

    // Initialize agent pipeline steps for visual tracker
    const initialPipeline: AgentStep[] = [
      { node: 'initialize', description: 'Inspecting dataset schema & metadata', status: 'active' },
      { node: 'generate_sql', description: 'Synthesizing SQLite query', status: 'pending' },
      { node: 'validate_sql', description: 'Validating SQL safety & rules', status: 'pending' },
      { node: 'execute_sql', description: 'Executing in memory SQLite sandbox', status: 'pending' },
      { node: 'python_analysis', description: 'Running Python & Pandas analysis', status: 'pending' },
      { node: 'detect_anomalies', description: 'Scanning for statistical outliers', status: 'pending' },
      { node: 'generate_visualization', description: 'Crafting chart specifications', status: 'pending' },
      { node: 'generate_insights', description: 'Synthesizing executive narrative', status: 'pending' },
      { node: 'review_answer', description: 'Critic agent verifying grounding', status: 'pending' }
    ];
    setActiveSteps(initialPipeline);
    setCurrentStepDesc("Inspecting dataset schema & metadata...");

    // Format chat history for context (exclude latest query, pass prior turns)
    const historyPayload = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      // Stream SSE events from backend /api/v1/analysis/stream
      const response = await fetch('http://localhost:8000/api/v1/analysis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: parseInt(selectedDataset, 10),
          query: trimmedQuery,
          history: historyPayload
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Normalize CRLF to LF
        const normalized = buffer.replace(/\r\n/g, '\n');
        const blocks = normalized.split('\n\n');
        // The last part is incomplete, retain in buffer
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const trimmedBlock = block.trim();
          if (!trimmedBlock) continue;

          let eventType = 'message';
          let eventData = '';

          const blockLines = trimmedBlock.split('\n');
          for (const line of blockLines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim();
            }
          }

          if (eventType === 'step' && eventData) {
            try {
              const stepInfo = JSON.parse(eventData);
              setCurrentStepDesc(stepInfo.description || `Processing ${stepInfo.node}...`);
              
              setActiveSteps(prev => {
                let foundCurrent = false;
                return prev.map(s => {
                  if (s.node === stepInfo.node) {
                    foundCurrent = true;
                    return { ...s, status: 'completed', details: stepInfo };
                  }
                  if (!foundCurrent && s.status === 'pending') {
                    return { ...s, status: 'active' };
                  }
                  return s;
                });
              });
            } catch (e) {
              console.error('Error parsing step event', e);
            }
          } else if (eventType === 'done' && eventData) {
            try {
              const finalData = JSON.parse(eventData);
              setActiveResult(finalData);
              
              // Mark all steps completed
              setActiveSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
              
              // Add Assistant response to conversation history
              const contentText = finalData.insights || (finalData.sql_errors?.length ? `Notice: ${finalData.sql_errors[0]}` : 'Analysis complete.');
              const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: contentText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                result: finalData,
                follow_up_questions: finalData.follow_up_questions || []
              };
              setMessages(prev => [...prev, assistantMsg]);
            } catch (e) {
              console.error('Error parsing done event', e);
            }
          } else if (eventType === 'error' && eventData) {
            const errObj = JSON.parse(eventData);
            throw new Error(errObj.error || 'Pipeline execution failed');
          }
        }
      }
    } catch (err: any) {
      console.error('Stream failure, attempting fallback invoke:', err);
      // Fallback to standard POST invocation if SSE fails
      try {
        const fallbackRes = await axios.post('http://localhost:8000/api/v1/analysis/', {
          dataset_id: parseInt(selectedDataset, 10),
          query: trimmedQuery,
          history: historyPayload
        });
        setActiveResult(fallbackRes.data);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: fallbackRes.data.insights || 'Analysis complete.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          result: fallbackRes.data,
          follow_up_questions: fallbackRes.data.follow_up_questions || []
        };
        setMessages(prev => [...prev, assistantMsg]);
      } catch (fallbackErr: any) {
        const errDetail = fallbackErr.response?.data?.detail || err.message || 'Analysis error occurred.';
        const errorResult = { sql_errors: [errDetail] };
        setActiveResult(errorResult);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Execution error: ${errDetail}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          result: errorResult
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => setActiveSteps([]), 4000);
    }
  };

  const handleExport = async (format: 'markdown' | 'pdf') => {
    if (!activeResult || !selectedDataset) return;
    setExportingFormat(format);

    try {
      const lastUserQuery = [...messages].reverse().find(m => m.role === 'user')?.content || "Dataset Analysis";
      const payload = {
        dataset_id: parseInt(selectedDataset, 10),
        query: lastUserQuery,
        insights: activeResult.insights || "No narrative insight recorded.",
        validated_sql: activeResult.validated_sql || "",
        query_result: activeResult.query_result || null,
        anomalies: activeResult.anomalies || [],
        confidence_score: activeResult.confidence_score || 0.0,
        reviewer_approved: activeResult.reviewer_approved ?? true,
        format: format
      };

      const res = await axios.post('http://localhost:8000/api/v1/analysis/export-report', payload, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'text/markdown'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `luminabi_report_${selectedDataset}.${format === 'pdf' ? 'pdf' : 'md'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate report export.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handlePinToBoard = async () => {
    if (!activeResult) return;
    setIsPinning(true);
    try {
      const dsObj = datasets.find(d => String(d.id) === String(selectedDataset));
      const activeChart = chartTypeOverride || (activeResult.chart_specs?.[0]?.chart_type) || 'bar';
      const lastUserQuery = [...messages].reverse().find(m => m.role === 'user')?.content || query || "Analysis Insight";
      
      await axios.post('http://localhost:8000/api/v1/board/', {
        board_name: 'Executive Cockpit',
        dataset_id: selectedDataset ? parseInt(selectedDataset, 10) : undefined,
        dataset_name: dsObj?.name || 'Dataset',
        title: lastUserQuery.length > 50 ? `${lastUserQuery.slice(0, 47)}...` : lastUserQuery,
        query: lastUserQuery,
        chart_type: activeChart,
        chart_specs: activeResult.chart_specs,
        query_result: activeResult.query_result,
        insights: activeResult.insights,
        card_width: 'col-span-1'
      });
      setPinToast('Pinned to Executive Board!');
      setTimeout(() => setPinToast(null), 3500);
    } catch (err) {
      setPinToast('Failed to pin to board');
      setTimeout(() => setPinToast(null), 3500);
    } finally {
      setIsPinning(false);
    }
  };

  const handleOpenRootCause = async () => {
    if (!selectedDataset) return;
    setShowRootCauseModal(true);
    setIsLoadingRootCause(true);
    setRootCauseError(null);
    try {
      const lastUserQuery = [...messages].reverse().find(m => m.role === 'user')?.content || query || "";
      const res = await axios.post('http://localhost:8000/api/v1/analysis/root-cause', {
        dataset_id: parseInt(selectedDataset, 10),
        query: lastUserQuery
      });
      setRootCauseData(res.data);
    } catch (err: any) {
      setRootCauseError(err.response?.data?.detail || 'Root-cause driver decomposition failed.');
    } finally {
      setIsLoadingRootCause(false);
    }
  };

  const handleOpenForecast = async (horizon = forecastHorizon) => {
    if (!selectedDataset) return;
    setShowForecastModal(true);
    setIsLoadingForecast(true);
    setForecastError(null);
    try {
      const res = await axios.post('http://localhost:8000/api/v1/analysis/forecast', {
        dataset_id: parseInt(selectedDataset, 10),
        horizon_days: horizon
      });
      setForecastData(res.data);
    } catch (err: any) {
      setForecastError(err.response?.data?.detail || 'Forecasting failed.');
    } finally {
      setIsLoadingForecast(false);
    }
  };


  const handleRunSimulation = async (simPrompt?: string) => {
    const targetQuery = simPrompt || simulationQuery;
    if (!targetQuery.trim() || !selectedDataset || isSimulating) return;

    setIsSimulating(true);
    setSimulationResult(null);

    try {
      const res = await axios.post('http://localhost:8000/api/v1/analysis/simulate', {
        dataset_id: parseInt(selectedDataset, 10),
        query: targetQuery
      });
      setSimulationResult(res.data);
    } catch (err: any) {
      console.error('Simulation failed:', err);
      alert(err.response?.data?.detail || 'Failed to compute scenario simulation.');
    } finally {
      setIsSimulating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const currentDataset = datasets.find(d => d.id.toString() === selectedDataset);

  const handleQuickClean = async () => {
    if (!currentDataset) return;
    setIsQuickCleaning(true);
    try {
      const res = await axios.post(`http://localhost:8000/api/v1/datasets/${currentDataset.id}/clean`);
      setDatasets(prev => prev.map(d => d.id === currentDataset.id ? { ...d, is_cleaned: true, quality_score: res.data.quality_score } : d));
      await fetchDatasets();
      setCleanToast(`Dataset cleaned successfully! (${res.data.changelog?.length || 0} issues resolved. Quality Score: ${res.data.quality_score}/100)`);
      setTimeout(() => setCleanToast(null), 6000);
    } catch (err: any) {
      console.error('Failed to auto-clean dataset', err);
      alert(err.response?.data?.detail || 'Failed to auto-clean dataset');
    } finally {
      setIsQuickCleaning(false);
    }
  };

  const handleRunEditedSql = async () => {
    if (!editedSql.trim() || !selectedDataset) return;
    setIsExecutingCustomSql(true);
    setCustomSqlError(null);
    try {
      const res = await axios.post('http://localhost:8000/api/v1/analysis/execute-sql', {
        dataset_id: parseInt(selectedDataset, 10),
        sql_query: editedSql.trim()
      });
      
      // Update activeResult
      setActiveResult((prev: any) => ({
        ...(prev || {}),
        validated_sql: editedSql.trim(),
        generated_sql: editedSql.trim(),
        query_result: res.data.query_result,
        chart_specs: res.data.chart_specs?.length ? res.data.chart_specs : prev?.chart_specs,
        insights: res.data.insights
      }));

      // Update in message history as well
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === 'assistant' && updated[i].result) {
            updated[i].result = {
              ...updated[i].result,
              validated_sql: editedSql.trim(),
              query_result: res.data.query_result,
              chart_specs: res.data.chart_specs?.length ? res.data.chart_specs : updated[i].result.chart_specs,
              insights: res.data.insights
            };
            break;
          }
        }
        return updated;
      });

      setIsEditingSql(false);
    } catch (err: any) {
      console.error('Failed to execute custom SQL', err);
      setCustomSqlError(err.response?.data?.detail || 'Failed to execute custom SQL.');
    } finally {
      setIsExecutingCustomSql(false);
    }
  };

  const handleEditUserQuery = (text: string) => {
    setQuery(text);
    const inputEl = document.querySelector('input[placeholder*="Ask any data analysis"]') as HTMLInputElement;
    if (inputEl) {
      inputEl.focus();
      inputEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFeedback = (msgId: string, type: 'up' | 'down') => {
    setMessageFeedback(prev => ({ ...prev, [msgId]: type }));
    setFeedbackToast(type === 'up' ? 'Helpful response recorded! Thanks for the feedback.' : 'Feedback noted. Try editing the question or custom SQL.');
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

  const renderChart = (spec: any, data: any[]) => {
    const axisStyle = { fontSize: 11, fill: '#94a3b8' };
    const effectiveType = chartTypeOverride || spec.chart_type || 'bar';
    const effectiveX = xAxisOverride || spec.x_axis;
    const effectiveY = yAxisOverride || spec.y_axis;

    if (!data || data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-xs">
          <BarChart2 className="w-8 h-8 text-slate-600 mb-2" />
          <span>No rows found in this dataset extract.</span>
        </div>
      );
    }

    const totalSum = data.reduce((acc, d) => acc + (Number(d[effectiveY]) || 0), 0) || 1;
    const avgVal = totalSum / (data.length || 1);
    const sortedFullData = [...data].sort((a, b) => (Number(b[effectiveY]) || 0) - (Number(a[effectiveY]) || 0));

    // Top-N Slicing for optimal rendering
    const isFiltered = chartDataLimit !== 'all' && data.length > (chartDataLimit as number);
    const displayData = isFiltered ? sortedFullData.slice(0, chartDataLimit as number) : data;
    const isManyItems = displayData.length > 7;

    const allNumericCols = (activeResult?.query_result?.columns || []).filter((col: string) => {
      return col !== effectiveX && data.some(d => !isNaN(Number(d[col])) && d[col] !== null && d[col] !== '');
    });
    const otherNumericCols = allNumericCols.filter((c: string) => c !== effectiveY);

    const CustomChartTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const item = payload[0].payload || {};
        const itemName = item[effectiveX] || label || payload[0].name || 'Segment';
        const itemVal = Number(payload[0].value || item[effectiveY] || 0);
        const itemPct = ((itemVal / totalSum) * 100).toFixed(1);
        const itemDelta = (((itemVal - avgVal) / (avgVal || 1)) * 100).toFixed(0);

        return (
          <div className="bg-slate-950/95 backdrop-blur-xl border border-indigo-500/40 p-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] max-w-xs space-y-1.5 text-xs text-white pointer-events-none animate-fade-in z-50">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="font-bold text-white text-sm flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                {itemName}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                {itemPct}% Volume
              </span>
            </div>
            <div className="text-cyan-300 font-mono text-sm font-bold">
              {effectiveY}: {itemVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-300 leading-snug">
              • {itemName} accounts for {itemPct}% of volume ({Number(itemDelta) >= 0 ? '+' : ''}{itemDelta}% vs avg).
            </div>
            <div className="text-[11px] text-indigo-200/90 leading-snug italic">
              • Strategic Insight: Peak driver; prioritize resource allocation for this segment.
            </div>
          </div>
        );
      }
      return null;
    };

    // 1. VERTICAL BAR CHART (COLUMN)
    if (effectiveType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <defs>
              <linearGradient id="vBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#4338ca" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} content={<CustomChartTooltip />} />
            <Bar 
              dataKey={effectiveY} 
              fill="url(#vBarGrad)" 
              radius={[8, 8, 0, 0]} 
              maxBarSize={isManyItems ? 45 : 65}
              onMouseEnter={(entry: any) => setHoveredSlice(entry.payload || entry)}
              onClick={(entry: any) => setHoveredSlice(entry.payload || entry)}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    } 
    
    // 2. HORIZONTAL BAR CHART (Perfect for long labels like states or categories!)
    else if (effectiveType === 'horizontal_bar') {
      return (
        <div className="w-full overflow-y-auto custom-scrollbar" style={{ maxHeight: Math.max(chartHeight, 460) }}>
          <ResponsiveContainer width="100%" height={Math.max(chartHeight, displayData.length * 34 + 60)}>
            <BarChart layout="vertical" data={displayData} margin={{ top: 15, right: 30, left: 25, bottom: 15 }}>
              <defs>
                <linearGradient id="hBarGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis dataKey={effectiveX} type="category" width={150} tick={{ fontSize: 11, fill: '#cbd5e1' }} axisLine={false} tickLine={false} interval={0} />
              <RechartsTooltip cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} content={<CustomChartTooltip />} />
              <Bar 
                dataKey={effectiveY} 
                fill="url(#hBarGrad)" 
                radius={[0, 8, 8, 0]} 
                maxBarSize={28}
                onMouseEnter={(entry: any) => setHoveredSlice(entry.payload || entry)}
                onClick={(entry: any) => setHoveredSlice(entry.payload || entry)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // 3. STACKED BAR CHART
    else if (effectiveType === 'stacked_bar') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} content={<CustomChartTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey={effectiveY} stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} maxBarSize={55} />
            {otherNumericCols.slice(0, 2).map((col: string, idx: number) => (
              <Bar key={col} dataKey={col} stackId="a" fill={COLORS[(idx + 1) % COLORS.length]} radius={idx === Math.min(1, otherNumericCols.length - 1) ? [8, 8, 0, 0] : [0, 0, 0, 0]} maxBarSize={55} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // 4. GROUPED MULTI-BAR CHART
    else if (effectiveType === 'grouped_bar') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey={effectiveY} fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={38} />
            {otherNumericCols.slice(0, 2).map((col: string, idx: number) => (
              <Bar key={col} dataKey={col} fill={COLORS[(idx + 1) % COLORS.length]} radius={[6, 6, 0, 0]} maxBarSize={38} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // 5. SMOOTH LINE CHART (TRENDS)
    else if (effectiveType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Line 
              type="monotone" 
              dataKey={effectiveY} 
              stroke="#6366f1" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }} 
              activeDot={{ r: 8, fill: '#c7d2fe', stroke: '#6366f1', strokeWidth: 2 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // 6. STEP LINE CHART (DISCRETE INTERVALS)
    else if (effectiveType === 'step_line') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Line 
              type="stepAfter" 
              dataKey={effectiveY} 
              stroke="#06b6d4" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#22d3ee' }} 
              activeDot={{ r: 7, fill: '#67e8f9' }} 
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // 7. GRADIENT AREA CHART (VOLUME)
    else if (effectiveType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Area 
              type="monotone" 
              dataKey={effectiveY} 
              stroke="#06b6d4" 
              strokeWidth={3} 
              fill="url(#areaGradient)" 
              activeDot={{ r: 7, fill: '#38bdf8' }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // 8. STACKED AREA CHART (CUMULATIVE)
    else if (effectiveType === 'stacked_area') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <defs>
              <linearGradient id="stAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Area type="monotone" dataKey={effectiveY} stackId="1" stroke="#8b5cf6" strokeWidth={3} fill="url(#stAreaGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // 9. CLASSIC PIE CHART
    else if (effectiveType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart>
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Pie
              data={displayData.slice(0, 10)}
              dataKey={effectiveY}
              nameKey={effectiveX}
              cx="50%"
              cy="50%"
              outerRadius={Math.min(chartHeight / 2.6, 140)}
              paddingAngle={3}
              label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
              onMouseEnter={(entry: any) => setHoveredSlice(entry)}
              onClick={(entry: any) => setHoveredSlice(entry)}
            >
              {displayData.slice(0, 10).map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // 10. DONUT / RING CHART WITH CENTER HERO METRIC
    else if (effectiveType === 'donut') {
      return (
        <div className="relative w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <RechartsTooltip content={<CustomChartTooltip />} />
              <Pie
                data={displayData.slice(0, 10)}
                dataKey={effectiveY}
                nameKey={effectiveX}
                cx="50%"
                cy="50%"
                innerRadius={Math.min(chartHeight / 3.4, 90)}
                outerRadius={Math.min(chartHeight / 2.5, 145)}
                paddingAngle={4}
                onMouseEnter={(entry: any) => setHoveredSlice(entry)}
                onClick={(entry: any) => setHoveredSlice(entry)}
              >
                {displayData.slice(0, 10).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total Aggregate</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono mt-0.5">
              {totalSum.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
            <span className="text-[10px] text-indigo-300 font-mono">{effectiveY}</span>
          </div>
        </div>
      );
    }

    // 11. SCATTER PLOT (DISTRIBUTION)
    else if (effectiveType === 'scatter') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ScatterChart margin={{ top: 20, right: 15, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} name={effectiveX} tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
            <YAxis dataKey={effectiveY} name={effectiveY} tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Scatter name="Data Distribution" data={displayData} fill="#818cf8" />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // 12. BUBBLE DISTRIBUTION CHART
    else if (effectiveType === 'bubble') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ScatterChart margin={{ top: 20, right: 15, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} name={effectiveX} tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
            <YAxis dataKey={effectiveY} name={effectiveY} tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Scatter name="Bubble Volume" data={displayData}>
              {displayData.map((entry, index) => {
                const val = Number(entry[effectiveY]) || 0;
                const size = Math.max(7, Math.min(24, (val / (avgVal || 1)) * 12));
                return <Cell key={`bubble-${index}`} fill={COLORS[index % COLORS.length]} r={size} fillOpacity={0.75} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // 13. RADAR / SPIDER CHART (METRICS)
    else if (effectiveType === 'radar') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <RadarChart outerRadius={Math.min(chartHeight / 2.8, 140)} data={displayData.slice(0, 12)}>
            <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
            <PolarAngleAxis dataKey={effectiveX} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} stroke="rgba(255, 255, 255, 0.15)" />
            <Radar name={effectiveY} dataKey={effectiveY} stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.5} />
            <RechartsTooltip content={<CustomChartTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    // 14. RADIAL BAR (CIRCULAR GAUGES)
    else if (effectiveType === 'radial') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" barSize={16} data={displayData.slice(0, 8)}>
            <RadialBar background dataKey={effectiveY} cornerRadius={10}>
              {displayData.slice(0, 8).map((_, index) => (
                <Cell key={`radial-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </RadialBar>
            <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
            <RechartsTooltip content={<CustomChartTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
      );
    }

    // 15. COMPOSED (BAR + LINE)
    else if (effectiveType === 'composed') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Bar dataKey={effectiveY} fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={45} />
            <Line type="monotone" dataKey={effectiveY} stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#06b6d4' }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // 16. COMPOSED (AREA + LINE)
    else if (effectiveType === 'composed_area') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart data={displayData} margin={{ top: 20, right: 15, left: -10, bottom: isManyItems ? 55 : 20 }}>
            <defs>
              <linearGradient id="compAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey={effectiveX} tick={axisStyle} angle={isManyItems ? -35 : 0} textAnchor={isManyItems ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} dy={isManyItems ? 8 : 10} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomChartTooltip />} />
            <Area type="monotone" dataKey={effectiveY} fill="url(#compAreaGrad)" stroke="none" />
            <Line type="monotone" dataKey={effectiveY} stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: '#f472b6' }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // 17. FUNNEL PIPELINE CHART
    else if (effectiveType === 'funnel') {
      const funnelItems = displayData.slice(0, 8);
      const maxFunnelVal = Math.max(...funnelItems.map(d => Number(d[effectiveY]) || 0), 1);

      return (
        <div className="w-full flex flex-col justify-center space-y-3 px-4 py-3" style={{ minHeight: chartHeight }}>
          <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center justify-between">
            <span>Stage / Segment Pipeline Progression</span>
            <span>Relative Conversion %</span>
          </div>
          {funnelItems.map((item, idx) => {
            const val = Number(item[effectiveY]) || 0;
            const pctOfMax = ((val / maxFunnelVal) * 100).toFixed(0);
            const pctOfTotal = ((val / totalSum) * 100).toFixed(1);
            return (
              <div 
                key={idx}
                onClick={() => setHoveredSlice(item)}
                className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-[10px] font-mono">
                      {idx + 1}
                    </span>
                    {item[effectiveX]}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-cyan-300 font-bold">{val.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">({pctOfTotal}%)</span>
                  </div>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${pctOfMax}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // 18. TREEMAP HIERARCHY TILES
    else if (effectiveType === 'treemap') {
      const treemapItems = displayData.slice(0, 18).map((d: any) => ({
        name: d[effectiveX] || 'Segment',
        size: Math.max(1, Number(d[effectiveY]) || 0),
      }));

      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <Treemap
            data={treemapItems}
            dataKey="size"
            stroke="#0f172a"
            fill="#6366f1"
            isAnimationActive
          >
            <RechartsTooltip content={<CustomChartTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      );
    }

    // 19. METRIC HEATMAP INTENSITY GRID
    else if (effectiveType === 'heatmap') {
      const maxVal = Math.max(...displayData.map(d => Number(d[effectiveY]) || 0), 1);
      return (
        <div className="w-full p-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: chartHeight + 40 }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {displayData.map((item, idx) => {
              const val = Number(item[effectiveY]) || 0;
              const intensityRatio = Math.max(0.12, val / maxVal);
              const pctOfTotal = ((val / totalSum) * 100).toFixed(1);

              return (
                <div
                  key={idx}
                  onClick={() => setHoveredSlice(item)}
                  className="p-3.5 rounded-2xl border border-white/10 hover:border-cyan-400 transition-all cursor-pointer flex flex-col justify-between shadow-lg"
                  style={{
                    backgroundColor: `rgba(99, 102, 241, ${0.15 + intensityRatio * 0.45})`,
                    boxShadow: `0 4px 20px rgba(6, 182, 212, ${intensityRatio * 0.25})`
                  }}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <span className="font-mono text-[10px] text-cyan-300 font-bold">#{idx + 1}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] font-mono text-slate-300">{pctOfTotal}%</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate" title={String(item[effectiveX])}>
                    {item[effectiveX]}
                  </div>
                  <div className="text-sm font-black text-cyan-300 font-mono mt-1">
                    {val.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 20. EXECUTIVE KPI STAT MATRIX
    else {
      const topItem = sortedFullData[0] || {};
      const minItem = sortedFullData[sortedFullData.length - 1] || {};
      const topVal = Number(topItem[effectiveY]) || 0;
      const minVal = Number(minItem[effectiveY]) || 0;

      return (
        <div className="w-full flex flex-col justify-between space-y-4 p-2" style={{ minHeight: chartHeight }}>
          {/* Top 4 KPI Metric Hero Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Top Segment</span>
              <div className="text-sm font-black text-white truncate mt-1">{topItem[effectiveX] || 'Peak'}</div>
              <div className="text-lg font-black text-indigo-300 font-mono mt-0.5">{topVal.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400 font-mono">{((topVal / totalSum) * 100).toFixed(1)}% of total</span>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider">Total Volume</span>
              <div className="text-sm font-black text-white truncate mt-1">Aggregate Sum</div>
              <div className="text-lg font-black text-cyan-300 font-mono mt-0.5">{totalSum.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400 font-mono">{data.length} records</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Average Benchmark</span>
              <div className="text-sm font-black text-white truncate mt-1">Mean / Segment</div>
              <div className="text-lg font-black text-emerald-300 font-mono mt-0.5">{avgVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
              <span className="text-[10px] text-slate-400 font-mono">Dataset baseline</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Base Floor</span>
              <div className="text-sm font-black text-white truncate mt-1">{minItem[effectiveX] || 'Lowest'}</div>
              <div className="text-lg font-black text-amber-300 font-mono mt-0.5">{minVal.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400 font-mono">Minimum recorded</span>
            </div>
          </div>

          {/* Ranked Progress Breakdown of Top 6 Segments */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="text-xs font-semibold text-slate-400">Volume Concentration Leaders</span>
            {displayData.slice(0, 6).map((item, idx) => {
              const val = Number(item[effectiveY]) || 0;
              const pct = ((val / totalSum) * 100).toFixed(1);
              return (
                <div key={idx} onClick={() => setHoveredSlice(item)} className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 cursor-pointer">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-white">{idx + 1}. {item[effectiveX]}</span>
                    <span className="font-mono text-cyan-300 font-bold">{val.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${Math.min(100, Math.max(5, (val / topVal) * 100))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-48 animate-fade-in space-y-6">
      
      {/* Top Glass Control Bar */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col sm:row items-start sm:items-center justify-between gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Active Dataset Context</h2>
              {currentDataset && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {currentDataset.file_type.toUpperCase()} • {currentDataset.schema_info?.row_count || 10} rows
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">Queries maintain multi-turn conversational context</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Mode Switcher: Standard Analysis vs What-If Simulator */}
          <button
            onClick={() => setIsSimulationMode(!isSimulationMode)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isSimulationMode
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'glass-panel hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Toggle Predictive Scenario Simulator"
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulationMode ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            <span>{isSimulationMode ? 'What-If Mode Active' : 'What-If Simulator'}</span>
          </button>

          {/* Power BI Integration Button */}
          <button
            onClick={() => setShowPowerBiModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all shadow-[0_0_12px_rgba(245,158,11,0.2)]"
            title="Connect dataset live to Power BI Desktop"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Power BI</span>
          </button>

          {/* MCP Tools Integration Button */}
          <button
            onClick={() => setShowMcpModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
            title="Model Context Protocol (MCP) external tool integration"
          >
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">MCP Tools</span>
          </button>

          <div className="relative flex-1 sm:w-64">
            <select 
              className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 outline-none focus:border-indigo-400 cursor-pointer appearance-none pr-8"
              value={selectedDataset}
              onChange={(e) => {
                setSelectedDataset(e.target.value);
                setMessages([]);
                setActiveResult(null);
                setSimulationResult(null);
              }}
            >
              {datasets.length === 0 && <option value="">No datasets available</option>}
              {datasets.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                  {d.name} (#{d.id})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
              ▼
            </div>
          </div>

          <button
            onClick={() => { setMessages([]); setActiveResult(null); setQuery(''); setSimulationResult(null); }}
            title="Clear Chat Conversation"
            className="p-2.5 rounded-xl glass-panel hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dataset Hygiene Health Banner */}
      {currentDataset && (
        (() => {
          const score = currentDataset.quality_score ?? 100;
          const isClean = currentDataset.is_cleaned || score >= 90;

          if (!isClean) {
            return (
              <div className="glass-panel rounded-2xl p-4 border border-amber-500/30 bg-amber-950/20 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_10px_25px_rgba(245,158,11,0.15)] animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Unprocessed / Raw Dataset Detected</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Hygiene Score: {score}/100
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      This primary dataset contains anomalies (missing values, bad types, duplicates, or outliers). Clean now to ensure accurate SQL aggregations and insights.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => navigate('/datasets')}
                    className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all"
                  >
                    Inspect EDA
                  </button>
                  <button
                    onClick={handleQuickClean}
                    disabled={isQuickCleaning}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-xs font-bold text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isQuickCleaning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{isQuickCleaning ? 'Cleaning Dataset...' : '1-Click Auto-Clean'}</span>
                  </button>
                </div>
              </div>
            );
          } else {
            return (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">Dataset Verified Clean & Analysis-Ready</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200">
                    Quality Score: {score}/100
                  </span>
                </div>
                <button
                  onClick={() => navigate('/datasets')}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>View Quality Specs</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            );
          }
        })()
      )}

      {/* Clean Success Toast */}
      {cleanToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{cleanToast}</span>
        </div>
      )}

      {/* Feature: What-If Scenario Simulation Suite Panel */}
      {isSimulationMode && (
        <div className="w-full max-w-5xl mx-auto glass-panel rounded-3xl p-6 border border-amber-500/30 bg-amber-950/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5 fill-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Predictive Scenario Simulation Engine</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                    WHAT-IF MODELING
                  </span>
                </h3>
                <p className="text-xs text-amber-200/80">Simulate market variations, rate changes, or volume shifts and model executive impact</p>
              </div>
            </div>
          </div>

          {/* Preset Simulation Scenarios */}
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-2">Preset Scenario Hypotheses:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                "What if revenue drops by 15% across all categories?",
                "Simulate a 20% increase in prices or charges",
                "What if discount rates increase by 10%?"
              ].map((simText, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSimulationQuery(simText);
                    handleRunSimulation(simText);
                  }}
                  className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center justify-between group"
                >
                  <span className="line-clamp-2">"{simText}"</span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 shrink-0 ml-1 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* Simulation Input Field */}
          <div className="flex gap-2">
            <input
              type="text"
              value={simulationQuery}
              onChange={(e) => setSimulationQuery(e.target.value)}
              placeholder="E.g. What if monthly charges decrease by 12% in month-to-month contracts?"
              onKeyDown={(e) => e.key === 'Enter' && handleRunSimulation()}
              className="flex-1 bg-slate-900/90 border border-white/15 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-amber-400"
            />
            <button
              onClick={() => handleRunSimulation()}
              disabled={isSimulating || !simulationQuery.trim()}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-white font-semibold text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 disabled:opacity-40 transition-all"
            >
              {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>{isSimulating ? 'Simulating...' : 'Run Simulation'}</span>
            </button>
          </div>

          {/* Simulation Result Impact View */}
          {simulationResult && (
            <div className="space-y-5 pt-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Baseline Total</span>
                  <div className="text-2xl font-extrabold text-white">
                    ${Number(simulationResult.baseline_total).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block mb-1">Simulated Projection</span>
                  <div className="text-2xl font-extrabold text-amber-200">
                    ${Number(simulationResult.simulated_total).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-center">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Net Variance / Delta</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold font-mono ${simulationResult.delta_total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {simulationResult.delta_total >= 0 ? '+' : ''}${Number(simulationResult.delta_total).toLocaleString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      simulationResult.delta_pct >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                    }`}>
                      {simulationResult.delta_pct >= 0 ? '+' : ''}{simulationResult.delta_pct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Segment Breakdown & Comparison */}
              {simulationResult.breakdown?.length > 0 && (
                <div className="glass-panel rounded-2xl p-5 border border-white/10">
                  <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-amber-400" />
                    <span>Segment Impact Comparison</span>
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={simulationResult.breakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                        <XAxis dataKey="segment" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <Bar dataKey="baseline" name="Baseline" fill="#64748b" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="simulated" name="Simulated" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Executive Strategic Narrative */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Strategic Advisor Recommendations
                </div>
                <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {typeof simulationResult.executive_narrative === 'string'
                    ? simulationResult.executive_narrative
                    : Array.isArray(simulationResult.executive_narrative)
                    ? simulationResult.executive_narrative
                        .map((x: any) => (typeof x === 'string' ? x : x?.text || JSON.stringify(x)))
                        .join('\n')
                    : simulationResult.executive_narrative?.text ||
                      simulationResult.executive_narrative?.content ||
                      (simulationResult.executive_narrative ? JSON.stringify(simulationResult.executive_narrative, null, 2) : '')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center w-full max-w-5xl mx-auto space-y-6">
        
        {/* Welcome Hero when chat history is empty */}
        {messages.length === 0 && !isLoading && (
          <div className="w-full max-w-3xl mt-6 sm:mt-10 text-center space-y-6">
            <div className="relative inline-block">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600/30 via-purple-600/30 to-cyan-400/20 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-[0_0_35px_rgba(99,102,241,0.3)] backdrop-blur-xl">
                <Sparkles className="w-10 h-10 text-indigo-400" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                What would you like to analyze?
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Ask in natural language. Multi-turn chat enables seamless follow-ups, with live SSE agent tracing and PDF/Markdown report export.
              </p>
            </div>

            {/* Quick Starter Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left pt-2">
              {[
                { title: "Top Customer Analysis", q: "Who are the top 5 customers with the most orders?" },
                { title: "Most Popular Products", q: "What are the top 5 most frequently ordered products?" },
                { title: "Anomaly Detection", q: "Are there any unusual transactions or anomalies in the dataset?" },
                { title: "Line Items Distribution", q: "What is the average and maximum number of line items per order?" }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAsk(item.q)}
                  className="glass-panel glass-panel-hover rounded-2xl p-4.5 text-left group border border-white/10 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                      {item.title}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-slate-300 font-medium line-clamp-2">
                    "{item.q}"
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Turn Conversation Thread */}
        {messages.length > 0 && (
          <div className="w-full space-y-5" ref={chatScrollRef}>
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-indigo-400" />
                  </div>
                )}

                <div className={`max-w-3xl ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600/90 to-indigo-700/90 text-white rounded-2xl rounded-tr-sm px-4.5 py-3 shadow-[0_10px_25px_rgba(99,102,241,0.25)] border border-indigo-400/20'
                    : 'glass-panel rounded-2xl rounded-tl-sm p-4 text-slate-200 border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)] w-full'
                }`}>
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[11px] font-semibold text-indigo-200/80">
                      {msg.role === 'user' ? 'You' : 'Data Analyst Agent'}
                    </span>
                    <div className="flex items-center gap-2">
                      {msg.role === 'user' && (
                        <button
                          onClick={() => handleEditUserQuery(msg.content)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-all border border-white/15 cursor-pointer"
                          title="Edit this question and modify query"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>

                  {msg.role === 'user' ? (
                    <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
                        {msg.content}
                      </div>

                      {msg.result?.validated_sql && (
                        <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setActiveResult(msg.result);
                              setShowSql(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer"
                          >
                            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Inspect SQL</span>
                          </button>

                          {msg.result.reviewer_approved !== undefined && (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              msg.result.reviewer_approved
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}>
                              {msg.result.reviewer_approved ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {msg.result.reviewer_approved ? 'Verified Grounded' : 'Flagged'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Suggested Follow-up Inquiries */}
                      {((msg.result?.follow_up_questions && msg.result.follow_up_questions.length > 0) || (msg.result?.query_result?.columns?.length > 1)) && (
                        <div className="pt-2.5 mt-2 border-t border-white/5 space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Suggested Follow-up Questions:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(msg.result?.follow_up_questions?.length ? msg.result.follow_up_questions : [
                              `Break this down by product category or segment`,
                              `What are the top 3 highest contributing elements?`,
                              `Are there any statistical anomalies in this distribution?`
                            ]).map((fq: string, qIdx: number) => (
                              <button
                                key={qIdx}
                                onClick={() => handleAsk(fq)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-400/40 text-xs text-slate-300 hover:text-white transition-all group cursor-pointer text-left"
                              >
                                <span>"{fq}"</span>
                                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message Feedback & Regenerate Action Bar */}
                      <div className="pt-3 mt-1 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleFeedback(msg.id, 'up')}
                            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs cursor-pointer ${
                              messageFeedback[msg.id] === 'up'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'text-slate-400 hover:text-white border-white/5 hover:bg-white/5'
                            }`}
                            title="Helpful Analysis (Thumbs Up)"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, 'down')}
                            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs cursor-pointer ${
                              messageFeedback[msg.id] === 'down'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                                : 'text-slate-400 hover:text-white border-white/5 hover:bg-white/5'
                            }`}
                            title="Needs Improvement (Thumbs Down)"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                              if (lastUserMsg) {
                                handleAsk(lastUserMsg.content);
                              }
                            }}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg border border-white/5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
                            title="Regenerate this answer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
                          </button>
                        </div>

                        {messageFeedback[msg.id] && (
                          <span className="text-[10px] text-slate-400 italic">
                            {messageFeedback[msg.id] === 'up' ? 'Helpful answer noted' : 'Feedback recorded'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Real-Time Agent Streaming Step Tracker */}
        {isLoading && (
          <div className="w-full max-w-4xl space-y-4 animate-fade-in">
            <div className="glass-panel rounded-3xl p-6 border border-indigo-500/30 bg-indigo-950/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>LangGraph Multi-Agent Reasoning</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                        LIVE SSE STREAM
                      </span>
                    </h3>
                    <p className="text-xs text-indigo-200/80">{currentStepDesc || 'Agents collaborating...'}</p>
                  </div>
                </div>
              </div>

              {/* Step Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {activeSteps.map((s, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border transition-all ${
                      s.status === 'completed'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : s.status === 'active'
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse'
                        : 'bg-white/[0.02] border-white/5 text-slate-500'
                    }`}
                  >
                    {s.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : s.status === 'active' ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping shrink-0" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" />
                    )}
                    <span className="truncate font-medium">{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Latest Active Result Dashboard & Visualizations */}
        {activeResult && (
          <div className="w-full space-y-6">
            
            {/* Top Toolbar: Export Reports & QA Status */}
            <div className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-400">Analysis Actions:</span>
                
                {/* Export Markdown Button */}
                <button
                  onClick={() => handleExport('markdown')}
                  disabled={exportingFormat !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 hover:text-white transition-all disabled:opacity-50"
                  title="Download Markdown Report"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{exportingFormat === 'markdown' ? 'Exporting...' : 'Export Markdown'}</span>
                </button>

                {/* Export PDF Button */}
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exportingFormat !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-all disabled:opacity-50"
                  title="Download Formatted PDF Report"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{exportingFormat === 'pdf' ? 'Generating PDF...' : 'Download PDF Report'}</span>
                </button>

                {/* Pin to Executive Board Button */}
                <button
                  onClick={handlePinToBoard}
                  disabled={isPinning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-medium text-purple-300 hover:text-purple-200 transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                  title="Pin this chart and insight to your persistent Executive Board"
                >
                  <Pin className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isPinning ? 'Pinning...' : 'Pin to Board'}</span>
                </button>

                {/* Root Cause Analysis Button */}
                <button
                  onClick={handleOpenRootCause}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  title="Perform automated Root-Cause Variance Driver Decomposition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Why Did This Happen?</span>
                </button>

                {/* Predictive Forecast Button */}
                <button
                  onClick={() => handleOpenForecast()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  title="Predict future trajectory with 80% & 95% confidence bands"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Predictive Forecast</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {activeResult.reviewer_approved !== undefined && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    activeResult.reviewer_approved
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}>
                    {activeResult.reviewer_approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    <span>{activeResult.reviewer_approved ? 'Critic Approved' : 'Flagged by Critic'}</span>
                    {activeResult.confidence_score !== undefined && (
                      <span className="font-mono text-[10px] opacity-75">
                        ({intToPercent(activeResult.confidence_score)}%)
                      </span>
                    )}
                  </span>
                )}

                {activeResult.validated_sql && (
                  <button
                    onClick={() => setShowSql(!showSql)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all"
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{showSql ? 'Hide SQL' : 'View SQL'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Validated SQL Inspector with Live Modification & Run */}
            {showSql && activeResult.validated_sql && (
              <div className="rounded-2xl bg-slate-950/90 border border-white/10 p-4 font-mono text-xs text-slate-300 relative animate-fade-in shadow-2xl space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-white/5">
                  <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                    <Terminal className="w-3.5 h-3.5" />
                    SYNTHESIZED SQLITE QUERY
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsEditingSql(!isEditingSql);
                        if (!isEditingSql) {
                          setEditedSql(activeResult.validated_sql);
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isEditingSql 
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]' 
                          : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/10'
                      }`}
                      title="Edit this SQL query"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>{isEditingSql ? 'Editing SQL' : 'Edit SQL'}</span>
                    </button>
                    <button
                      onClick={() => copyToClipboard(isEditingSql ? editedSql : activeResult.validated_sql)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {isEditingSql ? (
                  <div className="space-y-3 pt-1">
                    <textarea
                      value={editedSql}
                      onChange={(e) => setEditedSql(e.target.value)}
                      className="w-full bg-slate-900 border border-indigo-500/40 rounded-xl p-3 text-xs sm:text-sm font-mono text-cyan-300 outline-none focus:border-indigo-400 min-h-[95px] leading-relaxed resize-y custom-scrollbar"
                      placeholder="Modify SQLite query..."
                    />
                    {customSqlError && (
                      <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{customSqlError}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsEditingSql(false);
                          setCustomSqlError(null);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRunEditedSql}
                        disabled={isExecutingCustomSql || !editedSql.trim()}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 text-white text-xs font-semibold shadow-[0_0_15px_rgba(99,102,241,0.4)] flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {isExecutingCustomSql ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isExecutingCustomSql ? 'Executing...' : 'Run Custom SQL'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <code className="text-cyan-300 block overflow-x-auto whitespace-pre leading-relaxed">
                    {activeResult.validated_sql}
                  </code>
                )}
              </div>
            )}

            {/* Statistical Anomalies Banner if any */}
            {activeResult.anomalies?.length > 0 && (
              <div className="p-4.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm">
                <div className="flex items-center gap-2 font-bold mb-2 text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{activeResult.anomalies.length} Statistical Anomaly Detected</span>
                </div>
                <div className="space-y-1 font-mono text-xs text-amber-200/90">
                  {activeResult.anomalies.map((an: any, idx: number) => (
                    <div key={idx}>• Column {an.column}: value {an.value} ({an.reason || 'Out of standard range'})</div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts & Data Extract Workspace with Flexible Width Modes */}
            <div className={chartWidthMode === 'wide' ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-12 gap-6'}>
              
              {/* Glass Chart Card with Interactive Switcher, Canvas Width Toggle, and Height Controls */}
              {activeResult.chart_specs?.length > 0 && activeResult.query_result && (
                <div className={`glass-panel rounded-3xl p-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col transition-all duration-300 ${chartWidthMode === 'wide' ? 'w-full' : 'lg:col-span-8'}`}>
                  
                  {/* Chart Header Bar: Title, Width Mode, Height Controls, & Visualization Switcher */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">
                          {activeResult.chart_specs[0].title || 'Data Visualization'}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {activeResult.query_result.row_count} records • Interactive Canvas
                        </span>
                      </div>
                    </div>
                    
                    {/* Controls: Canvas Width Mode, Height Toggle, & Visualization Type Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                      
                      {/* Width Mode Toggle (Full Width vs Split View) */}
                      <button
                        onClick={() => setChartWidthMode(prev => prev === 'wide' ? 'split' : 'wide')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          chartWidthMode === 'wide'
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        title={chartWidthMode === 'wide' ? 'Switch to Side-by-Side Split View' : 'Expand to Full Width 100% Canvas'}
                      >
                        {chartWidthMode === 'wide' ? (
                          <>
                            <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Wide Canvas (100%)</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Split View (67%)</span>
                          </>
                        )}
                      </button>

                      {/* Height Selector */}
                      <div className="flex items-center gap-1 bg-slate-900/90 border border-white/10 rounded-xl p-1 text-[11px]">
                        {[
                          { label: 'Compact', h: 340 },
                          { label: 'Standard', h: 440 },
                          { label: 'Tall', h: 580 },
                        ].map(opt => (
                          <button
                            key={opt.h}
                            onClick={() => setChartHeight(opt.h)}
                            className={`px-2 py-0.5 rounded-lg transition-all font-medium ${
                              chartHeight === opt.h 
                                ? 'bg-indigo-600 text-white font-bold shadow-[0_0_10px_rgba(99,102,241,0.4)]' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* 20 Visualization Types Selector */}
                      <div className="relative">
                        <select
                          value={chartTypeOverride || activeResult.chart_specs[0].chart_type || 'bar'}
                          onChange={(e) => setChartTypeOverride(e.target.value as any)}
                          className="bg-slate-900/95 border border-indigo-500/40 hover:border-indigo-400 rounded-xl px-3 py-1.5 text-xs font-semibold text-white outline-none cursor-pointer pr-8 shadow-[0_0_20px_rgba(99,102,241,0.25)] appearance-none"
                        >
                          <optgroup label="📊 Bar & Column Charts">
                            <option value="bar">📊 Vertical Bar (Column)</option>
                            <option value="horizontal_bar">📋 Horizontal Bar (Categorical)</option>
                            <option value="stacked_bar">📚 Stacked Bar Chart</option>
                            <option value="grouped_bar">📊 Grouped Multi-Bar</option>
                          </optgroup>
                          <optgroup label="📈 Line & Trends">
                            <option value="line">📈 Smooth Line (Spline Trends)</option>
                            <option value="step_line">🪜 Step Line (Discrete Stages)</option>
                          </optgroup>
                          <optgroup label="📉 Area & Cumulative Volume">
                            <option value="area">📉 Gradient Area (Volume)</option>
                            <option value="stacked_area">⛰️ Stacked Area (Cumulative)</option>
                          </optgroup>
                          <optgroup label="🥧 Proportions & Distributions">
                            <option value="pie">🥧 Classic Pie (Proportions)</option>
                            <option value="donut">🍩 Donut / Ring (Center Metric)</option>
                            <option value="funnel">🔻 Funnel Pipeline (Progression)</option>
                            <option value="treemap">🧱 Treemap (Hierarchy Tiles)</option>
                          </optgroup>
                          <optgroup label="⁘ Correlation & Polar">
                            <option value="scatter">⁘ Scatter Plot (Distribution)</option>
                            <option value="bubble">🫧 Bubble Distribution</option>
                            <option value="radar">🕸️ Radar / Spider (Metrics)</option>
                            <option value="radial">🎯 Radial Bar (Circular Gauge)</option>
                          </optgroup>
                          <optgroup label="📶 Multi-Metric & Advanced BI">
                            <option value="composed">📶 Composed (Bar + Line)</option>
                            <option value="composed_area">🌊 Composed (Area + Line)</option>
                            <option value="heatmap">🔥 Metric Heatmap Grid</option>
                            <option value="kpi_cards">💎 Executive KPI Stat Matrix</option>
                          </optgroup>
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                          ▼
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Secondary Toolbar: X-Axis, Y-Axis Pivot & Record Slicer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-3.5 py-2 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                    <div className="flex flex-wrap items-center gap-3">
                      
                      {/* X-Axis Selector */}
                      {activeResult.query_result?.columns?.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[11px] font-semibold text-slate-400">X-Axis:</span>
                          <select
                            value={xAxisOverride || activeResult.chart_specs[0].x_axis}
                            onChange={(e) => setXAxisOverride(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer"
                          >
                            {activeResult.query_result.columns.map((col: string) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Y-Axis Selector */}
                      {activeResult.query_result?.columns?.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400">Y-Axis:</span>
                          <select
                            value={yAxisOverride || activeResult.chart_specs[0].y_axis}
                            onChange={(e) => setYAxisOverride(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer"
                          >
                            {activeResult.query_result.columns.map((col: string) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Top-N Slicer Filter when rows > 10 */}
                      {activeResult.query_result?.rows?.length > 10 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-indigo-300">Filter Records:</span>
                          <select
                            value={chartDataLimit}
                            onChange={(e) => setChartDataLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                            className="bg-slate-900 border border-indigo-500/30 rounded-lg px-2 py-1 text-xs text-cyan-300 outline-none cursor-pointer"
                          >
                            <option value={10}>Top 10 Records</option>
                            <option value={20}>Top 20 Records</option>
                            <option value={50}>Top 50 Records</option>
                            <option value="all">All Records ({activeResult.query_result.rows.length})</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {(chartTypeOverride || xAxisOverride || yAxisOverride || chartDataLimit !== 20 || activeFiltersCount > 0) && (
                      <button
                        onClick={() => {
                          setChartTypeOverride(null);
                          setXAxisOverride("");
                          setYAxisOverride("");
                          setChartDataLimit(20);
                          clearAllFilters();
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset All Filters & Defaults</span>
                      </button>
                    )}
                  </div>

                  {/* Power BI & Tableau Parity: Interactive Dashboard Slicers & Filter Controls Bar */}
                  <div className="mb-4 space-y-2.5">
                    
                    {/* 1. Smart Question-Analyzed Filter Recommendation Banner */}
                    {suggestedFilter && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-cyan-500/15 to-transparent border border-cyan-500/30 text-xs animate-fade-in shadow-[0_4px_20px_rgba(6,182,212,0.15)]">
                        <div className="flex items-center gap-2 text-cyan-200">
                          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
                          <span>
                            <strong>Smart Question Filter Detected:</strong> Slice visual for <span className="font-semibold text-white bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono">{suggestedFilter.col} = '{suggestedFilter.val}'</span> ({suggestedFilter.count} matching records)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={applySuggestedFilter}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer transition-all"
                          >
                            Apply Filter
                          </button>
                          <button
                            onClick={() => setSuggestedFilter(null)}
                            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                            title="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. Interactive Slicers Bar & Live Dimension Filters */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/90 border border-white/10 text-xs relative">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[11px] uppercase tracking-wider mr-1">
                          <Filter className="w-3.5 h-3.5" />
                          <span>Power BI Slicers:</span>
                        </div>

                        {/* Dimension Slicer Buttons */}
                        {(activeResult.query_result?.columns || []).map((col: string) => {
                          const isNumeric = activeResult.query_result.rows.some((r: any) => !isNaN(Number(r[col])) && r[col] !== null && r[col] !== '');
                          const activeVals = selectedDimFilters[col] || [];
                          const distinctVals = Array.from(new Set(activeResult.query_result.rows.map((r: any) => String(r[col] ?? '')))).filter(Boolean);

                          if (isNumeric || distinctVals.length <= 1) return null;

                          return (
                            <div key={col} className="relative">
                              <button
                                onClick={() => {
                                  setOpenSlicerCol(openSlicerCol === col ? null : col);
                                  setSlicerSearchTerm("");
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all cursor-pointer ${
                                  activeVals.length > 0
                                    ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <span>{col}</span>
                                {activeVals.length > 0 ? (
                                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white font-mono text-[9px] font-bold">
                                    {activeVals.length}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono">({distinctVals.length})</span>
                                )}
                                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${openSlicerCol === col ? 'rotate-180' : ''}`} />
                              </button>

                              {/* Dimension Slicer Popover */}
                              {openSlicerCol === col && (
                                <div 
                                  ref={slicerPopoverRef}
                                  className="absolute left-0 top-full mt-2 w-64 max-h-72 bg-slate-950/95 border border-indigo-500/40 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl z-50 flex flex-col space-y-2 animate-fade-in"
                                >
                                  <div className="flex items-center justify-between pb-1 border-b border-white/10 text-[11px]">
                                    <span className="font-bold text-white uppercase tracking-wider">{col} Slicer</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => selectAllColFilters(col, distinctVals as string[])}
                                        className="text-cyan-400 hover:underline text-[10px] font-semibold"
                                      >
                                        All
                                      </button>
                                      <span className="text-slate-600">|</span>
                                      <button
                                        onClick={() => clearColFilters(col)}
                                        className="text-rose-400 hover:underline text-[10px] font-semibold"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>

                                  {/* Slicer Search */}
                                  <div className="relative">
                                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                      type="text"
                                      value={slicerSearchTerm}
                                      onChange={(e) => setSlicerSearchTerm(e.target.value)}
                                      placeholder={`Search ${col}...`}
                                      className="w-full bg-slate-900 border border-white/10 rounded-lg pl-7 pr-2 py-1 text-[11px] text-white outline-none focus:border-indigo-400"
                                      autoFocus
                                    />
                                  </div>

                                  {/* Distinct Values Checkbox List */}
                                  <div className="overflow-y-auto max-h-48 custom-scrollbar space-y-1 pt-1">
                                    {distinctVals
                                      .filter((v: any) => String(v).toLowerCase().includes(slicerSearchTerm.toLowerCase()))
                                      .map((val: any) => {
                                        const isChecked = activeVals.includes(String(val));
                                        const valCount = activeResult.query_result.rows.filter((r: any) => String(r[col]) === String(val)).length;
                                        return (
                                          <div
                                            key={String(val)}
                                            onClick={() => toggleDimFilter(col, String(val))}
                                            className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer text-[11px] text-slate-200 transition-colors"
                                          >
                                            <div className="flex items-center gap-2 truncate pr-2">
                                              {isChecked ? (
                                                <CheckSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                              ) : (
                                                <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                              )}
                                              <span className={`truncate ${isChecked ? 'text-white font-semibold' : 'text-slate-300'}`}>
                                                {String(val)}
                                              </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                              {valCount}
                                            </span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Numeric Metric Threshold Filter Chips */}
                        {(activeResult.query_result?.columns || []).map((col: string) => {
                          const isNumeric = activeResult.query_result.rows.some((r: any) => !isNaN(Number(r[col])) && r[col] !== null && r[col] !== '');
                          if (!isNumeric) return null;
                          const currentRange = metricRangeFilters[col] || {};

                          return (
                            <div key={`metric-${col}`} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-[11px]">
                              <span className="text-slate-400 font-medium">{col} ≥</span>
                              <input
                                type="number"
                                value={currentRange.min !== undefined ? currentRange.min : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  setMetricRangeFilters(prev => ({
                                    ...prev,
                                    [col]: { ...prev[col], min: val }
                                  }));
                                }}
                                placeholder="Min"
                                className="w-14 bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-white font-mono text-[10px] outline-none focus:border-indigo-400"
                              />
                            </div>
                          );
                        })}

                        {/* Live Search Across All Rows */}
                        <div className="relative">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={filterSearchText}
                            onChange={(e) => setFilterSearchText(e.target.value)}
                            placeholder="Search in data..."
                            className="bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-1 text-[11px] text-white outline-none focus:border-indigo-400 placeholder:text-slate-500 w-32 focus:w-44 transition-all"
                          />
                          {filterSearchText && (
                            <button
                              onClick={() => setFilterSearchText("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filter Count & Parity Status */}
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
                          {filteredDatasetRows.length} / {activeResult.query_result.rows.length} rows ({Math.round((filteredDatasetRows.length / (activeResult.query_result.rows.length || 1)) * 100)}%)
                        </span>
                        {activeFiltersCount > 0 && (
                          <button
                            onClick={clearAllFilters}
                            className="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-1 font-sans text-xs"
                          >
                            <X className="w-3 h-3" />
                            <span>Clear Filters</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Active Filter Chips Row */}
                    {activeFiltersCount > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 animate-fade-in text-[11px]">
                        <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Active Slices:</span>
                        {Object.entries(selectedDimFilters).map(([col, vals]) => 
                          vals.map((val) => (
                            <span 
                              key={`${col}-${val}`}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-[10px] font-medium"
                            >
                              <span className="text-slate-400">{col}:</span>
                              <strong className="text-white">{val}</strong>
                              <button
                                onClick={() => toggleDimFilter(col, val)}
                                className="hover:text-rose-400 ml-0.5 cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))
                        )}
                        {Object.entries(metricRangeFilters).map(([col, range]) => {
                          if (range.min === undefined) return null;
                          return (
                            <span 
                              key={`range-${col}`}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-[10px] font-medium"
                            >
                              <span>{col} ≥ {range.min}</span>
                              <button
                                onClick={() => setMetricRangeFilters(prev => {
                                  const next = { ...prev };
                                  delete next[col];
                                  return next;
                                })}
                                className="hover:text-rose-400 ml-0.5 cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          );
                        })}
                        {filterSearchText && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[10px] font-medium">
                            <span>Search: "{filterSearchText}"</span>
                            <button
                              onClick={() => setFilterSearchText("")}
                              className="hover:text-rose-400 ml-0.5 cursor-pointer"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Main Interactive Chart Canvas - Synchronized with Sliced Data */}
                  <div className="flex-1 w-full" style={{ minHeight: chartHeight }}>
                    {renderChart(activeResult.chart_specs[0], filteredDatasetRows)}
                  </div>

                  {/* Executive Segment Deep-Dive Intelligence Box */}
                  {(() => {
                    const data = filteredDatasetRows;
                    const effectiveX = xAxisOverride || activeResult.chart_specs[0].x_axis;
                    const effectiveY = yAxisOverride || activeResult.chart_specs[0].y_axis;
                    if (!data || data.length === 0) return null;

                    const totalSum = data.reduce((acc: number, d: any) => acc + (Number(d[effectiveY]) || 0), 0) || 1;
                    const avgVal = totalSum / (data.length || 1);
                    const sortedData = [...data].sort((a: any, b: any) => (Number(b[effectiveY]) || 0) - (Number(a[effectiveY]) || 0));
                    const activeItem = hoveredSlice || sortedData[0] || {};
                    const activeName = activeItem[effectiveX] || 'Peak Segment';
                    const activeVal = Number(activeItem[effectiveY] || 0);
                    const activePct = ((activeVal / totalSum) * 100).toFixed(1);
                    const activeDelta = (((activeVal - avgVal) / (avgVal || 1)) * 100).toFixed(0);
                    const activeRank = sortedData.findIndex((d: any) => d[effectiveX] === activeName) + 1;

                    return (
                      <div className="mt-4 pt-3.5 border-t border-white/10 rounded-2xl bg-white/[0.02] p-3.5 border border-white/5 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block animate-pulse" />
                            <span className="text-xs font-bold text-white tracking-tight">
                              Segment Intelligence: <span className="text-cyan-300">{activeName}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                              {activePct}% Share
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              Rank #{activeRank || 1}
                            </span>
                          </div>
                        </div>

                        {/* Line 1: Contextual Measurement */}
                        <div className="text-xs text-slate-200 leading-relaxed flex items-start gap-1.5">
                          <span className="text-cyan-400 font-bold">•</span>
                          <span>
                            <strong className="text-white">{activeName}</strong> recorded a total {effectiveY} of <strong className="text-cyan-300">${activeVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>, accounting for <strong className="text-white">{activePct}%</strong> of total volume ({Number(activeDelta) >= 0 ? '+' : ''}{activeDelta}% vs dataset average).
                          </span>
                        </div>

                        {/* Line 2: Strategic Actionable Recommendation */}
                        <div className="text-xs text-indigo-200/90 leading-relaxed flex items-start gap-1.5 italic">
                          <span className="text-indigo-400 font-bold">•</span>
                          <span>
                            <strong>Strategic Takeaway:</strong> Peak demand concentration on {activeName} represents a primary performance driver. Prioritize inventory allocation, staffing schedules, and high-margin campaigns during this window.
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Data Extract Table - Synchronized with Sliced Data */}
              {activeResult.query_result?.rows && (
                <div className={`glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col transition-all duration-300 ${chartWidthMode === 'wide' ? 'w-full max-h-[460px]' : 'lg:col-span-4 max-h-[640px]'}`}>
                  <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-sm font-bold text-white">Data Extract</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {filteredDatasetRows.length} {activeFiltersCount > 0 ? `of ${activeResult.query_result.row_count} Rows (Filtered)` : 'Rows'}
                    </span>
                  </div>

                  <div className="overflow-auto custom-scrollbar flex-1 p-2">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 z-10">
                        <tr>
                          {activeResult.query_result.columns.map((c: string) => (
                            <th key={c} className="px-4 py-2.5 font-semibold text-slate-400 whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {filteredDatasetRows.map((row: any, i: number) => (
                          <tr 
                            key={i} 
                            onClick={() => setHoveredSlice(row)}
                            className="hover:bg-white/[0.08] cursor-pointer transition-colors"
                            title="Click row to inspect segment intelligence"
                          >
                            {activeResult.query_result.columns.map((c: string) => (
                              <td key={c} className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                                {row[c]?.toString() || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


            </div>

            {/* Suggested Follow-up Inquiries in Active Result Workspace */}
            <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] animate-fade-in">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Suggested Follow-up Questions:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(activeResult.follow_up_questions?.length ? activeResult.follow_up_questions : [
                  `Which specific categories drove the highest volume?`,
                  `What is the average trend compared across other segments?`,
                  `Are there any statistical anomalies or outliers?`
                ]).map((fq: string, qIdx: number) => (
                  <button
                    key={qIdx}
                    onClick={() => handleAsk(fq)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-indigo-600/25 border border-white/10 hover:border-indigo-400/40 text-xs text-slate-200 hover:text-white transition-all group cursor-pointer"
                  >
                    <span>"{fq}"</span>
                    <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* End of Generated Data Action Bar: Thumbs Up, Thumbs Down, Regenerate */}
            <div className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Rate Generated Insights:</span>
                <button
                  onClick={() => handleFeedback('latest', 'up')}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                    messageFeedback['latest'] === 'up'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:text-emerald-400 border-white/10 hover:bg-white/5'
                  }`}
                  title="Accurate (Thumbs Up)"
                >
                  <ThumbsUp className="w-4 h-4 text-emerald-400" />
                </button>
                <button
                  onClick={() => handleFeedback('latest', 'down')}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                    messageFeedback['latest'] === 'down'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                      : 'text-slate-400 hover:text-rose-400 border-white/10 hover:bg-white/5'
                  }`}
                  title="Inaccurate (Thumbs Down)"
                >
                  <ThumbsDown className="w-4 h-4 text-rose-400" />
                </button>
                <button
                  onClick={() => {
                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                    if (lastUserMsg) {
                      handleAsk(lastUserMsg.content);
                    }
                  }}
                  disabled={isLoading}
                  className="p-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-indigo-400 hover:bg-white/5 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
                  title="Regenerate Response"
                >
                  <RefreshCw className={`w-4 h-4 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {feedbackToast && (
                <div className="text-xs text-emerald-300 font-medium animate-fade-in flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{feedbackToast}</span>
                </div>
              )}
            </div>

          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Floating Chat Input Bar Fixed to Bottom */}
      <div className="fixed bottom-4 left-0 right-0 px-4 sm:px-6 pointer-events-none flex justify-center z-40">
        <div className="w-full max-w-3xl pointer-events-auto">
          <div className="glass-input rounded-3xl p-2.5 flex items-end shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/15">
            <textarea 
              className="flex-1 max-h-36 min-h-[44px] px-4 py-2.5 outline-none resize-none bg-transparent text-sm font-medium text-white placeholder-slate-400 custom-scrollbar"
              placeholder={messages.length > 0 ? "Ask a follow-up question (e.g. 'Break this down by month' or 'Filter for East region')..." : "Ask LuminaBI anything (e.g. 'Show total revenue by region')..."}
              rows={1}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
            />

            {/* Microphone Voice Input Button */}
            <button
              onClick={toggleVoiceRecognition}
              className={`m-1 p-3 rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                isListening
                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.6)] animate-pulse'
                  : 'glass-panel hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
              }`}
              title={isListening ? "Listening... Click to stop" : "Voice Input (Speak your query)"}
            >
              {isListening ? <MicOff className="w-5 h-5 text-rose-400" /> : <Mic className="w-5 h-5" />}
            </button>

            <button 
              onClick={() => handleAsk()}
              disabled={isLoading || !query.trim()}
              className="m-1 p-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center shrink-0 cursor-pointer"
              title="Submit Message"
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
          {isListening && (
            <div className="text-center pt-2 animate-fade-in">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping inline-block" />
                Listening to speech... Speak your data question
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Power BI Integration Modal */}
      {showPowerBiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl border border-amber-500/30 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Power BI Desktop Connector</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      LIVE ODATA & WEB FEED
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect {currentDataset?.name || `Dataset #${selectedDataset}`} directly into Microsoft Power BI
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPowerBiModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Method 1: Direct Web Feed Connector (Recommended)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In Power BI Desktop, navigate to <strong className="text-white">Home &gt; Get Data &gt; Web</strong>, choose <strong className="text-white">Basic</strong>, and paste the live endpoint URL below:
                </p>
                <div className="flex items-center gap-2 bg-slate-900 border border-white/15 rounded-xl p-2.5 font-mono text-xs text-amber-200 overflow-x-auto">
                  <span className="flex-1 truncate">{`http://localhost:8000/api/v1/datasets/${selectedDataset}/powerbi`}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`http://localhost:8000/api/v1/datasets/${selectedDataset}/powerbi`);
                      setCopiedPowerBiUrl(true);
                      setTimeout(() => setCopiedPowerBiUrl(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                  >
                    {copiedPowerBiUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPowerBiUrl ? 'Copied' : 'Copy Feed URL'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Method 2: Advanced Power Query (M Code)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In Power BI Desktop, open <strong className="text-white">Transform Data &gt; Advanced Editor</strong> and paste the following snippet:
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 border border-white/15 rounded-xl p-3 font-mono text-[11px] text-cyan-300 overflow-x-auto leading-relaxed custom-scrollbar max-h-36">
{`let
    Source = Json.Document(Web.Contents("http://localhost:8000/api/v1/datasets/${selectedDataset}/powerbi")),
    #"Converted to Table" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Records" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", Record.FieldNames(Source{0}))
in
    #"Expanded Records"`}
                  </pre>
                  <button
                    onClick={() => {
                      const mCode = `let\n    Source = Json.Document(Web.Contents("http://localhost:8000/api/v1/datasets/${selectedDataset}/powerbi")),\n    #"Converted to Table" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),\n    #"Expanded Records" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", Record.FieldNames(Source{0}))\nin\n    #"Expanded Records"`;
                      navigator.clipboard.writeText(mCode);
                      setCopiedMQuery(true);
                      setTimeout(() => setCopiedMQuery(false), 2000);
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedMQuery ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedMQuery ? 'Copied' : 'Copy M Code'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>CORS and standard REST headers enabled. Live data refreshes automatically when reloaded in Power BI!</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowPowerBiModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Context Protocol (MCP) Tools Integration Modal */}
      {showMcpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl border border-cyan-500/30 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Model Context Protocol (MCP) Server</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      EXTERNAL TOOLS READY
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect external LLMs & tools (Claude Desktop, Cursor, LangChain) directly to DataAgent
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMcpModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Supported MCP Autonomous Tools
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="font-mono text-cyan-400 font-bold block">list_datasets</span>
                    <span className="text-slate-400 text-[11px]">Inspect all tabular datasets, hygiene scores & schemas</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="font-mono text-indigo-400 font-bold block">query_dataset</span>
                    <span className="text-slate-400 text-[11px]">Execute natural language analysis, SQL generation & chart specs</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="font-mono text-emerald-400 font-bold block">audit_and_clean_dataset</span>
                    <span className="text-slate-400 text-[11px]">Run comprehensive 9-stage EDA and statistical data hygiene</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="font-mono text-amber-400 font-bold block">simulate_scenario</span>
                    <span className="text-slate-400 text-[11px]">Execute predictive what-if scenario simulations with executive impact</span>
                  </div>
                </div>
              </div>

              {/* Claude Desktop & Cursor Integration Config */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Claude Desktop / Cursor Config (claude_desktop_config.json)
                  </span>
                  <button
                    onClick={() => {
                      const cfg = JSON.stringify({
                        mcpServers: {
                          "data-analyst-agent": {
                            url: "http://localhost:8000/api/v1/mcp"
                          }
                        }
                      }, null, 2);
                      navigator.clipboard.writeText(cfg);
                      setCopiedMcpConfig(true);
                      setTimeout(() => setCopiedMcpConfig(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedMcpConfig ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedMcpConfig ? 'Copied' : 'Copy Config'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 border border-white/15 rounded-xl p-3 font-mono text-[11px] text-cyan-300 overflow-x-auto leading-relaxed custom-scrollbar">
{`{
  "mcpServers": {
    "data-analyst-agent": {
      "url": "http://localhost:8000/api/v1/mcp"
    }
  }
}`}
                </pre>
              </div>

              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Live MCP Manifest: <code className="font-mono bg-cyan-950/40 px-1.5 py-0.5 rounded text-[11px] text-cyan-200">http://localhost:8000/api/v1/mcp/manifest</code></span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowMcpModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Pin Toast */}
      {pinToast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md border border-purple-400/40 text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{pinToast}</span>
        </div>
      )}

      {/* Root-Cause Driver Variance Modal */}
      {showRootCauseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl border border-emerald-500/30 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Root-Cause Driver Variance Analysis</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      WHY DID THIS HAPPEN?
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Decomposing metric variance across dimensions to identify root drivers and negative drags
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRootCauseModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingRootCause ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Decomposing variance factors across categorical dimensions...</span>
              </div>
            ) : rootCauseError ? (
              <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rootCauseError}</span>
              </div>
            ) : rootCauseData ? (
              <div className="space-y-5">
                {/* Variance Scorecard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
                    <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                      Top Growth Drivers (Upward Lift)
                    </span>
                    <div className="space-y-1">
                      {rootCauseData.top_positive?.map((d: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">{d.category}</span>
                          <span className="text-emerald-400 font-mono font-bold">+{d.impact_pct}%</span>
                        </div>
                      ))}
                      {(!rootCauseData.top_positive || rootCauseData.top_positive.length === 0) && (
                        <span className="text-slate-500 italic text-[11px]">No positive variance drivers detected</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/50">
                    <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block mb-1">
                      Primary Negative Drags (Downward Drag)
                    </span>
                    <div className="space-y-1">
                      {rootCauseData.top_negative?.map((d: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">{d.category}</span>
                          <span className="text-rose-400 font-mono font-bold">{d.impact_pct}%</span>
                        </div>
                      ))}
                      {(!rootCauseData.top_negative || rootCauseData.top_negative.length === 0) && (
                        <span className="text-slate-500 italic text-[11px]">No negative drag segments detected</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Waterfall Decomposition Chart */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Waterfall Variance Decomposition: <span className="text-emerald-400">{rootCauseData.metric_column}</span> by <span className="text-indigo-400">{rootCauseData.dimension_column}</span>
                    </span>
                    <span className="text-slate-500 text-[11px]">Benchmark: {rootCauseData.baseline_value}</span>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rootCauseData.waterfall_steps} margin={{ top: 15, right: 15, left: -10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                          formatter={(val: any, _name: any, item: any) => [
                            `${val} (${item.payload.delta >= 0 ? '+' : ''}${item.payload.delta})`,
                            'Value'
                          ]}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {rootCauseData.waterfall_steps.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Executive Diagnosis */}
                {rootCauseData.diagnosis && (
                  <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/50 space-y-1.5">
                    <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
                      Chief Data Officer Root-Cause Synthesis
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {rootCauseData.diagnosis}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowRootCauseModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Predictive ML Forecasting Modal */}
      {showForecastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl border border-cyan-500/30 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Predictive ML Time-Series Forecasting</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      HOLT-WINTERS MODEL
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Forward projections with dynamic 80% & 95% statistical confidence intervals
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForecastModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Horizon Controller Bar */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Forecast Horizon:</span>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-mono font-bold">
                  {forecastHorizon} Periods / Days
                </span>
              </div>

              {/* Preset Buttons */}
              <div className="flex items-center gap-1.5">
                {[14, 30, 60, 90, 180].map(h => (
                  <button
                    key={h}
                    onClick={() => {
                      setForecastHorizon(h);
                      handleOpenForecast(h);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      forecastHorizon === h
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    {h}d
                  </button>
                ))}
              </div>
            </div>

            {isLoadingForecast ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Computing Holt's trend smoothing and error variance bands...</span>
              </div>
            ) : forecastError ? (
              <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forecastError}</span>
              </div>
            ) : forecastData ? (
              <div className="space-y-5">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Projected End Target</span>
                    <span className="text-base font-bold text-cyan-300 font-mono mt-0.5 block">
                      {forecastData.projected_end}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Expected Change</span>
                    <span className={`text-base font-bold font-mono mt-0.5 block ${
                      forecastData.growth_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {forecastData.growth_pct >= 0 ? '+' : ''}{forecastData.growth_pct}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Trend Direction</span>
                    <span className="text-base font-bold text-amber-300 mt-0.5 block truncate">
                      {forecastData.velocity}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Model Confidence</span>
                    <span className="text-base font-bold text-indigo-300 font-mono mt-0.5 block">
                      {forecastData.confidence_rating}%
                    </span>
                  </div>
                </div>

                {/* Forecast Time-Series Chart */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Historical Trend vs Projected Horizon: <span className="text-cyan-400">{forecastData.metric_column}</span>
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1.5 text-cyan-400">
                        <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> Historical Actual
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2.5 h-0.5 border-t border-dashed border-emerald-400 inline-block" /> Projected Forecast
                      </span>
                    </div>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={forecastData.series} margin={{ top: 15, right: 15, left: -10, bottom: 25 }}>
                        <defs>
                          <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                        />
                        {/* 95% Confidence Band Area */}
                        <Area
                          type="monotone"
                          dataKey="upper_95"
                          stroke="transparent"
                          fill="url(#confidenceBand)"
                          name="95% Upper Band"
                        />
                        {/* Historical Actual Line */}
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="#38bdf8"
                          strokeWidth={2.5}
                          dot={{ r: 2, fill: '#38bdf8' }}
                          name="Historical Actual"
                        />
                        {/* Projected Forecast Line */}
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          dot={{ r: 3, fill: '#10b981' }}
                          name="Predicted Forecast"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AI Executive CFO Summary */}
                {forecastData.ai_summary && (
                  <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-900/50 space-y-1.5">
                    <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">
                      Chief Financial Officer Predictive Trajectory
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {forecastData.ai_summary}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowForecastModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

function intToPercent(val: number): number {
  if (val <= 1) return Math.round(val * 100);
  return Math.round(val);
}

export default Dashboard;
