import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  LayoutGrid, Plus, Trash2, Maximize2, Sparkles, Filter, 
  Download, ChevronDown, Search 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

interface BoardWidget {
  id: number;
  board_name: string;
  dataset_id?: number;
  dataset_name?: string;
  title: string;
  query?: string;
  chart_type: string;
  chart_specs?: any;
  query_result?: {
    columns: string[];
    rows: any[];
    row_count: number;
  };
  insights?: string;
  kpis?: Record<string, any>;
  card_width: string; // "col-span-1" | "col-span-2" | "col-span-3"
  position: number;
  created_at?: string;
}

const PALETTE = ['#6366f1', '#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

const ExecutiveBoard: React.FC = () => {
  const [boardNames, setBoardNames] = useState<string[]>(['Executive Cockpit']);
  const [activeBoard, setActiveBoard] = useState<string>('Executive Cockpit');
  const [widgets, setWidgets] = useState<BoardWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Record<number, boolean>>({});

  // Global Cross-Filter Slicers
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedDimension, setSelectedDimension] = useState<string>('all');
  const [dimensionValue, setDimensionValue] = useState<string>('all');

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBoardNames = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/board/names');
      if (res.data?.boards?.length > 0) {
        setBoardNames(res.data.boards);
      }
    } catch (err) {
      console.error('Failed to fetch board names', err);
    }
  };

  const fetchWidgets = async (board: string) => {
    setIsLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/v1/board/?board_name=${encodeURIComponent(board)}`);
      setWidgets(res.data || []);
    } catch (err) {
      console.error('Failed to fetch widgets', err);
      showToastMsg('Failed to load board widgets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardNames();
  }, []);

  useEffect(() => {
    if (activeBoard) {
      fetchWidgets(activeBoard);
    }
  }, [activeBoard]);

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) return;
    const name = newBoardName.trim();
    if (!boardNames.includes(name)) {
      setBoardNames(prev => [...prev, name]);
    }
    setActiveBoard(name);
    setNewBoardName('');
    setShowNewBoardModal(false);
    showToastMsg(`Switched to new board: "${name}"`);
  };

  const handleDeleteWidget = async (id: number) => {
    try {
      await axios.delete(`http://localhost:8000/api/v1/board/${id}`);
      setWidgets(prev => prev.filter(w => w.id !== id));
      showToastMsg('Widget removed from board');
    } catch (err) {
      showToastMsg('Failed to remove widget');
    }
  };

  const handleUpdateWidgetWidth = async (widget: BoardWidget) => {
    const nextWidth = 
      widget.card_width === 'col-span-1' ? 'col-span-2' : 
      widget.card_width === 'col-span-2' ? 'col-span-3' : 'col-span-1';

    try {
      await axios.put(`http://localhost:8000/api/v1/board/${widget.id}`, { card_width: nextWidth });
      setWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, card_width: nextWidth } : w));
    } catch (err) {
      showToastMsg('Failed to update widget layout');
    }
  };

  const handleSwitchChartType = async (widget: BoardWidget, newType: string) => {
    try {
      await axios.put(`http://localhost:8000/api/v1/board/${widget.id}`, { chart_type: newType });
      setWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, chart_type: newType } : w));
    } catch (err) {
      showToastMsg('Failed to switch chart type');
    }
  };

  const handleExportBoard = () => {
    let report = `# 📊 LuminaBI Executive Boardroom Report: ${activeBoard}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Total Active Widgets: ${widgets.length}\n\n---\n\n`;

    widgets.forEach((w, i) => {
      report += `## ${i + 1}. ${w.title}\n`;
      if (w.dataset_name) report += `*Dataset: ${w.dataset_name}*\n`;
      if (w.query) report += `*Query: ${w.query}*\n`;
      if (w.insights) report += `\n**Key Strategic Insights:**\n${w.insights}\n`;
      report += `\n---\n\n`;
    });

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Executive_Board_${activeBoard.replace(/\s+/g, '_')}.md`;
    a.click();
    showToastMsg('Executive board report exported successfully!');
  };

  // Extract all possible categorical dimensions across pinned widgets for cross-filtering
  const availableDimensions = useMemo(() => {
    const dimSet = new Set<string>();
    widgets.forEach(w => {
      if (w.query_result?.rows?.length) {
        w.query_result.columns.forEach(col => {
          const firstVal = w.query_result?.rows[0]?.[col];
          if (typeof firstVal === 'string' && isNaN(Number(firstVal))) {
            dimSet.add(col);
          }
        });
      }
    });
    return Array.from(dimSet);
  }, [widgets]);

  // Extract distinct values for currently selected dimension
  const dimensionValues = useMemo(() => {
    if (selectedDimension === 'all') return [];
    const valSet = new Set<string>();
    widgets.forEach(w => {
      w.query_result?.rows?.forEach(r => {
        if (r[selectedDimension] !== undefined && r[selectedDimension] !== null) {
          valSet.add(String(r[selectedDimension]));
        }
      });
    });
    return Array.from(valSet).slice(0, 30);
  }, [widgets, selectedDimension]);

  // Filter widget rows based on global slicers
  const getFilteredRows = (w: BoardWidget) => {
    let rows = w.query_result?.rows || [];
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      rows = rows.filter(r => 
        Object.values(r).some(val => String(val).toLowerCase().includes(q))
      );
    }
    if (selectedDimension !== 'all' && dimensionValue !== 'all') {
      rows = rows.filter(r => String(r[selectedDimension]) === dimensionValue);
    }
    return rows;
  };

  // Render chart inside card
  const renderWidgetChart = (w: BoardWidget) => {
    const rows = getFilteredRows(w);
    const cols = w.query_result?.columns || [];
    if (!rows.length || cols.length === 0) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs italic">
          No records match active global filters
        </div>
      );
    }

    const xKey = cols[0];
    const yKey = cols.length > 1 ? cols[1] : cols[0];
    const isHorizontal = w.chart_type === 'horizontal_bar';

    if (w.chart_type === 'pie' || w.chart_type === 'donut') {
      return (
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={rows.slice(0, 8)}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              innerRadius={w.chart_type === 'donut' ? 45 : 0}
              outerRadius={75}
              paddingAngle={3}
            >
              {rows.slice(0, 8).map((_, index) => (
                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <RechartsTooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (w.chart_type === 'line') {
      return (
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
            <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} />
            <Line type="monotone" dataKey={yKey} stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: '#38bdf8' }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (w.chart_type === 'area') {
      return (
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
            <defs>
              <linearGradient id={`grad-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
            <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} />
            <Area type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill={`url(#grad-${w.id})`} />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Default Bar Chart (Vertical or Horizontal)
    return (
      <ResponsiveContainer width="100%" height={230}>
        <BarChart 
          data={rows.slice(0, 15)} 
          layout={isHorizontal ? "vertical" : "horizontal"}
          margin={{ top: 10, right: 10, left: isHorizontal ? 20 : -20, bottom: isHorizontal ? 5 : 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          {isHorizontal ? (
            <>
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis dataKey={xKey} type="category" stroke="#64748b" tick={{ fontSize: 10 }} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
            </>
          )}
          <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} />
          <Bar dataKey={yKey} fill="#6366f1" radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600/90 text-white px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-md border border-indigo-400/40 text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* Board Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800/90 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Executive Cockpit
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-normal">
                  Live Boardroom
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Persistent multi-widget intelligence grid with real-time cross-filtering slicers.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Board Selector Dropdown */}
          <div className="relative">
            <select
              value={activeBoard}
              onChange={(e) => setActiveBoard(e.target.value)}
              aria-label="Active Board Selector"
              className="bg-slate-800/90 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium pr-8"
            >
              {boardNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowNewBoardModal(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            New Board
          </button>

          <button
            onClick={handleExportBoard}
            disabled={widgets.length === 0}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export Briefing
          </button>
        </div>
      </div>

      {/* Global Cross-Filter Slicers Bar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400 font-medium">
          <Filter className="w-4 h-4 text-indigo-400" />
          <span>Global Cross-Filters:</span>
        </div>

        <div className="flex items-center flex-wrap gap-3 flex-1 max-w-2xl">
          {/* Universal Search Filter */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search across all widgets..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full bg-slate-800/90 text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Dimension Selector */}
          {availableDimensions.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedDimension}
                onChange={(e) => {
                  setSelectedDimension(e.target.value);
                  setDimensionValue('all');
                }}
                aria-label="Dimension Slicer"
                className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
              >
                <option value="all">Select Dimension Slicer</option>
                {availableDimensions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {selectedDimension !== 'all' && (
                <select
                  value={dimensionValue}
                  onChange={(e) => setDimensionValue(e.target.value)}
                  aria-label="Dimension Value Filter"
                  className="bg-indigo-950/60 text-indigo-200 text-xs px-2.5 py-1.5 rounded-lg border border-indigo-800/60 focus:outline-none"
                >
                  <option value="all">All Values</option>
                  {dimensionValues.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {(globalSearch || selectedDimension !== 'all') && (
            <button
              onClick={() => {
                setGlobalSearch('');
                setSelectedDimension('all');
                setDimensionValue('all');
              }}
              className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2 ml-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-slate-400 text-xs">
          Showing <span className="text-indigo-400 font-semibold">{widgets.length}</span> pinned card{widgets.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Widgets Grid */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading executive dashboard...</span>
          </div>
        </div>
      ) : widgets.length === 0 ? (
        <div className="h-72 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-slate-900/30">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Pinned Widgets Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
            Ask any question on the Analysis page, then click <strong className="text-indigo-300">"Pin to Executive Board"</strong> to construct your live boardroom briefing.
          </p>
          <a
            href="/"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl shadow-lg transition-all"
          >
            Go to Analysis
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map(w => {
            const isExpanded = !!expandedInsights[w.id];
            return (
              <div
                key={w.id}
                className={`${w.card_width} bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between backdrop-blur-md`}
              >
                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-slate-800 border border-slate-700 text-slate-300">
                          {w.dataset_name || 'Dataset'}
                        </span>
                        {w.query && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[200px]" title={w.query}>
                            "{w.query}"
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-100 mt-1">
                        {w.title}
                      </h3>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      {/* Chart Type Selector */}
                      <select
                        value={w.chart_type}
                        onChange={(e) => handleSwitchChartType(w, e.target.value)}
                        aria-label="Widget Chart Type Switcher"
                        className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-1 rounded border border-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="bar">Bar</option>
                        <option value="horizontal_bar">H-Bar</option>
                        <option value="line">Line</option>
                        <option value="area">Area</option>
                        <option value="pie">Pie</option>
                        <option value="donut">Donut</option>
                      </select>

                      {/* Resize Width */}
                      <button
                        onClick={() => handleUpdateWidgetWidth(w)}
                        title="Toggle Card Width"
                        className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteWidget(w.id)}
                        title="Unpin Widget"
                        className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Chart Body */}
                  <div className="mt-4">
                    {renderWidgetChart(w)}
                  </div>
                </div>

                {/* Card Footer: Insights Accordion */}
                {w.insights && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => setExpandedInsights(prev => ({ ...prev, [w.id]: !prev[w.id] }))}
                      className="w-full flex items-center justify-between text-left text-[11px] text-indigo-400 hover:text-indigo-300 font-medium py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        Executive Insights
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <p className="text-[11px] text-slate-300 mt-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 leading-relaxed max-h-36 overflow-y-auto">
                        {w.insights}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Board Modal */}
      {showNewBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Create New Executive Board</h3>
            <p className="text-xs text-slate-400 mb-4">Give your customized dashboard a descriptive title.</p>
            <input
              type="text"
              placeholder="e.g., Q4 Revenue Cockpit, Churn Intelligence..."
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 mb-4"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setShowNewBoardModal(false)}
                className="px-3 py-2 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBoard}
                disabled={!newBoardName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl shadow-lg transition-all"
              >
                Create Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveBoard;
